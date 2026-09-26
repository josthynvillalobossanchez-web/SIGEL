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
import { formatearFechaCostaRica, interpretarFechaDeVencimiento, validarFechaDeVencimiento } from '../comun/fechas.js';
import { CorreoService } from '../correo/correo.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import type { ConsultarUsuariosDto, EstadoDeUsuario } from './dto/consultar-usuarios.dto.js';
import type { CrearUsuarioDto, RolAsignadoDto } from './dto/crear-usuario.dto.js';
import type { AjustarPermisoDto } from './dto/ajustar-permiso.dto.js';
import type { AjustarVariosPermisosDto } from './dto/ajustar-varios-permisos.dto.js';
import type { EditarUsuarioDto } from './dto/editar-usuario.dto.js';

/* ------------------------------------------------------------------ */
/* Ayudantes de fechas (solo de este archivo)                          */
/* ------------------------------------------------------------------ */

/** Una asignacion cuenta si no tiene vencimiento o si todavia no llega. */
function estaVigente(vence: Date | null): boolean {
  return vence === null || vence > new Date();
}

/** Compara dos fechas opcionales al milisegundo (null solo es igual a null). */
function mismaFecha(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

/** Error de la regla "al menos un rol permanente" (pedido de Josthyn, 26/09). */
function errorSinRolPermanente(): BadRequestException {
  return new BadRequestException({
    codigo: 'CUENTA_SIN_ROL_PERMANENTE',
    message:
      'La cuenta debe conservar al menos un rol permanente (sin fecha de vencimiento). ' +
      'Si todos sus roles vencen, llegaría el día en que se queda sin acceso.',
  });
}

/**
 * Convierte el texto de una fecha de vencimiento en Date y exige que sea
 * futura. Sin texto devuelve null (permanente). "2026-10-31" significa
 * "hasta el final del 31 de octubre en Costa Rica" (ver comun/fechas.ts).
 */
function convertirEnFechaFutura(texto: string | undefined, deQue: string): Date | null {
  if (!texto) return null;
  return validarFechaDeVencimiento(texto, deQue);
}

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
  async consultar(filtros: ConsultarUsuariosDto, quienActua?: UsuarioAutenticado): Promise<PaginaDeResultados<unknown>> {
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
            select: {
              rol: {
                select: {
                  id: true,
                  nombre: true,
                  activo: true,
                  permisos: { select: { permiso: { select: { clave: true, activo: true } } } },
                },
              },
            },
          },
          // Solo para calcular el acceso real (regla 3); no se devuelven.
          permisos: {
            where: vigente,
            select: { otorgado: true, permiso: { select: { clave: true, activo: true } } },
          },
        },
      }),
    ]);

    // Se aplana la tabla intermedia: al frontend le llega una lista de roles,
    // no una lista de asignaciones. Ademas, para cada cuenta se dice si quien
    // consulta la puede modificar, asi la pantalla muestra los botones de
    // accion habilitados o bloqueados con su explicacion.
    const datos = usuarios.map(({ permisos, roles, ...usuario }) => ({
      ...usuario,
      roles: roles.map((asignacion) => ({ id: asignacion.rol.id, nombre: asignacion.rol.nombre })),
      motivoNoModificable: this.motivoNoModificable(usuario.id, resolverAcceso(roles, permisos).permisos, quienActua),
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
  async consultarUno(usuarioId: string, quienActua?: UsuarioAutenticado): Promise<unknown> {
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
        message: 'No se encontró la cuenta indicada.',
      });
    }

    // Acceso real de la cuenta (el mismo calculo del guard) y si quien
    // consulta puede modificarla. La pantalla lo usa para mostrar u ocultar
    // los botones; el backend igual lo vuelve a revisar en cada cambio.
    const conAcceso = await this.cargarCuentaConAcceso(this.prisma, usuarioId);
    const { permisos: permisosEfectivos } = resolverAcceso(conAcceso.roles, conAcceso.permisos);

    const motivoNoModificable = this.motivoNoModificable(usuarioId, permisosEfectivos, quienActua);

    return {
      ...usuario,
      permisosEfectivos,
      puedoModificar: quienActua ? motivoNoModificable === null : false,
      motivoNoModificable,
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
   * Funcionarios a los que se les puede crear una cuenta: activos y que
   * todavia no tienen una. Maximo 20 resultados, ordenados por apellido.
   *
   * Existe para la pantalla "Crear usuario" (elegir a quien). No es el
   * modulo de funcionarios: devuelve lo minimo para reconocer a la persona.
   * Cuando exista el registro de funcionarios, la cuenta tambien se podra
   * crear desde ahi (crearCuentaEnTransaccion).
   */
  async buscarFuncionariosDisponibles(busqueda?: string): Promise<unknown[]> {
    const texto = busqueda?.trim();
    return this.prisma.funcionario.findMany({
      where: {
        estado: 'activo',
        usuario: { is: null },
        OR: texto
          ? [
              { cedula: { contains: texto } },
              { nombre: { contains: texto } },
              { primerApellido: { contains: texto } },
              { segundoApellido: { contains: texto } },
              { correoInstitucional: { contains: texto } },
            ]
          : undefined,
      },
      orderBy: [{ primerApellido: 'asc' }, { nombre: 'asc' }],
      take: 20,
      select: {
        id: true,
        cedula: true,
        nombre: true,
        primerApellido: true,
        segundoApellido: true,
        correoInstitucional: true,
      },
    });
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
        message: 'No se encontró el funcionario indicado.',
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
        message: 'Ese correo ya está en uso por otra cuenta.',
      });
    }

    // ---- 3. Los roles existen y quien actua tiene derecho a darlos ----
    const roles = await this.validarRolesAsignables(tx, datos.roles, quienActua);

    if (!roles.some((rol) => rol.fechaVencimiento === null)) {
      throw errorSinRolPermanente();
    }

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
        descripcion: `Creó la cuenta ${usuario.correo} para ${funcionario.nombre} ${funcionario.primerApellido}.`,
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
          'Buen día,',
          '',
          'Recursos Humanos creó su cuenta en SIGEL, el Sistema Integral de Gestión Laboral.',
          '',
          `Correo de ingreso:     ${cuenta.correo}`,
          `Contraseña temporal:   ${cuenta.contrasenaTemporal}`,
          '',
          'La primera vez que ingrese, el sistema le pedirá cambiar esta contraseña por una propia.',
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
        message: 'Un mismo rol aparece más de una vez.',
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
          message: `El rol "${rol.nombre}" está inactivo y no se puede asignar.`,
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
        // "2026-10-31" = hasta el final de ese dia en Costa Rica. Una fecha
        // pasada, imposible o a mas de 5 anios se rechaza (comun/fechas.ts).
        fechaVencimiento = validarFechaDeVencimiento(pedido.fechaVencimiento, `del rol "${rol.nombre}"`);
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
          message: `La cuenta ya está en estado "${datos.estado}".`,
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
            `Cambió el estado de la cuenta ${destino.correo} de "${destino.estado}" a "${actualizada.estado}"` +
            (motivo ? `. Motivo: ${motivo}` : '.'),
        },
        tx,
      );

      return actualizada;
    });
  }

  /**
   * Edita una cuenta desde la ventana "Editar usuario": el correo de ingreso
   * y/o el conjunto COMPLETO de sus roles (con su vigencia). Todo en una sola
   * transaccion: o se guarda todo, o nada.
   *
   * Casos que se cuidan:
   *   - Regla 4: la propia cuenta no se edita por aqui (sus datos personales
   *     se cambian en "Mi cuenta"; su acceso lo cambia otra persona).
   *   - Regla 3: no se toca a quien tiene mas acceso.
   *   - Correo: no puede estar en uso por otra cuenta.
   *   - Roles: ver aplicarConjuntoDeRoles (reglas 1 y 2, al menos un rol
   *     permanente, cada cambio a la bitacora).
   *   - Si no cambia nada, SIN_CAMBIOS en vez de "guardar" en vano.
   *
   * Si cambio el correo, despues de confirmar se avisa a la direccion
   * anterior y a la nueva: si el cambio no lo pidio la persona, se entera.
   */
  async editar(
    usuarioId: string,
    datos: EditarUsuarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    if (datos.correo === undefined && datos.roles === undefined) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        message: 'Indique el correo o los roles que quiere cambiar.',
      });
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      let cambioDeCorreo: { anterior: string; nuevo: string } | null = null;
      const correoNuevo = datos.correo?.trim().toLowerCase();

      if (correoNuevo && correoNuevo !== destino.correo) {
        const ocupado = await tx.usuario.findUnique({ where: { correo: correoNuevo }, select: { id: true } });
        if (ocupado) {
          throw new ConflictException({
            codigo: 'CORREO_EN_USO',
            message: 'Ese correo ya está en uso por otra cuenta.',
          });
        }

        await tx.usuario.update({ where: { id: destino.id }, data: { correo: correoNuevo } });
        await this.bitacora.registrar(
          {
            usuarioId: quienActua.id,
            entidad: 'usuario',
            registroAfectadoId: destino.id,
            accion: 'modificar',
            funcionarioAfectadoId: destino.funcionarioId ?? undefined,
            direccionIp,
            datosAnteriores: { correo: destino.correo },
            datosNuevos: { correo: correoNuevo },
            descripcion: `Cambió el correo de ingreso de ${destino.correo} a ${correoNuevo}.`,
          },
          tx,
        );
        cambioDeCorreo = { anterior: destino.correo, nuevo: correoNuevo };
      }

      const cambiosDeRoles = datos.roles
        ? await this.aplicarConjuntoDeRoles(tx, destino, datos.roles, quienActua, direccionIp)
        : 0;

      if (!cambioDeCorreo && cambiosDeRoles === 0) {
        throw new BadRequestException({
          codigo: 'SIN_CAMBIOS',
          message: 'No hay cambios que guardar: la cuenta ya está así.',
        });
      }

      return cambioDeCorreo;
    });

    // Fuera de la transaccion: si el correo falla, el cambio ya esta hecho.
    if (resultado) await this.avisarCambioDeCorreo(resultado.anterior, resultado.nuevo);

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Deja a la cuenta con EXACTAMENTE los roles pedidos (y su vigencia).
   * Devuelve cuantos cambios hizo (0 = ya estaba asi).
   *
   *   - Rol nuevo, reactivado o con otra fecha: se valida con
   *     validarRolesAsignables (existe, activo, regla 1, fecha futura).
   *   - Rol vigente que no viene en la lista: se quita (se vence "ahora"),
   *     con la regla 2 (solo se quita lo que uno tiene).
   *   - Rol que no cambia: no se toca ni se revalida.
   *   - Tiene que quedar al menos un rol PERMANENTE (sin fecha). Si todos
   *     vencen, llegaria el dia en que la cuenta se queda sin acceso sin que
   *     nadie lo decida (pedido de Josthyn, 26/09).
   *   - Cada cambio es un movimiento aparte en la bitacora.
   */
  private async aplicarConjuntoDeRoles(
    tx: Prisma.TransactionClient,
    destino: { id: string; correo: string; funcionarioId: string | null },
    pedidos: RolAsignadoDto[],
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<number> {
    if (!pedidos.some((pedido) => !pedido.fechaVencimiento)) {
      throw errorSinRolPermanente();
    }

    const actuales = await tx.usuarioRol.findMany({
      where: { usuarioId: destino.id },
      select: {
        rolId: true,
        fechaVencimiento: true,
        rol: {
          select: { nombre: true, permisos: { select: { permiso: { select: { clave: true, activo: true } } } } },
        },
      },
    });
    const vigentes = new Map(
      actuales.filter((a) => estaVigente(a.fechaVencimiento)).map((a) => [a.rolId, a] as const),
    );

    // Los que hay que crear, reactivar o cambiar de fecha.
    const aCambiar = pedidos.filter((pedido) => {
      const actual = vigentes.get(pedido.rolId);
      if (!actual) return true;
      const fecha = pedido.fechaVencimiento ? interpretarFechaDeVencimiento(pedido.fechaVencimiento) : null;
      return !mismaFecha(actual.fechaVencimiento, fecha);
    });
    const validados = aCambiar.length ? await this.validarRolesAsignables(tx, aCambiar, quienActua) : [];

    // Repetidos tambien entre los que no cambian.
    const ids = pedidos.map((pedido) => pedido.rolId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({ codigo: 'ROL_REPETIDO', message: 'Un mismo rol aparece más de una vez.' });
    }

    // Los vigentes que ya no vienen: se quitan (regla 2).
    const pedidosIds = new Set(ids);
    const aQuitar = [...vigentes.values()].filter((actual) => !pedidosIds.has(actual.rolId));
    for (const actual of aQuitar) {
      const claves = actual.rol.permisos.filter((p) => p.permiso.activo).map((p) => p.permiso.clave);
      if (permisosQueFaltan(quienActua.permisos, claves).length > 0) {
        throw new ForbiddenException({
          codigo: 'ROL_NO_QUITABLE',
          message: `No puede quitar el rol "${actual.rol.nombre}" porque incluye permisos que usted no tiene.`,
        });
      }
    }

    const ahora = new Date();
    const base = {
      usuarioId: quienActua.id,
      entidad: 'usuario',
      registroAfectadoId: destino.id,
      accion: 'modificar' as const,
      funcionarioAfectadoId: destino.funcionarioId ?? undefined,
      direccionIp,
    };

    for (const rol of validados) {
      const anterior = vigentes.get(rol.id);
      await tx.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId: destino.id, rolId: rol.id } },
        create: { usuarioId: destino.id, rolId: rol.id, fechaVencimiento: rol.fechaVencimiento, asignadoPorId: quienActua.id },
        update: { fechaVencimiento: rol.fechaVencimiento, asignadoPorId: quienActua.id, fechaAsignacion: ahora },
      });
      const hasta = rol.fechaVencimiento
        ? ` hasta ${formatearFechaCostaRica(rol.fechaVencimiento)}`
        : ' de forma permanente';
      await this.bitacora.registrar(
        {
          ...base,
          datosAnteriores: {
            rol: rol.nombre,
            asignado: Boolean(anterior),
            fechaVencimiento: anterior?.fechaVencimiento?.toISOString() ?? null,
          },
          datosNuevos: { rol: rol.nombre, asignado: true, fechaVencimiento: rol.fechaVencimiento?.toISOString() ?? null },
          descripcion: anterior
            ? `Cambió la vigencia del rol "${rol.nombre}" de ${destino.correo}: ahora${hasta}.`
            : `Asignó el rol "${rol.nombre}" a ${destino.correo}${hasta}.`,
        },
        tx,
      );
    }

    for (const actual of aQuitar) {
      await tx.usuarioRol.update({
        where: { usuarioId_rolId: { usuarioId: destino.id, rolId: actual.rolId } },
        data: { fechaVencimiento: ahora, asignadoPorId: quienActua.id },
      });
      await this.bitacora.registrar(
        {
          ...base,
          datosAnteriores: {
            rol: actual.rol.nombre,
            asignado: true,
            fechaVencimiento: actual.fechaVencimiento?.toISOString() ?? null,
          },
          datosNuevos: { rol: actual.rol.nombre, asignado: false },
          descripcion: `Quitó el rol "${actual.rol.nombre}" a ${destino.correo}.`,
        },
        tx,
      );
    }

    return validados.length + aQuitar.length;
  }

  /**
   * Cuantos roles PERMANENTES (sin fecha) y vigentes tiene la cuenta, sin
   * contar "excepto". Sirve para la regla "al menos un rol permanente".
   */
  private async contarRolesPermanentes(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    excepto?: string,
  ): Promise<number> {
    return tx.usuarioRol.count({
      where: { usuarioId, fechaVencimiento: null, ...(excepto ? { NOT: { rolId: excepto } } : {}) },
    });
  }

  /**
   * Asigna un rol a una cuenta existente, o cambia la fecha de vencimiento
   * de uno que ya tiene.
   *
   * Casos que se cuidan:
   *   - Regla 4: nadie se asigna roles a si mismo.
   *   - Regla 3: no se toca a quien tiene mas acceso.
   *   - Regla 1: solo se asigna un rol cuyos permisos uno tenga todos
   *     (validarRolesAsignables, la misma revision que al crear la cuenta).
   *   - Rol inexistente o inactivo, y fecha de vencimiento que ya paso.
   *   - Si la cuenta ya tiene ese rol vigente con la misma fecha, se responde
   *     ROL_YA_ASIGNADO en vez de repetirlo.
   *   - Si lo tuvo y le vencio (o se lo quitaron), se reactiva la misma fila:
   *     la tabla tiene una sola fila por cuenta y rol (uqUsuarioRol).
   *
   * Ejemplo de uso real: la jefatura sale de vacaciones y RRHH le da a una
   * funcionaria el rol Aprobador hasta el dia en que regresa. Ese dia el rol
   * deja de contar solo, sin que nadie tenga que acordarse de quitarlo.
   */
  async asignarRol(
    usuarioId: string,
    datos: RolAsignadoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      const [rol] = await this.validarRolesAsignables(tx, [datos], quienActua);

      const actual = await tx.usuarioRol.findUnique({
        where: { usuarioId_rolId: { usuarioId, rolId: rol.id } },
        select: { fechaVencimiento: true },
      });

      const estabaVigente = actual !== null && estaVigente(actual.fechaVencimiento);

      if (estabaVigente && mismaFecha(actual.fechaVencimiento, rol.fechaVencimiento)) {
        throw new ConflictException({
          codigo: 'ROL_YA_ASIGNADO',
          message: `La cuenta ya tiene el rol "${rol.nombre}" con esa misma vigencia.`,
        });
      }

      // Pasar un rol permanente a "con fecha" no puede dejar a la cuenta sin
      // ningun rol permanente: el dia que venza, se quedaria sin acceso.
      if (
        estabaVigente &&
        actual.fechaVencimiento === null &&
        rol.fechaVencimiento !== null &&
        (await this.contarRolesPermanentes(tx, usuarioId, rol.id)) === 0
      ) {
        throw errorSinRolPermanente();
      }

      await tx.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId, rolId: rol.id } },
        create: {
          usuarioId,
          rolId: rol.id,
          fechaVencimiento: rol.fechaVencimiento,
          asignadoPorId: quienActua.id,
        },
        update: {
          fechaVencimiento: rol.fechaVencimiento,
          asignadoPorId: quienActua.id,
          fechaAsignacion: new Date(),
        },
      });

      const hasta = rol.fechaVencimiento ? ` hasta ${formatearFechaCostaRica(rol.fechaVencimiento)}` : ' de forma permanente';

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'usuario',
          registroAfectadoId: destino.id,
          accion: 'modificar',
          funcionarioAfectadoId: destino.funcionarioId ?? undefined,
          direccionIp,
          datosAnteriores: {
            rol: rol.nombre,
            asignado: estabaVigente,
            fechaVencimiento: estabaVigente ? (actual.fechaVencimiento?.toISOString() ?? null) : null,
          },
          datosNuevos: {
            rol: rol.nombre,
            asignado: true,
            fechaVencimiento: rol.fechaVencimiento?.toISOString() ?? null,
          },
          descripcion: estabaVigente
            ? `Cambió la vigencia del rol "${rol.nombre}" de ${destino.correo}: ahora${hasta}.`
            : `Asignó el rol "${rol.nombre}" a ${destino.correo}${hasta}.`,
        },
        tx,
      );
    });

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Quita un rol a una cuenta.
   *
   * No borra la fila: le pone como fecha de vencimiento "ahora". Asi queda
   * a la vista cuando lo tuvo y hasta cuando, y reasignarlo despues reactiva
   * la misma fila.
   *
   * Casos que se cuidan:
   *   - Reglas 4 y 3, igual que al asignar.
   *   - Regla 2: solo se quita un rol cuyos permisos uno tenga todos.
   *   - Que la cuenta tenga de verdad ese rol vigente (ROL_NO_ASIGNADO).
   *   - Que no se quede sin ningun rol (CUENTA_SIN_ROLES). Una cuenta sin
   *     roles no puede hacer nada pero sigue "activa", lo cual confunde. Si
   *     la persona ya no debe entrar, lo correcto es inactivar la cuenta.
   */
  async quitarRol(
    usuarioId: string,
    rolId: string,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      const asignacion = await tx.usuarioRol.findUnique({
        where: { usuarioId_rolId: { usuarioId, rolId } },
        select: {
          fechaVencimiento: true,
          rol: {
            select: {
              nombre: true,
              permisos: { select: { permiso: { select: { clave: true, activo: true } } } },
            },
          },
        },
      });

      if (!asignacion || !estaVigente(asignacion.fechaVencimiento)) {
        throw new NotFoundException({
          codigo: 'ROL_NO_ASIGNADO',
          message: 'La cuenta no tiene ese rol vigente.',
        });
      }

      // Regla 2: solo se quita lo que se tiene.
      const permisosDelRol = asignacion.rol.permisos
        .filter((asignado) => asignado.permiso.activo)
        .map((asignado) => asignado.permiso.clave);

      if (permisosQueFaltan(quienActua.permisos, permisosDelRol).length > 0) {
        throw new ForbiddenException({
          codigo: 'ROL_NO_QUITABLE',
          message: `No puede quitar el rol "${asignacion.rol.nombre}" porque incluye permisos que usted no tiene.`,
        });
      }

      // destino.roles ya viene filtrado por vigencia (cargarCuentaConAcceso).
      if (destino.roles.length <= 1) {
        throw new BadRequestException({
          codigo: 'CUENTA_SIN_ROLES',
          message:
            'Es el único rol vigente de la cuenta y no puede quedar sin roles. ' +
            'Asigne otro rol primero o, si la persona ya no debe ingresar, inactive la cuenta.',
        });
      }

      // Quitar el unico rol permanente tampoco: los que quedan vencerian.
      if (asignacion.fechaVencimiento === null && (await this.contarRolesPermanentes(tx, usuarioId, rolId)) === 0) {
        throw errorSinRolPermanente();
      }

      await tx.usuarioRol.update({
        where: { usuarioId_rolId: { usuarioId, rolId } },
        data: { fechaVencimiento: new Date(), asignadoPorId: quienActua.id },
      });

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'usuario',
          registroAfectadoId: destino.id,
          accion: 'modificar',
          funcionarioAfectadoId: destino.funcionarioId ?? undefined,
          direccionIp,
          datosAnteriores: {
            rol: asignacion.rol.nombre,
            asignado: true,
            fechaVencimiento: asignacion.fechaVencimiento?.toISOString() ?? null,
          },
          datosNuevos: { rol: asignacion.rol.nombre, asignado: false },
          descripcion: `Quitó el rol "${asignacion.rol.nombre}" a ${destino.correo}.`,
        },
        tx,
      );
    });

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Crea o cambia un permiso individual (una excepcion a lo que dan los
   * roles). Ver AjustarPermisoDto para el significado de "otorgado".
   *
   * Casos que se cuidan:
   *   - Reglas 4 y 3, igual que con los roles.
   *   - Reglas 1 y 2: tanto para conceder como para quitar un permiso hay
   *     que tenerlo. Asi RRHH no puede conceder "bitacora.ver", y tampoco
   *     puede "apagarle" ese permiso a alguien.
   *   - Permiso inexistente o inactivo.
   *   - Fecha de vencimiento que ya paso.
   *   - Si ya existe exactamente igual y vigente, PERMISO_SIN_CAMBIO.
   */
  async ajustarPermiso(
    usuarioId: string,
    permisoId: string,
    datos: AjustarPermisoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    const fechaVencimiento = convertirEnFechaFutura(datos.fechaVencimiento, 'del permiso');
    const observacion = datos.observacion?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      const permiso = await this.cargarPermisoRepartible(tx, permisoId, quienActua);
      const cambio = await this.aplicarExcepcion(
        tx,
        destino,
        permiso,
        { otorgado: datos.otorgado, fechaVencimiento, observacion },
        quienActua,
        direccionIp,
      );
      if (!cambio) {
        throw new BadRequestException({
          codigo: 'PERMISO_SIN_CAMBIO',
          message: 'La cuenta ya tiene ese permiso individual exactamente así.',
        });
      }
    });

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Pagina "Agregar excepcion": concede o quita VARIOS permisos de una vez,
   * con la misma fecha limite y el mismo motivo. Todo junto o nada (una sola
   * transaccion) y una entrada de bitacora por permiso.
   *
   * Mismas reglas que ajustarPermiso. Los permisos que ya estaban
   * exactamente asi se saltan; si ninguno cambia, PERMISO_SIN_CAMBIO.
   */
  async ajustarVariosPermisos(
    usuarioId: string,
    datos: AjustarVariosPermisosDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    if (new Set(datos.permisoIds).size !== datos.permisoIds.length) {
      throw new BadRequestException({ codigo: 'PERMISO_REPETIDO', message: 'Un mismo permiso aparece más de una vez.' });
    }
    const fechaVencimiento = convertirEnFechaFutura(datos.fechaVencimiento, 'de la excepción');
    const observacion = datos.observacion.trim();

    await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      let cambios = 0;
      for (const permisoId of datos.permisoIds) {
        const permiso = await this.cargarPermisoRepartible(tx, permisoId, quienActua);
        const cambio = await this.aplicarExcepcion(
          tx,
          destino,
          permiso,
          { otorgado: datos.otorgado, fechaVencimiento, observacion },
          quienActua,
          direccionIp,
        );
        if (cambio) cambios++;
      }
      if (cambios === 0) {
        throw new BadRequestException({
          codigo: 'PERMISO_SIN_CAMBIO',
          message: 'La cuenta ya tenía esos permisos individuales exactamente así.',
        });
      }
    });

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Crea o cambia UNA excepcion dentro de una transaccion ya abierta y la
   * anota en la bitacora. Devuelve false si ya estaba exactamente igual
   * (no se toca nada).
   */
  private async aplicarExcepcion(
    tx: Prisma.TransactionClient,
    destino: { id: string; funcionarioId: string | null; correo: string },
    permiso: { id: string; clave: string },
    nueva: { otorgado: boolean; fechaVencimiento: Date | null; observacion: string | null },
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<boolean> {
    const clave = { usuarioId_permisoId: { usuarioId: destino.id, permisoId: permiso.id } };
    const actual = await tx.usuarioPermiso.findUnique({
      where: clave,
      select: { otorgado: true, fechaVencimiento: true, observacion: true },
    });

    const estabaVigente = actual !== null && estaVigente(actual.fechaVencimiento);

    if (
      estabaVigente &&
      actual.otorgado === nueva.otorgado &&
      mismaFecha(actual.fechaVencimiento, nueva.fechaVencimiento) &&
      (actual.observacion ?? null) === nueva.observacion
    ) {
      return false;
    }

    await tx.usuarioPermiso.upsert({
      where: clave,
      create: {
        usuarioId: destino.id,
        permisoId: permiso.id,
        otorgado: nueva.otorgado,
        fechaVencimiento: nueva.fechaVencimiento,
        observacion: nueva.observacion,
        asignadoPorId: quienActua.id,
      },
      update: {
        otorgado: nueva.otorgado,
        fechaVencimiento: nueva.fechaVencimiento,
        observacion: nueva.observacion,
        asignadoPorId: quienActua.id,
        fechaAsignacion: new Date(),
      },
    });

    const verbo = nueva.otorgado ? 'Concedió' : 'Quitó';
    const hasta = nueva.fechaVencimiento ? ` hasta ${formatearFechaCostaRica(nueva.fechaVencimiento)}` : '';

    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        entidad: 'usuario',
        registroAfectadoId: destino.id,
        accion: 'modificar',
        funcionarioAfectadoId: destino.funcionarioId ?? undefined,
        direccionIp,
        datosAnteriores: estabaVigente
          ? {
              permiso: permiso.clave,
              otorgado: actual.otorgado,
              fechaVencimiento: actual.fechaVencimiento?.toISOString() ?? null,
              observacion: actual.observacion,
            }
          : { permiso: permiso.clave, individual: false },
        datosNuevos: {
          permiso: permiso.clave,
          otorgado: nueva.otorgado,
          fechaVencimiento: nueva.fechaVencimiento?.toISOString() ?? null,
          observacion: nueva.observacion,
        },
        descripcion: `${verbo} de forma individual el permiso "${permiso.clave}" a ${destino.correo}${hasta}.`,
      },
      tx,
    );
    return true;
  }

  /**
   * Elimina la excepcion individual de un permiso: la cuenta vuelve a tener
   * exactamente lo que le dan sus roles. Igual que con los roles, no se
   * borra la fila, se vence "ahora".
   */
  async quitarPermisoIndividual(
    usuarioId: string,
    permisoId: string,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    this.impedirCambiosSobreSiMismo(usuarioId, quienActua);

    await this.prisma.$transaction(async (tx) => {
      const destino = await this.cargarCuentaConAcceso(tx, usuarioId);
      this.verificarQueNoTengaMasAcceso(destino, quienActua);

      const permiso = await this.cargarPermisoRepartible(tx, permisoId, quienActua, false);

      const actual = await tx.usuarioPermiso.findUnique({
        where: { usuarioId_permisoId: { usuarioId, permisoId } },
        select: { otorgado: true, fechaVencimiento: true, observacion: true },
      });

      if (!actual || !estaVigente(actual.fechaVencimiento)) {
        throw new NotFoundException({
          codigo: 'PERMISO_INDIVIDUAL_NO_ASIGNADO',
          message: 'La cuenta no tiene un permiso individual vigente para ese permiso.',
        });
      }

      await tx.usuarioPermiso.update({
        where: { usuarioId_permisoId: { usuarioId, permisoId } },
        data: { fechaVencimiento: new Date(), asignadoPorId: quienActua.id },
      });

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'usuario',
          registroAfectadoId: destino.id,
          accion: 'modificar',
          funcionarioAfectadoId: destino.funcionarioId ?? undefined,
          direccionIp,
          datosAnteriores: {
            permiso: permiso.clave,
            otorgado: actual.otorgado,
            fechaVencimiento: actual.fechaVencimiento?.toISOString() ?? null,
            observacion: actual.observacion,
          },
          datosNuevos: { permiso: permiso.clave, individual: false },
          descripcion: `Eliminó el permiso individual "${permiso.clave}" de ${destino.correo}; vuelve a lo que dan sus roles.`,
        },
        tx,
      );
    });

    return this.consultarUno(usuarioId, quienActua);
  }

  /**
   * Por que quien consulta NO puede modificar una cuenta (null = si puede).
   * Mismo criterio que aplican los metodos que modifican (reglas 3 y 4); se
   * calcula aqui solo para que la pantalla lo muestre de antemano.
   */
  private motivoNoModificable(
    usuarioId: string,
    permisosDeLaCuenta: string[],
    quienActua?: UsuarioAutenticado,
  ): 'CUENTA_PROPIA' | 'CUENTA_CON_MAYOR_ACCESO' | null {
    if (!quienActua) return null;
    if (quienActua.id === usuarioId) return 'CUENTA_PROPIA';
    if (permisosQueFaltan(quienActua.permisos, permisosDeLaCuenta).length > 0) return 'CUENTA_CON_MAYOR_ACCESO';
    return null;
  }

  /**
   * Regla 4 de reparto de acceso: nadie cambia su propia cuenta desde la
   * administracion de usuarios (ni roles, ni permisos, ni correo).
   * Se revisa antes de ir a la base: no hace falta consultar nada.
   */
  private impedirCambiosSobreSiMismo(usuarioId: string, quienActua: UsuarioAutenticado): void {
    if (usuarioId === quienActua.id) {
      throw new ForbiddenException({
        codigo: 'NO_PUEDE_MODIFICAR_SU_PROPIA_CUENTA',
        message: 'No puede modificar el acceso de su propia cuenta. Debe hacerlo otra persona.',
      });
    }
  }

  /**
   * Trae un permiso del catalogo y comprueba que quien actua lo tenga
   * (reglas 1 y 2: solo se da, o se quita, lo que se tiene).
   *
   * "exigirActivo" es false al QUITAR una excepcion: si el permiso se
   * inactivo en el catalogo, igual debe poder limpiarse la excepcion vieja.
   */
  private async cargarPermisoRepartible(
    tx: Prisma.TransactionClient,
    permisoId: string,
    quienActua: UsuarioAutenticado,
    exigirActivo = true,
  ): Promise<{ id: string; clave: string }> {
    const permiso = await tx.permiso.findUnique({
      where: { id: permisoId },
      select: { id: true, clave: true, activo: true },
    });

    if (!permiso) {
      throw new NotFoundException({
        codigo: 'PERMISO_NO_ENCONTRADO',
        message: 'No se encontró el permiso indicado.',
      });
    }

    if (exigirActivo && !permiso.activo) {
      throw new BadRequestException({
        codigo: 'PERMISO_INACTIVO',
        message: `El permiso "${permiso.clave}" está inactivo y no se puede asignar.`,
      });
    }

    if (permiso.activo && !quienActua.permisos.includes(permiso.clave)) {
      throw new ForbiddenException({
        codigo: 'PERMISO_NO_ASIGNABLE',
        message: `No puede conceder ni quitar el permiso "${permiso.clave}" porque usted no lo tiene.`,
      });
    }

    return { id: permiso.id, clave: permiso.clave };
  }

  /**
   * Aviso de seguridad cuando cambia el correo de ingreso. Va a las dos
   * direcciones: a la anterior (por si el cambio no lo pidio la persona) y a
   * la nueva (para confirmar que llega). Si falla, no se lanza el error: el
   * cambio ya esta hecho; queda constancia en el registro del servidor.
   */
  private async avisarCambioDeCorreo(anterior: string, nuevo: string): Promise<void> {
    const cuerpo = [
      'Buen día,',
      '',
      'El correo de ingreso de su cuenta en SIGEL cambio:',
      '',
      `Correo anterior:  ${anterior}`,
      `Correo nuevo:     ${nuevo}`,
      '',
      'A partir de ahora debe ingresar con el correo nuevo. Su contraseña no cambió.',
      'Si usted no solicitó este cambio, comuníquese de inmediato con Recursos Humanos.',
      '',
      'Municipalidad de Palmares',
    ].join('\n');

    for (const para of [anterior, nuevo]) {
      try {
        await this.correo.enviar({ para, asunto: 'SIGEL - Cambio en su correo de ingreso', cuerpo });
      } catch (error) {
        this.registro.error(
          'No se pudo enviar el aviso de cambio de correo',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
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
        message: 'No se encontró la cuenta indicada.',
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
