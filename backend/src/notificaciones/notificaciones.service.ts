import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { soloVigentes, resolverAcceso } from '../autenticacion/permisos-efectivos.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { PUEDE_SER_JEFATURA } from '../funcionarios/reglas-de-jefatura.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConsultarNotificacionesDto } from './dto/consultar-notificaciones.dto.js';

/** Permiso para recibir los avisos dirigidos a Recursos Humanos. */
export const PERMISO_AVISOS_RRHH = 'notificaciones.rrhh';

/** Que origino el aviso (HU 43 CA05). Se guarda en la columna "clave". */
export type ClaveDeNotificacion =
  | 'solicitudPorAprobar'
  | 'solicitudRegistrada'
  | 'solicitudAprobada'
  | 'solicitudRechazada'
  | 'solicitudCancelada'
  | 'solicitudANombreSuyo'
  | 'incapacidadRegistrada'
  | 'horasExtraRegistradas'
  | 'saldoAjustado'
  | 'cambioEnSuExpediente'
  | 'cambioHechoPorFuncionario'
  | 'revisarJefatura'
  | 'vacacionesPorVencer'
  | 'constanciaFallida';

export interface Aviso {
  clave: ClaveDeNotificacion;
  titulo: string;
  mensaje: string;
  /** Entidad y registro que lo originaron (solicitud, incapacidad, documento...). */
  entidad?: string;
  registroId?: string;
  /** Para avisos que no deben repetirse (por ejemplo, la fecha del aniversario). */
  referencia?: string;
  /** Pantalla que abre el aviso (ruta interna). */
  enlace?: string;
}

/** Quien NO debe recibir el aviso (normalmente quien hizo la accion: nadie se avisa a si mismo). */
interface Opciones {
  excepto?: string | null;
}

type Cliente = Prisma.TransactionClient | PrismaService;

export interface NotificacionDeLista {
  id: string;
  clave: string;
  titulo: string;
  mensaje: string;
  entidad: string | null;
  registroId: string | null;
  enlace: string | null;
  leida: boolean;
  fechaCreacion: string;
}

const SELECCION = {
  id: true,
  clave: true,
  titulo: true,
  mensaje: true,
  entidad: true,
  registroId: true,
  enlace: true,
  leida: true,
  fechaCreacion: true,
} satisfies Prisma.notificacionSelect;

/**
 * Notificaciones dentro de SINERGIA (Sprint 3, HU 42-44).
 *
 * Servicio CENTRAL: ningun modulo arma sus propios avisos ni decide por su
 * cuenta a quien le llegan. Los modulos llaman a uno de estos metodos y aqui
 * se resuelve el destinatario:
 *   - avisarAUsuarios:      a cuentas concretas (por ejemplo, la jefatura que aprueba).
 *   - avisarAFuncionario:   a la cuenta de una persona (si tiene y esta activa).
 *   - avisarAJefaturaDe:    a la jefatura inmediata de una persona.
 *   - avisarARrhh:          a quienes tienen el permiso notificaciones.rrhh.
 *   - avisarCambioDeExpediente: la regla general de expedientes (10/10):
 *       si la persona cambio algo suyo, se avisa a RRHH; si fue otra persona
 *       (RRHH), se le avisa a la persona.
 *
 * Reglas:
 *   - Solo dentro del sistema: ninguna va por correo (decision 10/10).
 *   - Nadie se avisa a si mismo (opcion "excepto").
 *   - Solo cuentas activas; un funcionario sin cuenta no recibe nada.
 *   - Un aviso NUNCA hace fallar la operacion que lo origino: si algo sale
 *     mal, se anota en el registro (log) y la operacion sigue.
 *   - No va a la bitacora: un aviso no es un cambio sobre los datos.
 */
@Injectable()
export class NotificacionesService {
  private readonly registro = new Logger('Notificaciones');

  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------------ */
  /* Consulta (cada quien, las suyas: HU 42 CA05)                        */
  /* ------------------------------------------------------------------ */

