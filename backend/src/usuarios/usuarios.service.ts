import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { generarContrasenaTemporal } from '../autenticacion/contrasena-temporal.js';
import { resolverAcceso, soloVigentes } from '../autenticacion/permisos-efectivos.js';
import { permisosQueFaltan } from '../autenticacion/reparto-de-acceso.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { CorreoService } from '../correo/correo.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import type { ConsultarUsuariosDto, EstadoDeUsuario } from './dto/consultar-usuarios.dto.js';
import type { CrearUsuarioDto, RolAsignadoDto } from './dto/crear-usuario.dto.js';

/** Rol que ya paso todas las validaciones y se puede asignar. */
interface RolValidado {
  id: string;
  nombre: string;
  fechaVencimiento: Date | null;
}

/**
 * Lo que devuelve la creacion de una cuenta.
 *
 * Incluye la contrasena temporal en claro, una unica vez, para que Recursos
 * Humanos pueda entregarla si el correo no llega. Nunca se guarda asi: en la
 * base solo queda su hash, y en la bitacora ni eso.
 */
export interface CuentaCreada {
  id: string;
  correo: string;
  funcionarioId: string;
  roles: RolValidado[];
  contrasenaTemporal: string;
}

/**
 * Gestion de las cuentas de usuario del sistema.
 *
 * Regla que no se rompe en ningun metodo de este servicio: el campo
 * "contrasenaHash" NUNCA entra en un "select". Ni para compararlo, ni para
 * devolverlo, ni por comodidad. Lo unico que toca ese campo es el modulo de
 * autenticacion.
 */
@Injectable()
export class UsuariosService {
  private readonly registro = new Logger(UsuariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly correo: CorreoService,
  ) {}

  /**
   * Lista las cuentas con busqueda, filtros y paginacion.
   *
   * La busqueda por texto revisa el correo de la cuenta y, cuando esta ligada
   * a un funcionario, tambien su cedula, nombre y apellidos. Asi Recursos
   * Humanos puede buscar tanto por "mjimenez@" como por "Maria" o por la
   * cedula, que es como la gente busca en la practica.
   *
   * No hace falta indicar que no distinga mayusculas: la intercalacion por
   * omision de MySQL 8 ya ignora mayusculas y tildes al comparar.
   */
  async consultar(filtros: ConsultarUsuariosDto): Promise<PaginaDeResultados<unknown>> {
    const { pagina, tamano } = filtros;
    const texto = filtros.busqueda?.trim();

    // Una asignacion vencida ya no cuenta: ni para filtrar ni para mostrar.
    const vigente = soloVigentes();

    const donde = {
      estado: filtros.estado,
      // "some" = que tenga al menos un rol VIGENTE con ese identificador.
      roles: filtros.rolId ? { some: { rolId: filtros.rolId, ...vigente } } : undefined,
      // "OR" solo se arma si vino texto; si no, se deja fuera del filtro.
      OR: texto
        ? [
            { correo: { contains: texto } },
            { funcionario: { cedula: { contains: texto } } },
            { funcionario: { nombre: { contains: texto } } },
            { funcionario: { primerApellido: { contains: texto } } },
            { funcionario: { segundoApellido: { contains: texto } } },
          ]
        : undefined,
    };

    /**
     * El conteo y la pagina van en la misma transaccion para que el total
     * corresponda exactamente a lo que se esta devolviendo.
     */
    const [total, usuarios] = await this.prisma.$transaction([
      this.prisma.usuario.count({ where: donde }),
      this.prisma.usuario.findMany({
        where: donde,
        // Por correo, que es como se ve ordenada la lista en pantalla.
        orderBy: { correo: 'asc' },
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: {
          id: true,
          correo: true,
          estado: true,
          debeCambiarContrasena: true,
          // Sirve para que Recursos Humanos vea de un vistazo quien esta
          // bloqueado en este momento y no tenga que adivinarlo.
          bloqueadoHasta: true,
          ultimoAcceso: true,
          fechaCreacion: true,
          funcionario: {
            select: {
              id: true,
              cedula: true,
              nombre: true,
              primerApellido: true,
              segundoApellido: true,
            },
          },
          roles: {
            where: vigente,
            select: { rol: { select: { id: true, nombre: true } } },
          },
        },
      }),
    ]);

    // Se aplana la tabla intermedia: al frontend le llega una lista de roles,
    // no una lista de asignaciones.
    const datos = usuarios.map((usuario) => ({
      ...usuario,
      roles: usuario.roles.map((asignacion) => asignacion.rol),
    }));

    return armarPagina(datos, total, pagina, tamano);
  }

