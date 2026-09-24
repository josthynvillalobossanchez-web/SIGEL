import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Forma unica en la que SIGEL responde cualquier error.
 *
 * El frontend se guia por "codigo", no por el texto de "message": el texto
 * puede cambiar o reescribirse, el codigo no. Asi una pantalla puede
 * reaccionar distinto ante CUENTA_BLOQUEADA_TEMPORALMENTE que ante
 * CREDENCIALES_INVALIDAS sin tener que comparar frases.
 */
interface RespuestaDeError {
  statusCode: number;
  codigo: string;
  message: string;
  /** Detalle campo por campo. Solo aparece cuando falla la validacion del DTO. */
  detalles?: string[];
  ruta: string;
}

/**
 * Codigo por omision segun el estado HTTP, para los errores que lanza Nest
 * por su cuenta y no traen uno propio.
 */
const CODIGO_POR_ESTADO: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'DATOS_INVALIDOS',
  [HttpStatus.UNAUTHORIZED]: 'SIN_SESION',
  [HttpStatus.FORBIDDEN]: 'SIN_PERMISO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLICTO',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ARCHIVO_DEMASIADO_GRANDE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADAS_PETICIONES',
};

/**
 * Mensajes propios para los estados donde el texto que trae Nest viene en
 * ingles o resulta poco claro para quien usa el sistema.
 */
const MENSAJE_POR_ESTADO: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Revise los datos enviados.',
  [HttpStatus.UNAUTHORIZED]: 'Debe iniciar sesion para continuar.',
  [HttpStatus.FORBIDDEN]: 'No tiene permisos para realizar esta accion.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados intentos seguidos. Espere unos minutos y vuelva a intentarlo.',
  [HttpStatus.NOT_FOUND]: 'No se encontro lo que esta buscando.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Ocurrio un error inesperado. Si vuelve a pasar, avise al Departamento de TI.',
};

/** Mensaje que se usa cuando el estado no tiene uno propio. */
const MENSAJE_GENERICO = 'No se pudo procesar la solicitud.';

/**
 * Reconoce el error que lanza el lector de JSON de Express cuando el cuerpo
 * de la peticion viene mal escrito: una coma de mas, una comilla sin cerrar,
 * una propiedad sin valor.
 *
 * Hay que tratarlo aparte porque ese mensaje incluye un pedazo del cuerpo
 * que se envio, y ese cuerpo puede traer una contrasena. Devolverlo tal cual
 * seria filtrar datos sensibles de vuelta al cliente, y ademas viene en
 * ingles y con posiciones de caracteres que a nadie le sirven.
 */
function esJsonMalFormado(mensaje: string): boolean {
  return /JSON|Unexpected token|Unexpected end of/i.test(mensaje);
}

/**
 * Traduce al espaniol el aviso que genera la libreria de validacion cuando
 * llega un campo que el DTO no declara.
 *
 * Ese mensaje no lo escribe nuestro codigo, asi que viene en ingles
 * ("property id should not exist") y no se puede cambiar desde el DTO. Se
 * traduce aqui, que es el unico punto por donde pasan todos los errores.
 */
function traducirDetalle(detalle: string): string {
  const campoDeMas = /^property (.+) should not exist$/i.exec(detalle);

  if (campoDeMas) {
    return `El campo "${campoDeMas[1]}" no corresponde a esta operacion.`;
  }

  /**
   * Cuando se valida una lista de objetos (por ejemplo los roles de una
   * cuenta), la libreria antepone la ruta del campo al mensaje:
   * "roles.0.El rol indicado no es valido." Se reescribe contando desde 1,
   * como lo contaria una persona: "roles, elemento 1: El rol indicado...".
   */
  const anidado = /^(\w+)\.(\d+)\.(.+)$/.exec(detalle);

  if (anidado) {
    const [, campo, posicion, mensaje] = anidado;
    return `${campo}, elemento ${Number(posicion) + 1}: ${traducirDetalle(mensaje)}`;
  }

  return detalle;
}

/**
 * Atrapa TODO lo que salga mal en la API y lo devuelve con la misma forma.
 *
 * Dos razones para tenerlo:
 *
 * 1. Consistencia. Sin el, cada endpoint responde a su manera y el frontend
 *    termina lleno de casos especiales.
 * 2. Seguridad. Un error que nadie atrapa arrastra la traza completa, con
 *    rutas de archivos, nombres de tablas y a veces hasta la consulta SQL.
 *    Eso se registra en el servidor, donde sirve, y nunca se le manda al
 *    cliente.
 */
@Catch()
export class FiltroDeExcepciones implements ExceptionFilter {
  private readonly registro = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const peticion = contexto.getRequest<Request>();
    const respuesta = contexto.getResponse<Response>();

    const armada = this.armarRespuesta(excepcion, peticion.url);

