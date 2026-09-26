import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { CorreoService } from '../correo/correo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { duracionEnMilisegundos } from './cookie-sesion.js';
import type { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
import type { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto.js';
import type { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto.js';
import type { IniciarSesionDto } from './dto/iniciar-sesion.dto.js';
import { resolverAcceso, soloVigentes } from './permisos-efectivos.js';
import type { UsuarioAutenticado } from './tipos.js';

/** Intentos fallidos seguidos que bloquean la cuenta. */
const MAXIMO_INTENTOS = 3;

/** Cuanto dura ese bloqueo, en minutos. */
const MINUTOS_BLOQUEO = 3;

/**
 * Vigencia del codigo de recuperacion, en minutos.
 * La pantalla del prototipo aprobado dice "vence en 15 minutos".
 */
const MINUTOS_VIGENCIA_CODIGO = 15;

/**
 * Lo que el servicio le entrega al controlador. El token no llega asi al
 * navegador: el controlador lo guarda en la cookie de sesion.
 */
export interface SesionIniciada {
  token: string;
  duracionMs: number;
  usuario: {
    id: string;
    correo: string;
    debeCambiarContrasena: boolean;
  };
}

/** Contenido del token. Minimo, sin datos sensibles y sin permisos. */
export interface ContenidoToken {
  sub: string;
  correo: string;
}

@Injectable()
export class AutenticacionService {
  private readonly registro = new Logger(AutenticacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly correo: CorreoService,
    private readonly bitacora: BitacoraService,
  ) {}

  async iniciarSesion(datos: IniciarSesionDto): Promise<SesionIniciada> {
    const correo = datos.correo.trim().toLowerCase();

    // "select" explicito: la consulta trae lo justo. Asi el hash de la
    // contrasena no puede escaparse por accidente hacia la respuesta.
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: {
        id: true,
        correo: true,
        contrasenaHash: true,
        estado: true,
        debeCambiarContrasena: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
      },
    });

    // Si el correo no existe se responde igual que si la contrasena estuviera
    // mal: no se le confirma a nadie que una cuenta existe.
    if (!usuario) {
      throw this.credencialesInvalidas();
    }

    if (usuario.estado === 'inactivo') {
      throw new UnauthorizedException({
        codigo: 'CUENTA_INACTIVA',
        message: 'La cuenta está inactiva. Comuníquese con Recursos Humanos.',
      });
    }

    if (usuario.estado === 'bloqueado') {
      throw new UnauthorizedException({
        codigo: 'CUENTA_BLOQUEADA_POR_ADMINISTRADOR',
        message: 'La cuenta está bloqueada. Comuníquese con Recursos Humanos.',
      });
    }

    const ahora = new Date();

    // Bloqueo temporal por intentos fallidos. Se revisa antes de gastar
    // tiempo verificando la contrasena.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      const segundosRestantes = Math.ceil((usuario.bloqueadoHasta.getTime() - ahora.getTime()) / 1000);
      throw new UnauthorizedException({
        codigo: 'CUENTA_BLOQUEADA_TEMPORALMENTE',
        message: `Demasiados intentos fallidos. Vuelva a intentar en ${Math.ceil(segundosRestantes / 60)} minuto(s).`,
        segundosRestantes,
      });
    }

    const contrasenaCorrecta = await argon2.verify(usuario.contrasenaHash, datos.contrasena);

    if (!contrasenaCorrecta) {
      await this.anotarIntentoFallido(usuario.id, usuario.intentosFallidos);
      throw this.credencialesInvalidas();
    }

    // Ingreso correcto: se limpia el contador y se anota la fecha de acceso.
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: ahora },
    });

    const contenido: ContenidoToken = { sub: usuario.id, correo: usuario.correo };
    const token = await this.jwt.signAsync(contenido);

    // Se registra el identificador, nunca el correo, la contrasena ni el token.
    this.registro.log(`Ingreso correcto del usuario ${usuario.id}`);

    return {
      token,
      duracionMs: duracionEnMilisegundos(process.env.JWT_EXPIRACION ?? '8h'),
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        debeCambiarContrasena: usuario.debeCambiarContrasena,
      },
    };
  }

  /**
   * Suma un intento fallido y, al llegar al tope, bloquea la cuenta.
   * El contador vuelve a cero junto con el bloqueo para que al vencer los
   * tres minutos la persona tenga de nuevo sus tres oportunidades.
   */
  private async anotarIntentoFallido(usuarioId: string, intentosPrevios: number): Promise<void> {
    const intentos = intentosPrevios + 1;

    if (intentos >= MAXIMO_INTENTOS) {
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          intentosFallidos: 0,
          bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000),
        },
      });
      return;
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { intentosFallidos: intentos },
    });
  }

  /**
   * Cambia la contrasena de la persona que tiene la sesion abierta.
   *
   * Sirve para los dos casos: el cambio obligatorio del primer ingreso y el
   * cambio voluntario desde "Mi cuenta". Es el mismo flujo, asi que es el
   * mismo metodo.
   *
   * El identificador del usuario NO viene del cuerpo de la peticion sino de
   * la sesion, para que nadie pueda cambiarle la contrasena a otra persona.
   */
  async cambiarContrasenaPropia(
    usuarioId: string,
    datos: CambiarContrasenaDto,
    direccionIp?: string,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, contrasenaHash: true },
    });

    if (!usuario) {
      throw this.credencialesInvalidas();
    }

    // Se exige la contrasena actual aunque la sesion este abierta: si alguien
    // deja la computadora desbloqueada, no deberia poder adueniarse de la
    // cuenta cambiandole la contrasena.
    const actualCorrecta = await argon2.verify(usuario.contrasenaHash, datos.contrasenaActual);

    if (!actualCorrecta) {
      throw new UnauthorizedException({
        codigo: 'CONTRASENA_ACTUAL_INCORRECTA',
        message: 'La contraseña actual no es correcta.',
      });
    }

    // Cambiarla por la misma no cambia nada, y en el primer ingreso dejaria
    // la cuenta con la contrasena que Recursos Humanos ya conoce.
    const esLaMisma = await argon2.verify(usuario.contrasenaHash, datos.contrasenaNueva);

    if (esLaMisma) {
      throw new BadRequestException({
        codigo: 'CONTRASENA_REPETIDA',
        message: 'La contraseña nueva debe ser distinta de la actual.',
      });
    }

    const nuevoHash = await argon2.hash(datos.contrasenaNueva, { type: argon2.argon2id });

    /**
     * El cambio y su anotacion van en la misma transaccion, para que no
     * pueda quedar la contrasena cambiada sin rastro de quien lo hizo ni
     * cuando.
     *
     * A la bitacora NO entra ninguna contrasena, ni la vieja ni la nueva ni
     * sus hashes: solo queda constancia de que hubo un cambio.
     */
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          contrasenaHash: nuevoHash,
          // Con esto la persona deja de estar limitada al cambio obligatorio.
          debeCambiarContrasena: false,
          // Si venia con intentos fallidos o bloqueada, se le limpia: acaba
          // de demostrar que es la duenia de la cuenta.
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });

      await this.bitacora.registrar(
        {
          usuarioId: usuario.id,
          entidad: 'usuario',
          registroAfectadoId: usuario.id,
          accion: 'modificar',
          direccionIp,
          descripcion: 'Cambió su propia contraseña desde el sistema.',
        },
        tx,
      );
    });

    // Se registra el identificador, nunca las contrasenas.
    this.registro.log(`El usuario ${usuario.id} cambió su contraseña`);
  }

  /**
   * Paso 1 de la recuperacion: envia un codigo de un solo uso al correo.
   *
   * Este metodo NUNCA falla por cuenta inexistente ni avisa nada al
   * respecto. Si respondiera distinto segun exista o no el correo, alguien
   * podria usarlo para averiguar que direcciones estan registradas en la
   * Municipalidad. El controlador siempre devuelve el mismo mensaje.
   */
  async solicitarRecuperacion(datos: SolicitarRecuperacionDto): Promise<void> {
    const correo = datos.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: { id: true, correo: true, estado: true },
    });

    // Cuenta inexistente o inactiva: se corta en silencio.
    if (!usuario || usuario.estado !== 'activo') {
      return;
    }

    // Codigo de 6 digitos, como lo muestra la pantalla del prototipo.
    // randomInt viene de node:crypto: Math.random es predecible y no sirve
    // para nada relacionado con seguridad.
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');

    const vencimiento = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * 60_000);
    const codigoHash = await argon2.hash(codigo, { type: argon2.argon2id });

    /**
     * Las dos operaciones van juntas en una transaccion: se anulan los
     * codigos anteriores que siguieran vigentes y se crea el nuevo. Si
     * fallara la segunda, no queremos quedarnos sin ninguno valido.
     *
     * Anular los anteriores importa: si no, cada solicitud dejaria un codigo
     * mas dando vueltas y habria varios sirviendo al mismo tiempo.
     */
    await this.prisma.$transaction([
      this.prisma.tokenRecuperacionContrasena.updateMany({
        where: { usuarioId: usuario.id, fechaUso: null },
        data: { fechaUso: new Date() },
      }),
      this.prisma.tokenRecuperacionContrasena.create({
        data: { usuarioId: usuario.id, codigoHash, fechaExpiracion: vencimiento },
      }),
    ]);

    await this.correo.enviar({
      para: usuario.correo,
      asunto: 'SIGEL - Código para recuperar su contraseña',
      cuerpo: [
        'Buen día,',
        '',
        `Su código para recuperar la contraseña de SIGEL es: ${codigo}`,
        '',
        `El código vence en ${MINUTOS_VIGENCIA_CODIGO} minutos y solo se puede usar una vez.`,
        'Si usted no solicitó este cambio, ignore este mensaje: su contraseña sigue igual.',
        '',
        'Municipalidad de Palmares',
      ].join('\n'),
    });

    // Se registra la cuenta, jamas el codigo.
    this.registro.log(`Se envió un código de recuperación al usuario ${usuario.id}`);
  }

  /**
   * Paso 2 de la recuperacion: cambia la contrasena usando el codigo.
   *
   * Todos los motivos de fallo devuelven el mismo error a proposito. Si se
   * distinguiera "el codigo vencio" de "el codigo esta mal", se le estaria
   * dando pistas a quien esta probando codigos al azar.
   */
  async restablecerContrasenaConCodigo(
    datos: RestablecerContrasenaDto,
    direccionIp?: string,
  ): Promise<void> {
    const correo = datos.correo.trim().toLowerCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      select: { id: true, estado: true, contrasenaHash: true },
    });

    if (!usuario || usuario.estado !== 'activo') {
      throw this.codigoInvalido();
    }

    // El mas reciente que siga sin usarse y sin vencer.
    const token = await this.prisma.tokenRecuperacionContrasena.findFirst({
      where: {
        usuarioId: usuario.id,
        fechaUso: null,
        fechaExpiracion: { gt: new Date() },
      },
      orderBy: { fechaCreacion: 'desc' },
      select: { id: true, codigoHash: true },
    });

    if (!token) {
      throw this.codigoInvalido();
    }

    const codigoCorrecto = await argon2.verify(token.codigoHash, datos.codigo.trim());

    if (!codigoCorrecto) {
      throw this.codigoInvalido();
    }

    /**
     * La contrasena nueva tiene que ser distinta de la anterior.
     *
     * Se comprueba DESPUES de validar el codigo, nunca antes: si se hiciera
     * al reves, alguien podria averiguar la contrasena de una cuenta ajena
     * probando valores y mirando cual de los dos errores le responde el
     * sistema, sin tener el codigo.
     */
    const esLaMisma = await argon2.verify(usuario.contrasenaHash, datos.contrasenaNueva);

    if (esLaMisma) {
      throw new BadRequestException({
        codigo: 'CONTRASENA_REPETIDA',
        message: 'La contraseña nueva debe ser distinta de la anterior.',
      });
    }

    /**
     * Transaccion otra vez: se cambia la contrasena y se marca el codigo
     * como usado. Si lo segundo fallara, el mismo codigo podria volver a
     * usarse mas tarde.
     *
     * debeCambiarContrasena queda en false, a diferencia del restablecimiento
     * que hace un administrador: aqui la persona ya eligio su contrasena, no
     * tiene sentido pedirle que la cambie de nuevo al entrar.
     */
    const nuevoHash = await argon2.hash(datos.contrasenaNueva, { type: argon2.argon2id });

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          contrasenaHash: nuevoHash,
          debeCambiarContrasena: false,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });

      await tx.tokenRecuperacionContrasena.update({
        where: { id: token.id },
        data: { fechaUso: new Date() },
      });

      /**
       * Este es el movimiento mas importante de los dos que se auditan aqui:
       * si alguien llegara a recuperar una cuenta ajena, este es el rastro
       * que lo muestra, con la fecha y la direccion desde donde se hizo.
       */
      await this.bitacora.registrar(
        {
          usuarioId: usuario.id,
          entidad: 'usuario',
          registroAfectadoId: usuario.id,
          accion: 'modificar',
          direccionIp,
          descripcion: 'Restableció su contraseña con un código enviado al correo.',
        },
        tx,
      );
    });

    this.registro.log(`El usuario ${usuario.id} restableció su contraseña con un código`);
  }

  private codigoInvalido(): BadRequestException {
    return new BadRequestException({
      codigo: 'CODIGO_INVALIDO',
      message: 'El código no es válido o ya venció. Solicite uno nuevo.',
    });
  }

  /**
   * Arma el usuario que usan el guard y los controladores, con sus permisos
   * ya resueltos.
   *
   * El calculo es: los permisos de sus roles activos, mas los concedidos de
   * forma individual, menos los revocados de forma individual. El permiso
   * individual manda sobre el del rol, en los dos sentidos.
   *
   * Devuelve null si la cuenta ya no existe o dejo de estar activa, y en ese
   * caso el guard corta la sesion.
   */
  async cargarUsuarioAutenticado(usuarioId: string): Promise<UsuarioAutenticado | null> {
    /**
     * Solo cuentan las asignaciones vigentes. Las vencidas se quedan en la
     * base, porque son historia de quien tuvo que acceso, pero dejan de dar
     * permisos en el mismo instante en que vencen, sin que nadie las quite.
     */
    const vigente = soloVigentes();

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        estado: true,
        funcionarioId: true,
        debeCambiarContrasena: true,
        roles: {
          where: vigente,
          select: {
            rol: {
              select: {
                nombre: true,
                activo: true,
                permisos: { select: { permiso: { select: { clave: true, activo: true } } } },
              },
            },
          },
        },
        permisos: {
          where: vigente,
          select: { otorgado: true, permiso: { select: { clave: true, activo: true } } },
        },
      },
    });

    if (!usuario || usuario.estado !== 'activo') {
      return null;
    }

    // El calculo vive en permisos-efectivos.ts, compartido con la gestion
    // de usuarios para que los dos lados resuelvan el acceso igual.
    const { roles, permisos } = resolverAcceso(usuario.roles, usuario.permisos);

    return {
      id: usuario.id,
      correo: usuario.correo,
      funcionarioId: usuario.funcionarioId,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
      roles,
      permisos,
    };
  }

  private credencialesInvalidas(): UnauthorizedException {
    return new UnauthorizedException({
      codigo: 'CREDENCIALES_INVALIDAS',
      message: 'Correo o contraseña incorrectos.',
    });
  }
}