  async consultar(filtros: ConsultarNotificacionesDto, quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<NotificacionDeLista> & { sinLeer: number }> {
    const donde: Prisma.notificacionWhereInput = { usuarioDestinoId: quienActua.id };
    if (filtros.estado === 'sinLeer') donde.leida = false;
    if (filtros.estado === 'leidas') donde.leida = true;
    const [total, filas, sinLeer] = await Promise.all([
      this.prisma.notificacion.count({ where: donde }),
      this.prisma.notificacion.findMany({
        where: donde,
        orderBy: [{ fechaCreacion: 'desc' }, { id: 'asc' }],
        skip: (filtros.pagina - 1) * filtros.tamano,
        take: filtros.tamano,
        select: SELECCION,
      }),
      this.contarSinLeer(quienActua.id),
    ]);
    return { ...armarPagina(filas.map(aLista), total, filtros.pagina, filtros.tamano), sinLeer };
  }

  /** Para la campana: cuantas sin leer y las mas recientes. */
  async resumen(quienActua: UsuarioAutenticado): Promise<{ sinLeer: number; recientes: NotificacionDeLista[] }> {
    const [sinLeer, recientes] = await Promise.all([
      this.contarSinLeer(quienActua.id),
      this.prisma.notificacion.findMany({
        where: { usuarioDestinoId: quienActua.id },
        orderBy: [{ fechaCreacion: 'desc' }, { id: 'asc' }],
        take: 6,
        select: SELECCION,
      }),
    ]);
    return { sinLeer, recientes: recientes.map(aLista) };
  }

  /** Marca una como leida (HU 44 CA01). Solo las propias: la ajena "no existe". */
  async marcarLeida(id: string, quienActua: UsuarioAutenticado): Promise<NotificacionDeLista> {
    const fila = await this.prisma.notificacion.findFirst({ where: { id, usuarioDestinoId: quienActua.id }, select: { id: true } });
    if (!fila) throw new NotFoundException({ codigo: 'NOTIFICACION_NO_ENCONTRADA', message: 'No se encontró la notificación.' });
    return aLista(await this.prisma.notificacion.update({ where: { id }, data: { leida: true }, select: SELECCION }));
  }

  async marcarTodasLeidas(quienActua: UsuarioAutenticado): Promise<{ marcadas: number }> {
    const r = await this.prisma.notificacion.updateMany({ where: { usuarioDestinoId: quienActua.id, leida: false }, data: { leida: true } });
    return { marcadas: r.count };
  }

  private contarSinLeer(usuarioId: string): Promise<number> {
    return this.prisma.notificacion.count({ where: { usuarioDestinoId: usuarioId, leida: false } });
  }

  /* ------------------------------------------------------------------ */
  /* Generacion (HU 43)                                                  */
  /* ------------------------------------------------------------------ */

  /** A cuentas concretas. Ignora las repetidas, las nulas, la de "excepto" y las que no estan activas. */
  async avisarAUsuarios(usuarioIds: (string | null | undefined)[], aviso: Aviso, opciones: Opciones = {}, cliente: Cliente = this.prisma): Promise<number> {
    try {
      const candidatos = [...new Set(usuarioIds.filter((id): id is string => Boolean(id) && id !== opciones.excepto))];
      if (!candidatos.length) return 0;
      const activos = await cliente.usuario.findMany({ where: { id: { in: candidatos }, estado: 'activo' }, select: { id: true } });
      if (!activos.length) return 0;
      await cliente.notificacion.createMany({
        data: activos.map((u) => ({
          usuarioDestinoId: u.id,
          clave: aviso.clave,
          titulo: aviso.titulo.slice(0, 200),
          mensaje: aviso.mensaje.slice(0, 1000),
          entidad: aviso.entidad ?? null,
          registroId: aviso.registroId ?? null,
          referencia: aviso.referencia ?? null,
          enlace: aviso.enlace ?? null,
        })),
      });
      return activos.length;
    } catch (error) {
      this.registro.warn(`No se pudo crear el aviso "${aviso.clave}": ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /** A la cuenta de una persona (si tiene una activa). */
  async avisarAFuncionario(funcionarioId: string, aviso: Aviso, opciones: Opciones = {}, cliente: Cliente = this.prisma): Promise<number> {
    const cuenta = await cliente.usuario.findFirst({ where: { funcionarioId }, select: { id: true } }).catch(() => null);
    return this.avisarAUsuarios([cuenta?.id], aviso, opciones, cliente);
  }

  /** A la jefatura inmediata de una persona (si tiene y su cuenta esta activa). */
  async avisarAJefaturaDe(funcionarioId: string, aviso: Aviso, opciones: Opciones = {}, cliente: Cliente = this.prisma): Promise<number> {
    const f = await cliente.funcionario
      .findUnique({ where: { id: funcionarioId }, select: { jefatura: { select: { usuario: { select: { id: true } } } } } })
      .catch(() => null);
    return this.avisarAUsuarios([f?.jefatura?.usuario?.id], aviso, opciones, cliente);
  }

  /** A Recursos Humanos: las cuentas activas con el permiso notificaciones.rrhh (vigente). */
  async avisarARrhh(aviso: Aviso, opciones: Opciones = {}, cliente: Cliente = this.prisma): Promise<number> {
    const ids = await this.cuentasDeRrhh(cliente).catch(() => []);
    return this.avisarAUsuarios(ids, aviso, opciones, cliente);
  }

  /**
   * Regla general de los expedientes (decision de Josthyn, 10/10):
   *   - la persona cambio algo SUYO  -> se avisa a RRHH;
   *   - otra persona (RRHH) cambio algo de ella -> se le avisa a la persona.
   * "que" completa la frase: "actualizó sus datos personales", "subió el documento «X»"...
   */
  async avisarCambioDeExpediente(
    datos: { funcionarioId: string; quienActua: UsuarioAutenticado; que: string; entidad: string; registroId?: string; pestana?: string },
    cliente: Cliente = this.prisma,
  ): Promise<number> {
    const { funcionarioId, quienActua } = datos;
    const pestana = datos.pestana ? `?pestana=${datos.pestana}` : '';
    if (quienActua.funcionarioId === funcionarioId) {
      const nombre = await this.nombreDe(funcionarioId, cliente);
      return this.avisarARrhh(
        {
          clave: 'cambioHechoPorFuncionario',
          titulo: `${nombre} actualizó su expediente`,
          mensaje: `${nombre} ${datos.que}.`,
          entidad: datos.entidad,
          registroId: datos.registroId ?? funcionarioId,
          enlace: `/funcionarios/${funcionarioId}/expediente${pestana}`,
        },
        { excepto: quienActua.id },
        cliente,
      );
    }
    const quien = await this.nombreDeCuenta(quienActua, cliente);
    return this.avisarAFuncionario(
      funcionarioId,
      {
        clave: 'cambioEnSuExpediente',
        titulo: 'Cambio en su expediente',
        mensaje: `${quien} ${datos.que}.`,
        entidad: datos.entidad,
        registroId: datos.registroId ?? funcionarioId,
        enlace: `/mi-expediente${pestana}`,
      },
      { excepto: quienActua.id },
      cliente,
    );
  }

  /** ¿Ya se envio este aviso periodico? (evita repetir el de vacaciones por vencer o el de jefatura). */
  async yaSeAviso(clave: ClaveDeNotificacion, registroId: string, referencia: string): Promise<boolean> {
    return (await this.prisma.notificacion.count({ where: { clave, registroId, referencia } })) > 0;
  }

  /**
   * "Revisar jefatura" (decision 30/09: cuando exista el modulo, se notifica):
   * a RRHH, una sola vez por persona y jefatura vieja, cuando su jefatura ya no
   * puede serlo (salio, perdio el rol Aprobador o le inactivaron la cuenta).
   * La llaman la revision periodica y las operaciones que pueden causarlo.
   */
  async avisarJefaturasPorRevisar(): Promise<number> {
    try {
      const filas = await this.prisma.funcionario.findMany({
        where: { estado: 'activo', jefatura: { is: { NOT: PUEDE_SER_JEFATURA } } },
        select: {
          id: true,
          nombre: true,
          primerApellido: true,
          segundoApellido: true,
          jefatura: { select: { id: true, nombre: true, primerApellido: true } },
        },
      });
      let avisos = 0;
      for (const f of filas) {
        if (!f.jefatura || (await this.yaSeAviso('revisarJefatura', f.id, f.jefatura.id))) continue;
        const nombre = [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');
        avisos += await this.avisarARrhh({
          clave: 'revisarJefatura',
          titulo: 'Asignar nueva jefatura',
          mensaje: `${nombre} necesita una jefatura nueva: ${f.jefatura.nombre} ${f.jefatura.primerApellido} ya no puede aprobar sus solicitudes.`,
          entidad: 'funcionario',
          registroId: f.id,
          referencia: f.jefatura.id,
          enlace: `/funcionarios?jefatura=revisar&ver=${f.id}`,
        });
      }
      return avisos;
    } catch (error) {
      this.registro.warn(`No se pudo revisar las jefaturas: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /* ------------------------------------------------------------------ */

  /** Cuentas activas con el permiso de avisos de RRHH (mismo calculo de permisos que la sesion). */
  private async cuentasDeRrhh(cliente: Cliente): Promise<string[]> {
    const cuentas = await cliente.usuario.findMany({
      where: {
        estado: 'activo',
        OR: [
          { roles: { some: { ...soloVigentes(), rol: { activo: true, permisos: { some: { permiso: { clave: PERMISO_AVISOS_RRHH } } } } } } },
          { permisos: { some: { ...soloVigentes(), otorgado: true, permiso: { clave: PERMISO_AVISOS_RRHH } } } },
        ],
      },
      select: {
        id: true,
        roles: {
          where: soloVigentes(),
          select: { rol: { select: { nombre: true, activo: true, permisos: { select: { permiso: { select: { clave: true, activo: true } } } } } } },
        },
        permisos: { where: soloVigentes(), select: { otorgado: true, permiso: { select: { clave: true, activo: true } } } },
      },
    });
    // Se confirma con el mismo calculo de la sesion (un permiso individual revocado manda sobre el rol).
    return cuentas.filter((c) => resolverAcceso(c.roles, c.permisos).permisos.includes(PERMISO_AVISOS_RRHH)).map((c) => c.id);
  }

  private async nombreDe(funcionarioId: string, cliente: Cliente): Promise<string> {
    const f = await cliente.funcionario.findUnique({ where: { id: funcionarioId }, select: { nombre: true, primerApellido: true, segundoApellido: true } });
    return f ? [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ') : 'Un funcionario';
  }

  /** "Recursos Humanos (Ana Prueba)" o el correo si la cuenta no tiene funcionario. */
  private async nombreDeCuenta(quienActua: UsuarioAutenticado, cliente: Cliente): Promise<string> {
    if (!quienActua.funcionarioId) return 'Recursos Humanos';
    const f = await cliente.funcionario.findUnique({ where: { id: quienActua.funcionarioId }, select: { nombre: true, primerApellido: true } });
    return f ? `${f.nombre} ${f.primerApellido} (Recursos Humanos)` : 'Recursos Humanos';
  }
}

function aLista(f: Prisma.notificacionGetPayload<{ select: typeof SELECCION }>): NotificacionDeLista {
  return {
    id: f.id,
    clave: f.clave,
    titulo: f.titulo,
    mensaje: f.mensaje,
    entidad: f.entidad,
    registroId: f.registroId,
    enlace: f.enlace,
    leida: f.leida,
    fechaCreacion: f.fechaCreacion.toISOString(),
  };
}
