import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import type { ConsultarBitacoraDto } from './dto/consultar-bitacora.dto.js';

/**
 * Acciones que la bitacora puede registrar.
 *
 * Corresponden al enum "accionBitacora" del modelo de datos. Se repiten aqui
 * como tipo para que quien llame al servicio tenga autocompletado y no pueda
 * escribir una accion que no existe.
 *
 * Ojo: el modelo contempla ademas "iniciarSesion" y "cerrarSesion", pero por
 * decision de Joseph los accesos NO se auditan, ni los exitosos ni los
 * fallidos. Quedaron en el enum por si esa decision cambia, pero el sistema
 * no los escribe.
 */
export type AccionDeBitacora =
  | 'crear'
  | 'modificar'
  | 'eliminar'
  | 'aprobar'
  | 'rechazar'
  | 'cancelar'
  | 'consultar'
  | 'descargar';

/** Un movimiento que se va a anotar en la bitacora. */
export interface MovimientoDeBitacora {
  /** Quien lo hizo. Sale siempre de la sesion, nunca del cuerpo de la peticion. */
  usuarioId: string;

  /** Tabla o concepto afectado: "usuario", "funcionario", "documento"... */
  entidad: string;

  /** UUID del registro afectado. */
  registroAfectadoId: string;

  accion: AccionDeBitacora;

  /** Funcionario cuyo expediente se toco, cuando aplica. */
  funcionarioAfectadoId?: string;

  direccionIp?: string;

  /** Como estaba el registro antes del cambio. Solo en modificaciones. */
  datosAnteriores?: Record<string, unknown>;

  /** Como quedo despues. */
  datosNuevos?: Record<string, unknown>;

  /** Texto corto y legible, para que la pantalla no tenga que interpretar el JSON. */
  descripcion?: string;
}

/**
 * Parte del cliente de Prisma que este servicio necesita.
 *
 * Se declara asi para poder recibir tanto el PrismaService normal como el
 * cliente de una transaccion, y poder escribir la bitacora DENTRO de la
 * misma transaccion que hace el cambio. De ese modo no puede ocurrir que el
 * cambio quede guardado y la anotacion no.
 */
type ClienteDeBitacora = Pick<PrismaService, 'bitacoraCambio'>;

@Injectable()
export class BitacoraService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Anota un movimiento en la bitacora.
   *
   * Se espera el resultado y los errores se propagan a proposito: una
   * bitacora con huecos no sirve como evidencia, asi que es preferible que
   * la operacion falle a que quede sin rastro.
   *
   * Para incluirla en una transaccion, se le pasa el cliente de la
   * transaccion como segundo argumento:
   *
   *   await this.prisma.$transaction(async (tx) => {
   *     const creado = await tx.usuario.create({ ... });
   *     await this.bitacora.registrar({ ... }, tx);
   *   });
   */
  async registrar(movimiento: MovimientoDeBitacora, cliente?: ClienteDeBitacora): Promise<void> {
    const destino = cliente ?? this.prisma;

    await destino.bitacoraCambio.create({
      data: {
        usuarioId: movimiento.usuarioId,
        entidad: movimiento.entidad,
        registroAfectadoId: movimiento.registroAfectadoId,
        accion: movimiento.accion,
        funcionarioAfectadoId: movimiento.funcionarioAfectadoId,
        direccionIp: movimiento.direccionIp,
        // El casteo es necesario porque Prisma tipa las columnas Json con su
        // propio tipo y no acepta un Record<string, unknown> directo.
        datosAnteriores: movimiento.datosAnteriores as never,
        datosNuevos: movimiento.datosNuevos as never,
        descripcion: movimiento.descripcion,
      },
    });
  }

  /**
   * Consulta la bitacora con filtros y paginacion.
   *
   * Solo la usa quien tenga el permiso "bitacora.ver", que por decision de
   * la Municipalidad es unicamente el Super Administrador.
   *
   * Siempre se ordena de lo mas reciente a lo mas viejo: quien audita casi
   * siempre viene buscando algo que acaba de pasar.
   */
  async consultar(filtros: ConsultarBitacoraDto): Promise<PaginaDeResultados<unknown>> {
    const { pagina, tamano } = filtros;

    /**
     * Se arma el "where" pieza por pieza, agregando solo los filtros que
     * vinieron. Poner "undefined" en un campo hace que Prisma lo ignore, asi
     * que no hacen falta consultas distintas para cada combinacion.
     */
    const donde = {
      usuarioId: filtros.usuarioId,
      entidad: filtros.entidad,
      registroAfectadoId: filtros.registroAfectadoId,
      funcionarioAfectadoId: filtros.funcionarioAfectadoId,
      accion: filtros.accion,
      fechaHora:
        filtros.desde || filtros.hasta
          ? { gte: filtros.desde ? new Date(filtros.desde) : undefined, lte: filtros.hasta ? new Date(filtros.hasta) : undefined }
          : undefined,
    };

    /**
     * Las dos consultas van juntas en una transaccion para que el total y la
     * pagina correspondan al mismo momento. Si se hicieran por separado y
     * alguien escribiera en medio, el total no calzaria con lo devuelto.
     */
    const [total, movimientos] = await this.prisma.$transaction([
      this.prisma.bitacoraCambio.count({ where: donde }),
      this.prisma.bitacoraCambio.findMany({
        where: donde,
        orderBy: { fechaHora: 'desc' },
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: {
          id: true,
          fechaHora: true,
          accion: true,
          entidad: true,
          registroAfectadoId: true,
          descripcion: true,
          direccionIp: true,
          datosAnteriores: true,
          datosNuevos: true,
          // Del usuario solo su correo: jamas el hash de la contrasena ni
          // el resto de la fila.
          usuario: { select: { id: true, correo: true } },
          funcionarioAfectado: { select: { id: true, nombre: true, primerApellido: true } },
        },
      }),
    ]);

    return armarPagina(movimientos, total, pagina, tamano);
  }
}