  /**
   * Devuelve una cuenta con el detalle que necesita la pantalla de edicion:
   * sus roles y sus permisos individuales.
   *
   * A diferencia de la lista, aqui SI se muestran las asignaciones vencidas,
   * marcadas con "vigente: false". Quien administra necesita ver, por
   * ejemplo, que una suplencia ya termino y cuando.
   *
   * Los permisos individuales se muestran tal como estan guardados, con su
   * bandera "otorgado", porque un permiso individual puede tanto conceder
   * algo que el rol no da como quitar algo que el rol si da.
   */
  async consultarUno(usuarioId: string): Promise<unknown> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        estado: true,
        debeCambiarContrasena: true,
        bloqueadoHasta: true,
        intentosFallidos: true,
        ultimoAcceso: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        funcionario: {
          select: {
            id: true,
            cedula: true,
            nombre: true,
            primerApellido: true,
            segundoApellido: true,
            correoInstitucional: true,
          },
        },
        roles: {
          select: {
            fechaAsignacion: true,
            fechaVencimiento: true,
            rol: { select: { id: true, nombre: true, descripcion: true } },
          },
        },
        permisos: {
          select: {
            otorgado: true,
            observacion: true,
            fechaAsignacion: true,
            fechaVencimiento: true,
            permiso: { select: { id: true, clave: true, modulo: true, descripcion: true } },
          },
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        message: 'No se encontro la cuenta indicada.',
      });
    }

    const ahora = new Date();
    const estaVigente = (vence: Date | null): boolean => vence === null || vence > ahora;

    return {
      ...usuario,
      roles: usuario.roles.map((asignacion) => ({
        ...asignacion.rol,
        fechaAsignacion: asignacion.fechaAsignacion,
        fechaVencimiento: asignacion.fechaVencimiento,
        vigente: estaVigente(asignacion.fechaVencimiento),
      })),
      permisos: usuario.permisos.map((asignacion) => ({
        ...asignacion.permiso,
        otorgado: asignacion.otorgado,
        observacion: asignacion.observacion,
        fechaAsignacion: asignacion.fechaAsignacion,
        fechaVencimiento: asignacion.fechaVencimiento,
        vigente: estaVigente(asignacion.fechaVencimiento),
      })),
    };
  }

  /**
   * Crea una cuenta de usuario para un funcionario.
   *
   * Hace dos cosas, en este orden:
   *   1. Crea la cuenta dentro de una transaccion (ver crearCuentaEnTransaccion).
   *   2. Ya confirmada la transaccion, envia el correo de bienvenida.
   *
   * El correo va DESPUES y por fuera a proposito: si el servidor de correo
   * fallara, no tiene sentido deshacer la cuenta. Recursos Humanos igual
   * recibe la contrasena temporal en la respuesta y puede entregarla.
   */
  async crear(
    datos: CrearUsuarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<CuentaCreada> {
    const creada = await this.prisma.$transaction((tx) =>
      this.crearCuentaEnTransaccion(tx, datos, quienActua, direccionIp),
    );

    await this.enviarBienvenida(creada);
    return creada;
  }

  /**
   * El trabajo real de crear una cuenta, dentro de una transaccion ajena.
   *
   * Es publico porque lo va a reutilizar el registro de funcionarios: cuando
   * Recursos Humanos marque "crear tambien su cuenta", el funcionario y la
   * cuenta se crean en la MISMA transaccion. Si algo falla, no queda ni el
   * uno ni la otra. Quien lo llame debe invocar enviarBienvenida() despues
   * de que su transaccion termine bien.
   */
  async crearCuentaEnTransaccion(
    tx: Prisma.TransactionClient,
    datos: CrearUsuarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<CuentaCreada> {
    // ---- 1. El funcionario existe, esta activo y todavia no tiene cuenta ----
    const funcionario = await tx.funcionario.findUnique({
      where: { id: datos.funcionarioId },
      select: {
        id: true,
        estado: true,
        nombre: true,
        primerApellido: true,
        correoInstitucional: true,
        usuario: { select: { id: true } },
      },
    });

    if (!funcionario) {
      throw new NotFoundException({
        codigo: 'FUNCIONARIO_NO_ENCONTRADO',
        message: 'No se encontro el funcionario indicado.',
      });
    }

    if (funcionario.estado !== 'activo') {
      throw new BadRequestException({
        codigo: 'FUNCIONARIO_INACTIVO',
        message: 'No se puede crear una cuenta para un funcionario inactivo.',
      });
    }

    if (funcionario.usuario) {
      throw new ConflictException({
        codigo: 'FUNCIONARIO_YA_TIENE_CUENTA',
        message: 'Este funcionario ya tiene una cuenta de usuario.',
      });
    }

    // ---- 2. El correo de ingreso: el indicado o el institucional ----
    const correo = (datos.correo ?? funcionario.correoInstitucional ?? '').trim().toLowerCase();

    if (!correo) {
      throw new BadRequestException({
        codigo: 'CORREO_REQUERIDO',
        message: 'El funcionario no tiene correo institucional registrado. Indique el correo de ingreso.',
      });
    }

    const ocupado = await tx.usuario.findUnique({ where: { correo }, select: { id: true } });

    if (ocupado) {
      throw new ConflictException({
        codigo: 'CORREO_EN_USO',
        message: 'Ese correo ya esta en uso por otra cuenta.',
      });
    }

    // ---- 3. Los roles existen y quien actua tiene derecho a darlos ----
    const roles = await this.validarRolesAsignables(tx, datos.roles, quienActua);

    // ---- 4. Se crea la cuenta con sus roles ----
    const contrasenaTemporal = generarContrasenaTemporal();

    const usuario = await tx.usuario.create({
      data: {
        correo,
        contrasenaHash: await argon2.hash(contrasenaTemporal, { type: argon2.argon2id }),
        // Obliga a cambiar la contrasena en el primer ingreso: la temporal la
        // conocio Recursos Humanos y no debe seguir sirviendo.
        debeCambiarContrasena: true,
        funcionarioId: funcionario.id,
        roles: {
          create: roles.map((rol) => ({
            rolId: rol.id,
            fechaVencimiento: rol.fechaVencimiento,
            asignadoPorId: quienActua.id,
          })),
        },
      },
      select: { id: true, correo: true },
    });

    // ---- 5. Queda en la bitacora, sin la contrasena ----
    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        entidad: 'usuario',
        registroAfectadoId: usuario.id,
        accion: 'crear',
        funcionarioAfectadoId: funcionario.id,
        direccionIp,
        datosNuevos: {
          correo: usuario.correo,
          roles: roles.map((rol) => ({
            nombre: rol.nombre,
            fechaVencimiento: rol.fechaVencimiento?.toISOString() ?? null,
          })),
        },
        descripcion: `Creo la cuenta ${usuario.correo} para ${funcionario.nombre} ${funcionario.primerApellido}.`,
      },
      tx,
    );

    return {
      id: usuario.id,
      correo: usuario.correo,
      funcionarioId: funcionario.id,
      roles: roles.map(({ id, nombre, fechaVencimiento }) => ({ id, nombre, fechaVencimiento })),
      contrasenaTemporal,
    };
  }

  /**
   * Avisa por correo a la persona que ya tiene cuenta, con su contrasena
   * temporal.
   *
   * Si el envio falla, NO se lanza el error: la cuenta ya existe y Recursos
   * Humanos tiene la contrasena en la respuesta. Se deja constancia en el
   * registro del servidor para que TI lo revise.
   */
  async enviarBienvenida(cuenta: CuentaCreada): Promise<void> {
    try {
      await this.correo.enviar({
        para: cuenta.correo,
        asunto: 'SIGEL - Su cuenta de acceso',
        cuerpo: [
          'Buen dia,',
          '',
          'Recursos Humanos creo su cuenta en SIGEL, el Sistema Integral de Gestion Laboral.',
          '',
          `Correo de ingreso:     ${cuenta.correo}`,
          `Contrasena temporal:   ${cuenta.contrasenaTemporal}`,
          '',
          'La primera vez que ingrese, el sistema le pedira cambiar esta contrasena por una propia.',
          '',
          'Municipalidad de Palmares',
        ].join('\n'),
      });
    } catch (error) {
      this.registro.error(
        `No se pudo enviar el correo de bienvenida a la cuenta ${cuenta.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Comprueba que los roles pedidos existan, esten activos, no se repitan,
   * tengan una fecha de vencimiento futura si la traen y, sobre todo, que
   * quien actua tenga derecho a darlos.
   *
   * Ese ultimo punto es la regla 1 de reparto de acceso: asignar un rol exige
   * tener TODOS sus permisos. Es lo que impide que Recursos Humanos cree un
   * Super Administrador, sin tener que escribir el nombre de ese rol en
   * ninguna parte del codigo.
   */
  private async validarRolesAsignables(
    tx: Prisma.TransactionClient,
    pedidos: RolAsignadoDto[],
    quienActua: UsuarioAutenticado,
  ): Promise<RolValidado[]> {
    const ids = pedidos.map((pedido) => pedido.rolId);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        codigo: 'ROL_REPETIDO',
        message: 'Un mismo rol aparece mas de una vez.',
      });
    }

    const encontrados = await tx.rol.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        nombre: true,
        activo: true,
        permisos: { select: { permiso: { select: { clave: true, activo: true } } } },
      },
    });

    const porId = new Map(encontrados.map((rol) => [rol.id, rol]));
    const ahora = new Date();

    return pedidos.map((pedido) => {
      const rol = porId.get(pedido.rolId);

      if (!rol) {
        throw new NotFoundException({
          codigo: 'ROL_NO_ENCONTRADO',
          message: 'Alguno de los roles indicados no existe.',
        });
      }

      if (!rol.activo) {
        throw new BadRequestException({
          codigo: 'ROL_INACTIVO',
          message: `El rol "${rol.nombre}" esta inactivo y no se puede asignar.`,
        });
      }

      // Regla 1: solo se da lo que se tiene.
      const requeridos = rol.permisos
        .filter((asignado) => asignado.permiso.activo)
        .map((asignado) => asignado.permiso.clave);

      if (permisosQueFaltan(quienActua.permisos, requeridos).length > 0) {
        throw new ForbiddenException({
          codigo: 'ROL_NO_ASIGNABLE',
          message: `No puede asignar el rol "${rol.nombre}" porque incluye permisos que usted no tiene.`,
        });
      }

      let fechaVencimiento: Date | null = null;

      if (pedido.fechaVencimiento) {
        fechaVencimiento = new Date(pedido.fechaVencimiento);

        // Una suplencia que ya vencio no tiene sentido: seria un rol que nace
        // sin dar ningun permiso.
        if (fechaVencimiento <= ahora) {
          throw new BadRequestException({
            codigo: 'FECHA_VENCIMIENTO_PASADA',
            message: `La fecha de vencimiento del rol "${rol.nombre}" debe ser futura.`,
          });
        }
      }

      return { id: rol.id, nombre: rol.nombre, fechaVencimiento };
    });
  }

  /**
   * Activa, inactiva o bloquea una cuenta.
   *
   * El efecto es inmediato: el guard de sesion vuelve a leer la cuenta en
   * cada peticion, asi que una cuenta inactivada queda fuera en su siguiente
   * clic, sin esperar a que se le venza la sesion.
   *
   * Aplica dos de las reglas de reparto de acceso:
   *   Regla 4: nadie cambia el estado de su propia cuenta. Evita tanto que
   *            alguien se desbloquee a si mismo como que se deje fuera por
   *            error.
   *   Regla 3: no se toca a quien tiene mas acceso que uno. Asi Recursos
   *            Humanos no puede inactivar al Super Administrador.
   */
  async cambiarEstado(
    usuarioId: string,
    datos: CambiarEstadoUsuarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<{ id: string; correo: string; estado: EstadoDeUsuario }> {
    // Regla 4. Se revisa antes de ir a la base: no hace falta consultar nada.
    if (usuarioId === quienActua.id) {
      throw new ForbiddenException({
        codigo: 'NO_PUEDE_MODIFICAR_SU_PROPIA_CUENTA',
        message: 'No puede cambiar el estado de su propia cuenta. Debe hacerlo otra persona.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);

      // Regla 3.
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      if (destino.estado === datos.estado) {
        throw new BadRequestException({
          codigo: 'ESTADO_SIN_CAMBIO',
          message: `La cuenta ya esta en estado "${datos.estado}".`,
        });
      }

      const actualizada = await tx.usuario.update({
        where: { id: destino.id },
        data: {
          estado: datos.estado,
          // Al reactivar se limpia tambien el bloqueo temporal por intentos
          // fallidos: si Recursos Humanos la habilita, es para que pueda
          // entrar ya, no dentro de tres minutos.
          ...(datos.estado === 'activo' ? { intentosFallidos: 0, bloqueadoHasta: null } : {}),
        },
        select: { id: true, correo: true, estado: true },
      });

      const motivo = datos.motivo?.trim();

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'usuario',
          registroAfectadoId: destino.id,
          accion: 'modificar',
          funcionarioAfectadoId: destino.funcionarioId ?? undefined,
          direccionIp,
          datosAnteriores: { estado: destino.estado },
          datosNuevos: { estado: actualizada.estado, ...(motivo ? { motivo } : {}) },
          descripcion:
            `Cambio el estado de la cuenta ${destino.correo} de "${destino.estado}" a "${actualizada.estado}"` +
            (motivo ? `. Motivo: ${motivo}` : '.'),
        },
        tx,
      );

      return actualizada;
    });
  }

  /**
   * Trae una cuenta con lo necesario para calcular su acceso real.
   *
   * El "select" de roles y permisos tiene la misma forma que el del guard
   * (autenticacion.service.ts, cargarUsuarioAutenticado), porque los dos se
   * pasan a resolverAcceso(). Si se cambia uno, cambiar el otro.
   */
  private async cargarCuentaConAcceso(tx: Prisma.TransactionClient, usuarioId: string) {
    const vigente = soloVigentes();

    const cuenta = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        estado: true,
        funcionarioId: true,
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

    if (!cuenta) {
      throw new NotFoundException({
        codigo: 'USUARIO_NO_ENCONTRADO',
        message: 'No se encontro la cuenta indicada.',
      });
    }

    return cuenta;
  }

  /**
   * Regla 3 de reparto de acceso: no se toca a quien tiene mas acceso que
   * uno. Si la cuenta destino tiene aunque sea un permiso que quien actua no
   * tiene, la operacion se rechaza.
   *
   * Se compara contra el acceso REAL de la cuenta (roles vigentes mas
   * permisos individuales), calculado igual que en el guard.
   */
  private verificarQueNoTengaMasAcceso(
    destino: Awaited<ReturnType<UsuariosService['cargarCuentaConAcceso']>>,
    quienActua: UsuarioAutenticado,
  ): void {
    const { permisos } = resolverAcceso(destino.roles, destino.permisos);

    if (permisosQueFaltan(quienActua.permisos, permisos).length > 0) {
      throw new ForbiddenException({
        codigo: 'CUENTA_CON_MAYOR_ACCESO',
        message: 'No puede modificar una cuenta que tiene permisos que usted no tiene.',
      });
    }
  }
}