    if (armada.statusCode >= 500) {
      // Error nuestro: se guarda entero, con traza, para poder arreglarlo.
      this.registro.error(
        `${peticion.method} ${peticion.url} -> ${armada.statusCode}`,
        excepcion instanceof Error ? excepcion.stack : String(excepcion),
      );
    } else {
      // Error del cliente: una linea, sin traza, que no aportaria nada.
      // Se incluye el mensaje original para quien esta programando, ya que
      // al cliente dejo de mandarsele.
      const original = excepcion instanceof Error ? ` | ${excepcion.message}` : '';
      this.registro.warn(
        `${peticion.method} ${peticion.url} -> ${armada.statusCode} ${armada.codigo}${original}`,
      );
    }

    respuesta.status(armada.statusCode).json(armada);
  }

  private armarRespuesta(excepcion: unknown, ruta: string): RespuestaDeError {
    if (excepcion instanceof HttpException) {
      return this.desdeHttpException(excepcion, ruta);
    }

    const deBaseDeDatos = this.desdeBaseDeDatos(excepcion, ruta);
    if (deBaseDeDatos) {
      return deBaseDeDatos;
    }

    // Cualquier otra cosa: al cliente solo le llega un mensaje generico.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      codigo: 'ERROR_INTERNO',
      message: MENSAJE_POR_ESTADO[HttpStatus.INTERNAL_SERVER_ERROR],
      ruta,
    };
  }

  private desdeHttpException(excepcion: HttpException, ruta: string): RespuestaDeError {
    const estado = excepcion.getStatus();
    const cuerpo = excepcion.getResponse();

    // Caso 1: el error lo lanzamos nosotros con su propio codigo, por ejemplo
    // throw new ForbiddenException({ codigo: 'SIN_PERMISO', message: '...' }).
    if (typeof cuerpo === 'object' && cuerpo !== null && 'codigo' in cuerpo) {
      const propio = cuerpo as Record<string, unknown>;
      return {
        ...propio, // conserva extras como "segundosRestantes"
        statusCode: estado,
        codigo: String(propio.codigo),
        message: String(propio.message ?? ''),
        ruta,
      } as RespuestaDeError;
    }

    // Caso 2: lo lanzo el ValidationPipe, que arma un arreglo con un mensaje
    // por cada regla del DTO que no se cumplio.
    if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
      const deNest = cuerpo as { message: string | string[] };

      if (Array.isArray(deNest.message)) {
        return {
          statusCode: estado,
          codigo: 'DATOS_INVALIDOS',
          message: 'Revise los datos enviados.',
          detalles: deNest.message.map(traducirDetalle),
          ruta,
        };
      }

      if (typeof deNest.message === 'string' && esJsonMalFormado(deNest.message)) {
        return this.jsonMalFormado(ruta);
      }
    }

    // Caso 3: cualquier otra excepcion de Nest.
    //
    // Se usa SIEMPRE un mensaje nuestro y nunca "excepcion.message". Esos
    // textos vienen en ingles y pueden arrastrar detalles internos, incluido
    // un pedazo del cuerpo que se envio. El mensaje original queda en el
    // registro del servidor, que es donde le sirve a quien programa.
    if (esJsonMalFormado(excepcion.message)) {
      return this.jsonMalFormado(ruta);
    }

    return {
      statusCode: estado,
      codigo: CODIGO_POR_ESTADO[estado] ?? 'ERROR',
      message: MENSAJE_POR_ESTADO[estado] ?? MENSAJE_GENERICO,
      ruta,
    };
  }

  /** El cuerpo de la peticion no se pudo leer como JSON. */
  private jsonMalFormado(ruta: string): RespuestaDeError {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      codigo: 'JSON_INVALIDO',
      message: 'El cuerpo de la solicitud no es un JSON valido.',
      ruta,
    };
  }

  /**
   * Traduce los errores de Prisma que si le sirven a quien usa el sistema.
   *
   * Se reconocen por la forma del objeto y no importando la clase de Prisma,
   * para no atar este archivo a la version del cliente generado.
   *
   *   P2002  se viola una restriccion de unicidad (un correo repetido)
   *   P2025  el registro que se iba a modificar no existe
   *   P2003  se apunta a un registro relacionado que no existe
   *
   * Cualquier otro codigo P... cae como error interno a proposito: son
   * problemas nuestros, no de quien usa el sistema, y no hay que explicarselos.
   */
  private desdeBaseDeDatos(excepcion: unknown, ruta: string): RespuestaDeError | null {
    if (typeof excepcion !== 'object' || excepcion === null || !('code' in excepcion)) {
      return null;
    }

    const codigoPrisma = String((excepcion as { code: unknown }).code);

    if (codigoPrisma === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        codigo: 'REGISTRO_DUPLICADO',
        message: 'Ya existe un registro con esos datos.',
        ruta,
      };
    }

    if (codigoPrisma === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        codigo: 'NO_ENCONTRADO',
        message: 'No se encontro el registro indicado.',
        ruta,
      };
    }

    if (codigoPrisma === 'P2003') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        codigo: 'REFERENCIA_INVALIDA',
        message: 'Alguno de los datos relacionados no existe.',
        ruta,
      };
    }

    return null;
  }
}
