import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { soloVigentes } from '../autenticacion/permisos-efectivos.js';
import { permisosQueFaltan } from '../autenticacion/reparto-de-acceso.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CambiarEstadoRolDto } from './dto/cambiar-estado-rol.dto.js';
import type { CrearRolDto } from './dto/crear-rol.dto.js';
import type { EditarRolDto } from './dto/editar-rol.dto.js';
import type { ReemplazarPermisosRolDto } from './dto/reemplazar-permisos-rol.dto.js';

/** Como se ve un rol en la lista. */
export interface RolResumido {
  id: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  activo: boolean;
  cantidadPermisos: number;
  /** Cuentas que tienen el rol VIGENTE (sin contar asignaciones vencidas). */
  cantidadUsuarios: number;
  /** Ids de sus permisos activos (para la pestana "Catalogo de permisos"). */
  permisoIds: string[];
  /**
   * true si quien consulta puede asignar este rol (lo tiene activo y quien
   * consulta tiene todos sus permisos). Sirve para que la pantalla muestre
   * en la lista de "asignar rol" solo los que de verdad se pueden dar, en
   * vez de dejar elegir y responder un error despues.
   */
  asignable: boolean;
}

/**
 * Administracion de roles.
 *
 * Decisiones que aplica (ver docs/GUIA_DESARROLLO.md, "Como se reparte el acceso"):
 *
 *   - Los roles de sistema (esSistema = true: Super Administrador,
 *     Administrador, Aprobador, Solicitante, Consulta) NO se modifican desde
 *     la API: ni nombre, ni descripcion, ni permisos, ni estado. Su
 *     contenido lo define prisma/seed.ts, que ademas los vuelve a completar
 *     cada vez que se ejecuta; si se pudieran editar aqui, el siguiente seed
 *     desharia el cambio sin avisar. Para necesidades distintas se crea un
 *     rol nuevo.
 *   - Regla 5: al crear o editar un rol solo se le ponen permisos que uno
 *     tenga.
 *   - No se edita un rol con permisos que uno no tiene (analoga a la regla 3).
 *   - No se editan los permisos ni el estado de un rol que uno mismo tiene
 *     (analoga a la regla 4: nadie cambia su propio acceso).
 *   - Los roles no se borran: se inactivan. Borrar romperia el historial de
 *     asignaciones. Y no se inactiva un rol que alguien tiene vigente.
 *
 * Todos los nombres de rol de este archivo vienen de la base; ninguna regla
 * depende del nombre de un rol.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Lista todos los roles (activos e inactivos), primero los de sistema. */
  async consultar(quienActua: UsuarioAutenticado): Promise<RolResumido[]> {
    const roles = await this.prisma.rol.findMany({
      orderBy: [{ esSistema: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        esSistema: true,
        activo: true,
        permisos: { select: { permiso: { select: { id: true, clave: true, activo: true } } } },
        _count: { select: { usuarios: { where: soloVigentes() } } },
      },
    });

    return roles.map((rol) => {
      const claves = clavesActivas(rol.permisos);
      return {
        id: rol.id,
        nombre: rol.nombre,
        descripcion: rol.descripcion,
        esSistema: rol.esSistema,
        activo: rol.activo,
        cantidadPermisos: claves.length,
        cantidadUsuarios: rol._count.usuarios,
        permisoIds: rol.permisos.filter((p) => p.permiso.activo).map((p) => p.permiso.id),
        asignable: rol.activo && permisosQueFaltan(quienActua.permisos, claves).length === 0,
      };
    });
  }

  /** Detalle de un rol con la lista de sus permisos. */
  async consultarUno(rolId: string, quienActua: UsuarioAutenticado): Promise<unknown> {
    const rol = await this.prisma.rol.findUnique({
      where: { id: rolId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        esSistema: true,
        activo: true,
        permisos: {
          select: { permiso: { select: { id: true, clave: true, modulo: true, descripcion: true, activo: true } } },
          orderBy: { permiso: { clave: 'asc' } },
        },
        _count: { select: { usuarios: { where: soloVigentes() } } },
      },
    });

    if (!rol) throw rolNoEncontrado();

    const claves = clavesActivas(rol.permisos);

    return {
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      esSistema: rol.esSistema,
      activo: rol.activo,
      cantidadUsuarios: rol._count.usuarios,
      asignable: rol.activo && permisosQueFaltan(quienActua.permisos, claves).length === 0,
      // Lo que la pantalla necesita para habilitar o no los botones de edicion.
      editable: !rol.esSistema && permisosQueFaltan(quienActua.permisos, claves).length === 0,
      permisos: rol.permisos.map((asignado) => asignado.permiso),
    };
  }

  /**
   * Crea un rol nuevo (nunca de sistema).
   *
   * Casos que se cuidan: nombre repetido (sin importar mayusculas ni
   * tildes, por la intercalacion de MySQL), permisos repetidos, inexistentes
   * o inactivos, y regla 5 (solo permisos que uno tenga).
   */
  async crear(datos: CrearRolDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<unknown> {
    const creado = await this.prisma.$transaction(async (tx) => {
      await this.verificarNombreLibre(tx, datos.nombre);
      const permisos = await this.validarPermisosParaRol(tx, datos.permisoIds, quienActua);

      const rol = await tx.rol.create({
        data: {
          nombre: datos.nombre,
          descripcion: datos.descripcion || null,
          esSistema: false,
          permisos: { create: permisos.map((permiso) => ({ permisoId: permiso.id })) },
        },
        select: { id: true, nombre: true },
      });

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'rol',
          registroAfectadoId: rol.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: {
            nombre: rol.nombre,
            descripcion: datos.descripcion || null,
            permisos: permisos.map((permiso) => permiso.clave),
          },
          descripcion: `Creó el rol "${rol.nombre}" con ${permisos.length} permiso(s).`,
        },
        tx,
      );

      return rol;
    });

    return this.consultarUno(creado.id, quienActua);
  }

  /**
   * Pagina "Editar rol": cambia nombre, descripcion y/o la lista completa de
   * permisos de un rol que no sea de sistema. Todo junto o nada (una sola
   * transaccion) y cada parte queda en la bitacora.
   *
   * Si no cambia nada: ROL_SIN_CAMBIO.
   */
  async editar(
    rolId: string,
    datos: EditarRolDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    if (datos.nombre === undefined && datos.descripcion === undefined && datos.permisoIds === undefined) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        message: 'Indique el nombre, la descripción o los permisos que quiere cambiar.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const rol = await this.cargarRolEditable(tx, rolId, quienActua);

      const cambioDatos =
        datos.nombre !== undefined || datos.descripcion !== undefined
          ? await this.aplicarDatos(tx, rol, datos, quienActua, direccionIp)
          : false;
      const cambioPermisos =
        datos.permisoIds !== undefined
          ? await this.aplicarPermisos(tx, rol, datos.permisoIds, quienActua, direccionIp)
          : false;

      if (!cambioDatos && !cambioPermisos) {
        throw new BadRequestException({
          codigo: 'ROL_SIN_CAMBIO',
          message:
            datos.permisoIds === undefined
              ? 'El rol ya tiene ese nombre y esa descripción.'
              : 'No hay cambios que guardar: el rol ya está exactamente así.',
        });
      }
    });

    return this.consultarUno(rolId, quienActua);
  }

  /**
   * Reemplaza la lista completa de permisos de un rol.
   *
   * El cambio afecta DE INMEDIATO a todas las cuentas que tienen el rol: el
   * guard de sesion recalcula los permisos en cada peticion.
   */
  async reemplazarPermisos(
    rolId: string,
    datos: ReemplazarPermisosRolDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    await this.prisma.$transaction(async (tx) => {
      const rol = await this.cargarRolEditable(tx, rolId, quienActua);
      const cambio = await this.aplicarPermisos(tx, rol, datos.permisoIds, quienActua, direccionIp);
      if (!cambio) {
        throw new BadRequestException({
          codigo: 'PERMISOS_SIN_CAMBIO',
          message: 'El rol ya tiene exactamente esos permisos.',
        });
      }
    });

    return this.consultarUno(rolId, quienActua);
  }

  /**
   * Cambia nombre y/o descripcion dentro de una transaccion abierta.
   * Devuelve false si quedaron iguales (no toca nada).
   */
  private async aplicarDatos(
    tx: Prisma.TransactionClient,
    rol: Awaited<ReturnType<RolesService['cargarRolEditable']>>,
    datos: { nombre?: string; descripcion?: string },
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<boolean> {
    const nombreNuevo = datos.nombre ?? rol.nombre;
    const descripcionNueva = datos.descripcion === undefined ? rol.descripcion : datos.descripcion || null;

    if (nombreNuevo === rol.nombre && descripcionNueva === rol.descripcion) return false;

    // Se excluye el propio rol: corregir solo mayusculas o tildes
    // ("planillas" -> "Planillas") no debe chocar consigo mismo, porque
    // MySQL considera iguales esos nombres.
    if (nombreNuevo !== rol.nombre) {
      await this.verificarNombreLibre(tx, nombreNuevo, rol.id);
    }

    await tx.rol.update({
      where: { id: rol.id },
      data: { nombre: nombreNuevo, descripcion: descripcionNueva },
    });

    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        entidad: 'rol',
        registroAfectadoId: rol.id,
        accion: 'modificar',
        direccionIp,
        datosAnteriores: { nombre: rol.nombre, descripcion: rol.descripcion },
        datosNuevos: { nombre: nombreNuevo, descripcion: descripcionNueva },
        descripcion:
          nombreNuevo === rol.nombre
            ? `Cambió la descripción del rol "${rol.nombre}".`
            : `Renombró el rol "${rol.nombre}" a "${nombreNuevo}".`,
      },
      tx,
    );
    return true;
  }

  /**
   * Deja al rol con exactamente esos permisos, dentro de una transaccion
   * abierta. Revisa ROL_PROPIO y las reglas de la lista de permisos.
   * Devuelve false si ya los tenia (no toca nada).
   */
  private async aplicarPermisos(
    tx: Prisma.TransactionClient,
    rol: Awaited<ReturnType<RolesService['cargarRolEditable']>>,
    permisoIds: string[],
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<boolean> {
    const nuevos = await this.validarPermisosParaRol(tx, permisoIds, quienActua);

    const idsActuales = new Set(rol.permisos.map((asignado) => asignado.permiso.id));
    const idsNuevos = new Set(nuevos.map((permiso) => permiso.id));

    const agregar = nuevos.filter((permiso) => !idsActuales.has(permiso.id));
    const quitar = rol.permisos.filter((asignado) => !idsNuevos.has(asignado.permiso.id)).map((a) => a.permiso);

    if (agregar.length === 0 && quitar.length === 0) return false;

    // Solo si de verdad cambian los permisos: renombrar el rol propio si se puede.
    await this.impedirCambiosSobreRolPropio(tx, rol, quienActua);

    if (quitar.length > 0) {
      await tx.rolPermiso.deleteMany({
        where: { rolId: rol.id, permisoId: { in: quitar.map((permiso) => permiso.id) } },
      });
    }

    if (agregar.length > 0) {
      await tx.rolPermiso.createMany({
        data: agregar.map((permiso) => ({ rolId: rol.id, permisoId: permiso.id })),
      });
    }

    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        entidad: 'rol',
        registroAfectadoId: rol.id,
        accion: 'modificar',
        direccionIp,
        datosAnteriores: { permisos: rol.permisos.map((asignado) => asignado.permiso.clave).sort() },
        datosNuevos: {
          permisos: nuevos.map((permiso) => permiso.clave).sort(),
          agregados: agregar.map((permiso) => permiso.clave),
          quitados: quitar.map((permiso) => permiso.clave),
        },
        descripcion:
          `Cambió los permisos del rol "${rol.nombre}": ` +
          `${agregar.length} agregado(s), ${quitar.length} quitado(s).`,
      },
      tx,
    );
    return true;
  }

  /**
   * Activa o inactiva un rol que no sea de sistema.
   *
   * Un rol inactivo deja de dar permisos (resolverAcceso lo ignora) y no se
   * puede asignar. Para evitar que alguien pierda acceso "sin que nadie se
   * de cuenta", no se inactiva mientras alguna cuenta lo tenga vigente:
   * primero se le quita a esas cuentas.
   */
  async cambiarEstado(
    rolId: string,
    datos: CambiarEstadoRolDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<unknown> {
    await this.prisma.$transaction(async (tx) => {
      const rol = await this.cargarRolEditable(tx, rolId, quienActua);
      await this.impedirCambiosSobreRolPropio(tx, rol, quienActua);

      if (rol.activo === datos.activo) {
        throw new BadRequestException({
          codigo: 'ESTADO_SIN_CAMBIO',
          message: `El rol ya esta ${rol.activo ? 'activo' : 'inactivo'}.`,
        });
      }

      if (!datos.activo) {
        const enUso = await tx.usuarioRol.count({ where: { rolId: rol.id, ...soloVigentes() } });
        if (enUso > 0) {
          throw new ConflictException({
            codigo: 'ROL_EN_USO',
            message:
              `No se puede inactivar el rol "${rol.nombre}" porque ${enUso} cuenta(s) lo tienen vigente. ` +
              'Quíteselo primero a esas cuentas.',
            cantidadUsuarios: enUso,
          });
        }
      }

      await tx.rol.update({ where: { id: rol.id }, data: { activo: datos.activo } });

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'rol',
          registroAfectadoId: rol.id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { activo: rol.activo },
          datosNuevos: { activo: datos.activo },
          descripcion: `${datos.activo ? 'Activó' : 'Inactivó'} el rol "${rol.nombre}".`,
        },
        tx,
      );
    });

    return this.consultarUno(rolId, quienActua);
  }

  /* ---------------------------------------------------------------- */
  /* Revisiones compartidas                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Trae un rol para modificarlo y aplica las dos revisiones que valen para
   * cualquier cambio:
   *   - ROL_DE_SISTEMA: los roles de sistema no se tocan desde la API.
   *   - ROL_CON_MAYOR_ACCESO: no se modifica un rol con permisos que uno no
   *     tiene (tampoco quitarselos: regla 2).
   */
  private async cargarRolEditable(tx: Prisma.TransactionClient, rolId: string, quienActua: UsuarioAutenticado) {
    const rol = await tx.rol.findUnique({
      where: { id: rolId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        esSistema: true,
        activo: true,
        permisos: { select: { permiso: { select: { id: true, clave: true, activo: true } } } },
      },
    });

    if (!rol) throw rolNoEncontrado();

    if (rol.esSistema) {
      throw new ForbiddenException({
        codigo: 'ROL_DE_SISTEMA',
        message:
          `El rol "${rol.nombre}" es un rol de sistema y no se modifica desde aquí. ` +
          'Si necesita otra combinación de permisos, cree un rol nuevo.',
      });
    }

    if (permisosQueFaltan(quienActua.permisos, clavesActivas(rol.permisos)).length > 0) {
      throw new ForbiddenException({
        codigo: 'ROL_CON_MAYOR_ACCESO',
        message: `No puede modificar el rol "${rol.nombre}" porque incluye permisos que usted no tiene.`,
      });
    }

    return rol;
  }

  /**
   * Nadie cambia su propio acceso: si quien actua tiene este rol vigente, no
   * puede cambiarle los permisos ni el estado (se estaria dando o quitando
   * acceso a si mismo).
   */
  private async impedirCambiosSobreRolPropio(
    tx: Prisma.TransactionClient,
    rol: { id: string; nombre: string },
    quienActua: UsuarioAutenticado,
  ): Promise<void> {
    const loTiene = await tx.usuarioRol.count({
      where: { rolId: rol.id, usuarioId: quienActua.id, ...soloVigentes() },
    });

    if (loTiene > 0) {
      throw new ForbiddenException({
        codigo: 'ROL_PROPIO',
        message: `Usted tiene el rol "${rol.nombre}". Otra persona debe hacer este cambio.`,
      });
    }
  }

  /**
   * El nombre no puede repetirse (MySQL compara sin mayusculas ni tildes).
   * "exceptoRolId" excluye al rol que se esta renombrando.
   */
  private async verificarNombreLibre(
    tx: Prisma.TransactionClient,
    nombre: string,
    exceptoRolId?: string,
  ): Promise<void> {
    const existe = await tx.rol.findFirst({
      where: { nombre, ...(exceptoRolId ? { NOT: { id: exceptoRolId } } : {}) },
      select: { nombre: true },
    });
    if (existe) {
      throw new ConflictException({
        codigo: 'ROL_DUPLICADO',
        message: `Ya existe un rol llamado "${existe.nombre}".`,
      });
    }
  }

  /**
   * Comprueba la lista de permisos que va a tener un rol:
   *   - sin repetidos (PERMISO_REPETIDO);
   *   - que existan (PERMISO_NO_ENCONTRADO) y esten activos (PERMISO_INACTIVO);
   *   - regla 5: que quien actua los tenga todos (PERMISO_NO_ASIGNABLE).
   */
  private async validarPermisosParaRol(
    tx: Prisma.TransactionClient,
    permisoIds: string[],
    quienActua: UsuarioAutenticado,
  ): Promise<{ id: string; clave: string }[]> {
    if (new Set(permisoIds).size !== permisoIds.length) {
      throw new BadRequestException({
        codigo: 'PERMISO_REPETIDO',
        message: 'Un mismo permiso aparece más de una vez.',
      });
    }

    const encontrados = await tx.permiso.findMany({
      where: { id: { in: permisoIds } },
      select: { id: true, clave: true, activo: true },
    });

    if (encontrados.length !== permisoIds.length) {
      throw new NotFoundException({
        codigo: 'PERMISO_NO_ENCONTRADO',
        message: 'Alguno de los permisos indicados no existe.',
      });
    }

    const inactivo = encontrados.find((permiso) => !permiso.activo);
    if (inactivo) {
      throw new BadRequestException({
        codigo: 'PERMISO_INACTIVO',
        message: `El permiso "${inactivo.clave}" está inactivo y no se puede asignar.`,
      });
    }

    const faltan = permisosQueFaltan(
      quienActua.permisos,
      encontrados.map((permiso) => permiso.clave),
    );

    if (faltan.length > 0) {
      throw new ForbiddenException({
        codigo: 'PERMISO_NO_ASIGNABLE',
        message: `No puede incluir permisos que usted no tiene: ${faltan.join(', ')}.`,
      });
    }

    return encontrados.map(({ id, clave }) => ({ id, clave }));
  }
}

/* ------------------------------------------------------------------ */
/* Ayudantes (solo de este archivo)                                    */
/* ------------------------------------------------------------------ */

/** Claves de los permisos activos de un rol (los inactivos no cuentan para nada). */
function clavesActivas(permisos: { permiso: { clave: string; activo: boolean } }[]): string[] {
  return permisos.filter((asignado) => asignado.permiso.activo).map((asignado) => asignado.permiso.clave);
}

function rolNoEncontrado(): NotFoundException {
  return new NotFoundException({
    codigo: 'ROL_NO_ENCONTRADO',
    message: 'No se encontró el rol indicado.',
  });
}
