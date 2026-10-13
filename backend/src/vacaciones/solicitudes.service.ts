import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola, rangoEnPalabras } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { desglosarDias, diasHabilesEntre, redondear } from './calculo-de-vacaciones.js';
import type {
  ConsultarCalendarioDto,
  ConsultarSolicitudesDto,
  CrearSolicitudDto,
  RechazarSolicitudDto,
} from './dto/solicitudes.dto.js';
import { DiasNoLaborablesService } from './dias-no-laborables.service.js';
import { PERMISO_ADMINISTRAR, VacacionesService, sumarMovimientos } from './vacaciones.service.js';

/** Prefijo del consecutivo por tipo: VAC-2026-0001. Un tipo nuevo sin prefijo usa SOL. */
const PREFIJOS: Record<string, string> = {
  vacaciones: 'VAC',
  permisoConGoce: 'PCG',
  permisoSinGoce: 'PSG',
  licencia: 'LIC',
  capacitacion: 'CAP',
};

/** Una solicitud no puede abarcar mas de un anio de calendario. */
const MAXIMO_DE_DIAS_CORRIDOS = 366;
/** Tope de eventos que devuelve el calendario de una sola vez. */
const MAXIMO_DE_EVENTOS = 2000;

const FUNCIONARIO_RESUMIDO = {
  select: {
    id: true,
    nombre: true,
    primerApellido: true,
    segundoApellido: true,
    departamento: { select: { id: true, nombre: true } },
    usuario: { select: { id: true } },
  },
} as const;

const SELECCION_DE_LISTA = {
  id: true,
  consecutivo: true,
  estado: true,
  leidaPorAprobador: true,
  fechaSolicitud: true,
  fechaInicio: true,
  fechaFin: true,
  cantidadDias: true,
  motivo: true,
  motivoRechazo: true,
  fechaResolucion: true,
  estadoDocumentoGenerado: true,
  documentoGeneradoId: true,
  justificanteDocumentoId: true,
  tipoSolicitud: { select: { id: true, clave: true, nombre: true, colorCalendario: true, descuentaVacaciones: true, requiereAprobacion: true } },
  funcionario: FUNCIONARIO_RESUMIDO,
  usuarioSolicitante: { select: { id: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
  aprobador: { select: { id: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
} satisfies Prisma.solicitudSelect;

type FilaDeLista = Prisma.solicitudGetPayload<{ select: typeof SELECCION_DE_LISTA }>;

export interface SolicitudDeLista {
  id: string;
  consecutivo: string;
  estado: string;
  leidaPorAprobador: boolean;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  cantidadDias: number | null;
  motivo: string | null;
  motivoRechazo: string | null;
  fechaResolucion: string | null;
  tieneConstancia: boolean;
  /** Documento de la constancia en el expediente (si ya se genero). */
  constanciaId: string | null;
  /** Documento del justificante adjunto (licencias). */
  justificanteId: string | null;
  estadoDocumentoGenerado: string;
  /** "solicitud" o, en el calendario, "incapacidad" (no es una solicitud: no tiene aprobacion). */
  origen: 'solicitud' | 'incapacidad';
  /** requiereAprobacion false = es un derecho (licencia): nadie la aprueba ni la rechaza, y no se cancela. */
  tipo: { id: string; clave: string; nombre: string; color: string | null; descuentaVacaciones: boolean; requiereAprobacion: boolean };
  funcionario: { id: string; nombre: string; departamento: string | null };
  solicitadaPor: { id: string; nombre: string | null };
  aprobador: { id: string; nombre: string | null } | null;
  /** true = la hizo RRHH en nombre de la persona. */
  enNombreDeTercero: boolean;
  /** true = la jefatura inmediata es la misma persona (tope de la jerarquia): se aprobo sola. */
  autoaprobada: boolean;
}

/** Lo que se calcula antes de guardar o de mostrar la vista previa. */
interface SolicitudPreparada {
  tipo: {
    id: string;
    clave: string;
    nombre: string;
    descuentaVacaciones: boolean;
    requiereJustificante: boolean;
    requiereAprobacion: boolean;
    tipoDocumentoGeneradoId: string | null;
  };
  funcionario: {
    id: string;
    nombreCompleto: string;
    usuarioId: string | null;
    jefaturaUsuarioId: string | null;
    tieneJefatura: boolean;
    /** La registra la propia jefatura de la persona: queda aprobada al instante. */
    laRegistraSuJefatura: boolean;
  };
  inicio: Date;
  fin: Date;
  dias: number;
  desglose: ReturnType<typeof desglosarDias>;
  enNombreDeTercero: boolean;
}

/**
 * Solicitudes de vacaciones, permisos, licencias y capacitaciones.
 *
 * Reglas (Fichas 22 a 25 y 31):
 *  - Una sola tabla para todos los tramites; el catalogo tipoSolicitud dice
 *    como se comporta cada uno (si descuenta vacaciones, si pide justificante).
 *  - Los dias son habiles y enteros: lunes a viernes sin feriados.
 *  - La aprueba la jefatura inmediata (T-1). Quien esta en el tope de la
 *    jerarquia (sin jefatura) se aprueba solo.
 *  - Se puede cancelar solo mientras la jefatura no la haya abierto.
 *  - Las vacaciones validan saldo al pedir y al aprobar; al aprobar se
 *    descuentan (movimiento de consumo con la fecha de inicio).
 *  - Quien aprueba o rechaza queda en la bitacora; consultar no se audita (T-4).
 */
@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly vacaciones: VacacionesService,
    private readonly feriados: DiasNoLaborablesService,
    private readonly modulos: ModuleRef,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private readonly registro = new Logger('Solicitudes');

  /**
   * Constancia en PDF al aprobarse (HU 26). La genera ConstanciasService, que
   * vive en el modulo de ausencias (necesita la gestion documental, que a su
   * vez depende de este modulo): por eso se busca en tiempo de ejecucion y no
   * se inyecta. Nunca hace fallar la aprobacion: si algo sale mal, la
   * solicitud queda con la constancia "fallida" para que RRHH la reintente.
   */
  private async generarConstanciaSiAplica(solicitudId: string, usuarioOrigenId: string): Promise<void> {
    try {
      const generador = this.modulos.get<{ generar(id: string, usuario: string): Promise<boolean> }>('GENERADOR_DE_CONSTANCIAS', { strict: false });
      await generador.generar(solicitudId, usuarioOrigenId);
    } catch (error) {
      this.registro.error(`No se pudo pedir la constancia de ${solicitudId}: ${(error as Error).message}`);
    }
  }

  /* ================================================================== */
  /* Catalogo                                                            */
  /* ================================================================== */

  async tipos(): Promise<unknown[]> {
    return this.prisma.tipoSolicitud.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        clave: true,
        nombre: true,
        descripcion: true,
        descuentaVacaciones: true,
        requiereJustificante: true,
        requiereAprobacion: true,
        colorCalendario: true,
      },
    });
  }

  /* ================================================================== */
  /* Vista previa y creacion                                             */
  /* ================================================================== */

  /**
   * Calcula lo que pasaria si se hiciera la solicitud, sin guardar nada: los
   * dias habiles, el desglose dia por dia y el saldo. Si algo la impediria,
   * lo dice en "problema" (con el mismo codigo que daria al crearla).
   * El justificante NO se exige aqui: la pantalla lo pide en el paso
   * siguiente; si falta, la respuesta lo dice con faltaJustificante (al
   * crear si se exige).
   */
  async calcular(datos: CrearSolicitudDto, quienActua: UsuarioAutenticado): Promise<unknown> {
    try {
      const p = await this.preparar(datos, quienActua, this.prisma, { sinExigirJustificante: true });
      const saldo = p.tipo.descuentaVacaciones ? await this.vacaciones.resumen(p.funcionario.id) : null;
      return {
        valida: true,
        problema: null,
        diasHabiles: p.dias,
        desglose: p.desglose,
        saldo: saldo ? { libre: saldo.libre, quedaria: redondear(saldo.libre - p.dias) } : null,
        autoaprobada: seApruebaAlCrear(p),
        laApruebaSuJefatura: p.funcionario.laRegistraSuJefatura,
        faltaJustificante: p.tipo.requiereJustificante && !datos.justificanteDocumentoId,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        const cuerpo = error.getResponse() as { codigo?: string; message?: string };
        const hechos = await this.desgloseSiSePuede(datos);
        return { valida: false, problema: { codigo: cuerpo.codigo, mensaje: cuerpo.message }, ...hechos };
      }
      throw error;
    }
  }

  async crear(datos: CrearSolicitudDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<SolicitudDeLista> {
    const primera = await this.preparar(datos, quienActua);
    if (primera.tipo.descuentaVacaciones) await this.vacaciones.sincronizar(primera.funcionario.id);

    for (let intento = 1; ; intento++) {
      try {
        const creada = await this.prisma.$transaction(async (tx) => {
          // Mientras se valida el saldo y se guarda, nadie mas toca a esta persona.
          await tx.$queryRaw`SELECT id FROM funcionario WHERE id = ${primera.funcionario.id} FOR UPDATE`;

          // Se vuelve a validar dentro del bloqueo (traslapes y saldo).
          const p = await this.preparar(datos, quienActua, tx);
          const autoaprueba = seApruebaAlCrear(p);
          // Sin jefatura, la aprueba la propia persona; con jefatura, siempre la jefatura (aunque la registre ella y quede aprobada).
          const aprobadorId = p.funcionario.tieneJefatura ? p.funcionario.jefaturaUsuarioId : (p.funcionario.usuarioId ?? quienActua.id);
          const ahora = new Date();

          const fila = await tx.solicitud.create({
            data: {
              consecutivo: await this.siguienteConsecutivo(tx, p.tipo.clave),
              tipoSolicitudId: p.tipo.id,
              funcionarioId: p.funcionario.id,
              usuarioSolicitanteId: quienActua.id,
              aprobadorId,
              estado: autoaprueba ? 'aprobada' : 'pendiente',
              leidaPorAprobador: autoaprueba,
              fechaInicio: p.inicio,
              fechaFin: p.fin,
              cantidadDias: p.dias,
              motivo: datos.motivo ?? null,
              justificanteDocumentoId: datos.justificanteDocumentoId ?? null,
              fechaResolucion: autoaprueba ? ahora : null,
              usuarioResolucionId: autoaprueba ? quienActua.id : null,
              estadoDocumentoGenerado: autoaprueba && p.tipo.tipoDocumentoGeneradoId ? 'pendiente' : 'noAplica',
            },
            select: { id: true },
          });

          if (autoaprueba && p.tipo.descuentaVacaciones) {
            await this.registrarConsumo(tx, p.funcionario.id, fila.id, p.dias, p.inicio, p.tipo.nombre, quienActua.id);
          }

          await this.bitacora.registrar(
            {
              usuarioId: quienActua.id,
              funcionarioAfectadoId: p.funcionario.id,
              entidad: 'solicitud',
              registroAfectadoId: fila.id,
              accion: 'crear',
              direccionIp,
              datosNuevos: {
                tipo: p.tipo.nombre,
                fechaInicio: aFechaSola(p.inicio),
                fechaFin: aFechaSola(p.fin),
                dias: p.dias,
                enNombreDeTercero: p.enNombreDeTercero,
              },
              descripcion: `Solicitó ${p.tipo.nombre.toLowerCase()} del ${aFechaSola(p.inicio)} al ${aFechaSola(p.fin)} (${p.dias} día(s) hábil(es))${p.enNombreDeTercero ? ' en nombre de otra persona' : ''}.`,
            },
            tx,
          );
          if (autoaprueba) {
            await this.bitacora.registrar(
              {
                usuarioId: quienActua.id,
                funcionarioAfectadoId: p.funcionario.id,
                entidad: 'solicitud',
                registroAfectadoId: fila.id,
                accion: 'aprobar',
                direccionIp,
                descripcion: p.funcionario.laRegistraSuJefatura
                  ? 'Aprobada al registrarla: la registró la propia jefatura de la persona.'
                  : 'Aprobada automáticamente: la persona está en el tope de la jerarquía.',
              },
              tx,
            );
          }
          return fila.id;
        });
        await this.generarConstanciaSiAplica(creada, quienActua.id);
        const nueva = await this.detalleSinPermisos(creada);
        await this.avisar('creada', nueva, quienActua);
        return nueva;
      } catch (error) {
        // El consecutivo es unico: si dos solicitudes nacen a la vez, la segunda reintenta.
        if (esChoqueDeUnicidad(error) && intento < 5) continue;
        throw error;
      }
    }
  }

  /* ================================================================== */
  /* Resolver                                                            */
  /* ================================================================== */

  async aprobar(id: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<SolicitudDeLista> {
    const previa = await this.cargarParaResolver(id, quienActua);
    if (previa.tipoSolicitud.descuentaVacaciones) await this.vacaciones.sincronizar(previa.funcionarioId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM funcionario WHERE id = ${previa.funcionarioId} FOR UPDATE`;

      // Se relee dentro del bloqueo: otra persona pudo haberla resuelto mientras tanto.
      const s = await tx.solicitud.findUniqueOrThrow({
        where: { id },
        select: { estado: true, cantidadDias: true, fechaInicio: true, tipoSolicitud: { select: { nombre: true, descuentaVacaciones: true, tipoDocumentoGeneradoId: true } } },
      });
      if (s.estado !== 'pendiente') throw this.yaResuelta(s.estado);

      const dias = Number(s.cantidadDias ?? 0);
      if (s.tipoSolicitud.descuentaVacaciones) {
        const disponible = await sumarMovimientos(tx, previa.funcionarioId, null);
        if (disponible < dias) {
          throw new BadRequestException({
            codigo: 'SALDO_INSUFICIENTE',
            message: `El saldo ya no alcanza: tiene ${disponible} día(s) y la solicitud pide ${dias}.`,
          });
        }
        await this.registrarConsumo(tx, previa.funcionarioId, id, dias, s.fechaInicio, s.tipoSolicitud.nombre, quienActua.id);
      }

      await tx.solicitud.update({
        where: { id },
        data: {
          estado: 'aprobada',
          leidaPorAprobador: true,
          fechaResolucion: new Date(),
          usuarioResolucionId: quienActua.id,
          estadoDocumentoGenerado: s.tipoSolicitud.tipoDocumentoGeneradoId ? 'pendiente' : 'noAplica',
        },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: previa.funcionarioId,
          entidad: 'solicitud',
          registroAfectadoId: id,
          accion: 'aprobar',
          direccionIp,
          descripcion: `Aprobó la solicitud ${previa.consecutivo}.`,
        },
        tx,
      );
    });

    await this.generarConstanciaSiAplica(id, quienActua.id);
    const aprobada = await this.detalleSinPermisos(id);
    await this.avisar('aprobada', aprobada, quienActua);
    return aprobada;
  }

  async rechazar(id: string, datos: RechazarSolicitudDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<SolicitudDeLista> {
    const previa = await this.cargarParaResolver(id, quienActua);
    await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.solicitud.updateMany({
        where: { id, estado: 'pendiente' },
        data: {
          estado: 'rechazada',
          leidaPorAprobador: true,
          fechaResolucion: new Date(),
          usuarioResolucionId: quienActua.id,
          motivoRechazo: datos.motivo,
        },
      });
      if (resultado.count === 0) throw this.yaResuelta('resuelta');
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: previa.funcionarioId,
          entidad: 'solicitud',
          registroAfectadoId: id,
          accion: 'rechazar',
          direccionIp,
          datosNuevos: { motivo: datos.motivo },
          descripcion: `Rechazó la solicitud ${previa.consecutivo}.`,
        },
        tx,
      );
    });
    const rechazada = await this.detalleSinPermisos(id);
    await this.avisar('rechazada', rechazada, quienActua);
    return rechazada;
  }

  /**
   * Cancelar. Dos casos:
   *  - Pendiente: quien la hizo (o la persona) mientras la jefatura no la
   *    haya abierto (Ficha 23).
   *  - Aprobada: solo quien se la aprobo a si mismo (tope de la jerarquia,
   *    decision 01/10) y antes de que empiece. Si descontaba vacaciones, los
   *    dias vuelven al saldo con un movimiento de devolucion (nada se borra).
   *    La pantalla pide doble confirmacion: no se puede deshacer.
   */
  async cancelar(id: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<SolicitudDeLista> {
    const s = await this.prisma.solicitud.findUnique({
      where: { id },
      select: {
        id: true,
        consecutivo: true,
        estado: true,
        leidaPorAprobador: true,
        usuarioSolicitanteId: true,
        funcionarioId: true,
        aprobadorId: true,
        fechaInicio: true,
        cantidadDias: true,
        tipoSolicitud: { select: { nombre: true, descuentaVacaciones: true, requiereAprobacion: true } },
      },
    });
    if (!s) throw this.noEncontrada();
    if (!s.tipoSolicitud.requiereAprobacion) {
      throw new ConflictException({
        codigo: 'SOLICITUD_NO_CANCELABLE',
        message: `${s.tipoSolicitud.nombre}: es un derecho y quedó registrada con su comprobante; no se cancela. Si hubo un error, coordínelo con Recursos Humanos.`,
      });
    }
    const esSuya = s.usuarioSolicitanteId === quienActua.id || (quienActua.funcionarioId !== null && s.funcionarioId === quienActua.funcionarioId);
    if (!esSuya) {
      throw new ForbiddenException({ codigo: 'SOLICITUD_AJENA', message: 'Solo quien hizo la solicitud puede cancelarla.' });
    }

    if (s.estado === 'aprobada') {
      const seLaAproboASiMismo = s.aprobadorId === quienActua.id && s.funcionarioId === quienActua.funcionarioId;
      if (!seLaAproboASiMismo) {
        throw new ConflictException({
          codigo: 'SOLICITUD_YA_RESUELTA',
          message: 'Esta solicitud ya la aprobó su jefatura. Para cambiarla, coordínelo directamente con ella.',
        });
      }
      if (s.fechaInicio <= hoyEnCostaRica()) {
        throw new ConflictException({
          codigo: 'SOLICITUD_YA_INICIADA',
          message: 'Esta solicitud ya empezó: no se puede cancelar. Si hace falta corregir el saldo, Recursos Humanos puede hacer un ajuste.',
        });
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM funcionario WHERE id = ${s.funcionarioId} FOR UPDATE`;
        const resultado = await tx.solicitud.updateMany({
          where: { id, estado: 'aprobada' },
          data: { estado: 'cancelada', fechaResolucion: new Date(), usuarioResolucionId: quienActua.id },
        });
        if (resultado.count === 0) throw this.yaResuelta('cancelada');
        // La constancia ya no vale: se da de baja (no se borra).
        await tx.documento.updateMany({
          where: { comoGenerado: { some: { id } }, vigente: true },
          data: { vigente: false, fechaBaja: new Date(), usuarioBajaId: quienActua.id, motivoBaja: `Se canceló la solicitud ${s.consecutivo}.` },
        });
        if (s.tipoSolicitud.descuentaVacaciones) {
          // Devolucion: un consumo positivo con la misma fecha, asi el saldo de cualquier dia queda como si nunca se hubiera pedido.
          const consumido = await tx.movimientoVacaciones.aggregate({ where: { solicitudId: id, tipo: 'consumo' }, _sum: { cantidadDias: true } });
          const aDevolver = -Number(consumido._sum.cantidadDias ?? 0);
          if (aDevolver > 0) {
            await tx.movimientoVacaciones.create({
              data: {
                funcionarioId: s.funcionarioId,
                tipo: 'consumo',
                cantidadDias: aDevolver,
                fechaMovimiento: s.fechaInicio,
                solicitudId: id,
                usuarioRegistroId: quienActua.id,
                observacion: `Devolución: se canceló ${s.consecutivo}`,
              },
            });
          }
        }
        await this.bitacora.registrar(
          {
            usuarioId: quienActua.id,
            funcionarioAfectadoId: s.funcionarioId,
            entidad: 'solicitud',
            registroAfectadoId: id,
            accion: 'cancelar',
            direccionIp,
            datosAnteriores: { estado: 'aprobada' },
            descripcion: `Canceló la solicitud aprobada ${s.consecutivo}${s.tipoSolicitud.descuentaVacaciones ? ` y se devolvieron ${Number(s.cantidadDias ?? 0)} día(s) al saldo` : ''}.`,
          },
          tx,
        );
      });
      const cancelada = await this.detalleSinPermisos(id);
      await this.avisar('canceladaAprobada', cancelada, quienActua);
      return cancelada;
    }

    if (s.estado !== 'pendiente') {
      throw new ConflictException({ codigo: 'SOLICITUD_YA_RESUELTA', message: 'Solo se pueden cancelar solicitudes pendientes.' });
    }
    if (s.leidaPorAprobador) {
      throw new ConflictException({
        codigo: 'SOLICITUD_YA_LEIDA',
        message: 'Su jefatura ya abrió esta solicitud. Para cambiarla, coordínelo directamente con ella.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // La condicion de "no leida" se repite en la escritura: si la jefatura
      // la abrio en este instante, no se cancela.
      const resultado = await tx.solicitud.updateMany({
        where: { id, estado: 'pendiente', leidaPorAprobador: false },
        data: { estado: 'cancelada', fechaResolucion: new Date(), usuarioResolucionId: quienActua.id },
      });
      if (resultado.count === 0) {
        throw new ConflictException({
          codigo: 'SOLICITUD_YA_LEIDA',
          message: 'Su jefatura ya abrió esta solicitud. Para cambiarla, coordínelo directamente con ella.',
        });
      }
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: s.funcionarioId,
          entidad: 'solicitud',
          registroAfectadoId: id,
          accion: 'cancelar',
          direccionIp,
          descripcion: `Canceló la solicitud ${s.consecutivo}.`,
        },
        tx,
      );
    });
    const cancelada = await this.detalleSinPermisos(id);
    await this.avisar('cancelada', cancelada, quienActua);
    return cancelada;
  }

  /**
   * Avisos de las solicitudes (Sprint 3; regla de Joseph del 13/10: RRHH se
   * entera cuando la ausencia queda en firme):
   *   - creada pendiente: solo a la jefatura que la resuelve;
   *   - creada ya aprobada (tope, la registra la jefatura, licencia): a RRHH y a la jefatura;
   *   - aprobada: a la persona y a RRHH; rechazada: solo a la persona;
   *   - cancelada pendiente: a la jefatura; cancelada ya aprobada: a la jefatura y a RRHH.
   * Si la registro o cancelo otra persona (RRHH, la jefatura), tambien se le avisa a la persona.
   * Nunca a quien hizo la accion. No hace fallar la operacion.
   */
  private async avisar(evento: 'creada' | 'aprobada' | 'rechazada' | 'cancelada' | 'canceladaAprobada', s: SolicitudDeLista, quienActua: UsuarioAutenticado): Promise<void> {
    const n = this.notificaciones;
    const op = { excepto: quienActua.id };
    const persona = s.funcionario.nombre;
    const dias = s.cantidadDias ? ` (${s.cantidadDias} ${s.cantidadDias === 1 ? 'día hábil' : 'días hábiles'})` : '';
    const que = `${s.tipo.nombre.toLowerCase()} ${rangoEnPalabras(s.fechaInicio, s.fechaFin)}${dias}`;
    const base = { entidad: 'solicitud', registroId: s.id };
    const paraLaPersona = `/mis-ausencias?pestana=solicitudes&abrir=${s.id}`;
    const paraRrhh = `/solicitudes?abrir=${s.id}`;
    const paraLaJefatura = `/calendario?alcance=equipo&mes=${s.fechaInicio.slice(0, 7)}&resaltar=${s.id}`;
    const laHizoOtro = quienActua.funcionarioId !== s.funcionario.id;
    const quienRegistro = s.solicitadaPor.nombre ?? 'Recursos Humanos';

    if (evento === 'creada' && s.estado === 'pendiente') {
      // Pendiente: solo la jefatura. RRHH se entera cuando queda en firme (Joseph, 13/10).
      await n.avisarAUsuarios([s.aprobador?.id], { ...base, clave: 'solicitudPorAprobar', titulo: 'Solicitud por aprobar', mensaje: `${persona} pidió ${que}. Le corresponde aprobarla o rechazarla (${s.consecutivo}).`, enlace: `/bandeja?abrir=${s.id}` }, op);
      if (laHizoOtro) {
        await n.avisarAFuncionario(s.funcionario.id, { ...base, clave: 'solicitudANombreSuyo', titulo: 'Se registró una solicitud a su nombre', mensaje: `${quienRegistro} registró a su nombre ${que} (${s.consecutivo}). Queda pendiente de su jefatura.`, enlace: paraLaPersona }, op);
      }
      return;
    }
    if (evento === 'creada') {
      const como = s.tipo.requiereAprobacion ? 'quedó aprobada al registrarla' : 'quedó registrada con su comprobante';
      await n.avisarARrhh({ ...base, clave: 'solicitudRegistrada', titulo: `${s.tipo.nombre}: ${persona}`, mensaje: `${persona}: ${que} ${como} (${s.consecutivo}).`, enlace: paraRrhh }, op);
      await n.avisarAJefaturaDe(s.funcionario.id, { ...base, clave: 'solicitudRegistrada', titulo: `${s.tipo.nombre}: ${persona}`, mensaje: `${persona}: ${que} ${como} (${s.consecutivo}).`, enlace: paraLaJefatura }, op);
      if (laHizoOtro) {
        await n.avisarAFuncionario(s.funcionario.id, { ...base, clave: 'solicitudANombreSuyo', titulo: 'Se registró una solicitud a su nombre', mensaje: `${quienRegistro} registró a su nombre ${que}, que ${como} (${s.consecutivo}).`, enlace: paraLaPersona }, op);
      }
      return;
    }
    if (evento === 'aprobada') {
      const descuento = s.tipo.descuentaVacaciones ? ' Los días se descontaron de su saldo.' : '';
      await n.avisarAFuncionario(s.funcionario.id, { ...base, clave: 'solicitudAprobada', titulo: 'Solicitud aprobada', mensaje: `${s.aprobador?.nombre ?? 'Su jefatura'} aprobó su solicitud de ${que} (${s.consecutivo}).${descuento}`, enlace: paraLaPersona }, op);
      await n.avisarARrhh({ ...base, clave: 'solicitudAprobada', titulo: `Aprobada: ${s.tipo.nombre.toLowerCase()} de ${persona}`, mensaje: `${s.aprobador?.nombre ?? 'La jefatura'} aprobó ${que} de ${persona} (${s.consecutivo}).`, enlace: paraRrhh }, op);
      return;
    }
    if (evento === 'rechazada') {
      await n.avisarAFuncionario(s.funcionario.id, { ...base, clave: 'solicitudRechazada', titulo: 'Solicitud rechazada', mensaje: `${s.aprobador?.nombre ?? 'Su jefatura'} rechazó su solicitud de ${que} (${s.consecutivo}). Motivo: ${s.motivoRechazo ?? 'sin indicar'}.`, enlace: paraLaPersona }, op);
      return;
    }
    // Cancelada: la jefatura siempre; RRHH solo si ya estaba aprobada (si estaba pendiente, RRHH nunca se entero).
    await n.avisarAUsuarios([s.aprobador?.id], { ...base, clave: 'solicitudCancelada', titulo: 'Solicitud cancelada', mensaje: `Se canceló ${que} de ${persona} (${s.consecutivo}).`, enlace: paraLaJefatura }, op);
    if (evento === 'canceladaAprobada') await n.avisarARrhh({ ...base, clave: 'solicitudCancelada', titulo: `Cancelada: ${s.tipo.nombre.toLowerCase()} de ${persona}`, mensaje: `Se canceló ${que} de ${persona} (${s.consecutivo}).`, enlace: paraRrhh }, op);
    if (laHizoOtro) {
      await n.avisarAFuncionario(s.funcionario.id, { ...base, clave: 'solicitudCancelada', titulo: 'Se canceló una solicitud suya', mensaje: `Se canceló su solicitud de ${que} (${s.consecutivo}).`, enlace: paraLaPersona }, op);
    }
  }

  /* ================================================================== */
  /* Consultas                                                           */
  /* ================================================================== */

  /**
   * Una solicitud. La ven: quien la pidio, la persona afectada, su jefatura
   * (a quien le llega) y RRHH. Si la abre la jefatura por primera vez, queda
   * marcada como leida y ya no se puede cancelar.
   */
  async detalle(id: string, quienActua: UsuarioAutenticado): Promise<SolicitudDeLista> {
    const s = await this.prisma.solicitud.findUnique({
      where: { id },
      select: { id: true, estado: true, funcionarioId: true, usuarioSolicitanteId: true, aprobadorId: true, leidaPorAprobador: true },
    });
    if (!s) throw this.noEncontrada();

    const esElAprobador = s.aprobadorId === quienActua.id;
    const permitido =
      esElAprobador ||
      s.usuarioSolicitanteId === quienActua.id ||
      s.funcionarioId === quienActua.funcionarioId ||
      quienActua.permisos.includes(PERMISO_ADMINISTRAR);
    if (!permitido) {
      throw new ForbiddenException({ codigo: 'SOLICITUD_AJENA', message: 'No tiene acceso a esa solicitud.' });
    }

    // Se marca leida cuando la abre quien la va a resolver (no cuando la ve su propio autor).
    if (esElAprobador && s.estado === 'pendiente' && !s.leidaPorAprobador && s.usuarioSolicitanteId !== quienActua.id) {
      await this.prisma.solicitud.updateMany({ where: { id, leidaPorAprobador: false }, data: { leidaPorAprobador: true } });
    }
    return this.detalleSinPermisos(id);
  }

  /** Las solicitudes de la propia persona. */
  async mias(filtros: ConsultarSolicitudesDto, quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<SolicitudDeLista>> {
    if (!quienActua.funcionarioId) return armarPagina([], 0, filtros.pagina, filtros.tamano);
    return this.listar({ funcionarioId: quienActua.funcionarioId, ...this.filtrosComunes(filtros) }, filtros, 'desc');
  }

  /** La bandeja de la jefatura: lo que le toca resolver. Por omision, solo pendientes. */
  async bandeja(filtros: ConsultarSolicitudesDto, quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<SolicitudDeLista>> {
    const estado = filtros.estado ?? 'pendiente';
    return this.listar(
      { aprobadorId: quienActua.id, ...this.filtrosComunes({ ...filtros, estado }) },
      filtros,
      estado === 'pendiente' ? 'asc' : 'desc',
    );
  }

  /** Todas, para RRHH. */
  async todas(filtros: ConsultarSolicitudesDto): Promise<PaginaDeResultados<SolicitudDeLista>> {
    const donde: Prisma.solicitudWhereInput = { ...this.filtrosComunes(filtros) };
    if (filtros.funcionarioId) donde.funcionarioId = filtros.funcionarioId;
    if (filtros.departamentoId) donde.funcionario = { departamentoId: filtros.departamentoId };
    if (filtros.busqueda) {
      const palabras = filtros.busqueda.split(/\s+/).filter(Boolean).slice(0, 5);
      donde.AND = palabras.map((p) => ({
        OR: [
          { consecutivo: { contains: p } },
          { funcionario: { cedula: { contains: p } } },
          { funcionario: { nombre: { contains: p } } },
          { funcionario: { primerApellido: { contains: p } } },
          { funcionario: { segundoApellido: { contains: p } } },
        ],
      }));
    }
    return this.listar(donde, filtros, 'desc');
  }

  /**
   * Eventos del calendario. Tres alcances (T-3): "propio" (la persona),
   * "equipo" (quien tiene personal a cargo) y "todos" (RRHH). Las canceladas
   * no se pintan. Siempre se devuelven los feriados del rango.
   */
  async calendario(filtros: ConsultarCalendarioDto, quienActua: UsuarioAutenticado): Promise<unknown> {
    const desde = interpretarFechaSola(filtros.desde, '"desde"');
    const hasta = interpretarFechaSola(filtros.hasta, '"hasta"');
    if (hasta < desde || (hasta.getTime() - desde.getTime()) / 86_400_000 > 400) {
      throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'El rango del calendario no es válido (máximo 400 días).' });
    }

    const donde: Prisma.solicitudWhereInput = {
      estado: { in: ['pendiente', 'aprobada', 'rechazada'] },
      fechaInicio: { lte: hasta },
      fechaFin: { gte: desde },
    };

    if (filtros.alcance === 'propio') {
      if (!quienActua.funcionarioId) throw this.sinFuncionario();
      donde.funcionarioId = quienActua.funcionarioId;
    } else if (filtros.alcance === 'equipo') {
      if (!quienActua.funcionarioId || !quienActua.permisos.includes('solicitudes.aprobar')) {
        throw new ForbiddenException({ codigo: 'CALENDARIO_NO_PERMITIDO', message: 'Solo las jefaturas ven el calendario de su equipo.' });
      }
      // El equipo y la propia jefatura (sus dias tambien cuentan para planificar).
      donde.funcionario = { OR: [{ jefaturaId: quienActua.funcionarioId }, { id: quienActua.funcionarioId }] };
      if (filtros.departamentoId) donde.funcionario = { AND: [donde.funcionario, { departamentoId: filtros.departamentoId }] };
    } else {
      if (!quienActua.permisos.includes(PERMISO_ADMINISTRAR)) {
        throw new ForbiddenException({ codigo: 'CALENDARIO_NO_PERMITIDO', message: 'Solo Recursos Humanos ve el calendario de todo el personal.' });
      }
      if (filtros.departamentoId) donde.funcionario = { departamentoId: filtros.departamentoId };
    }

    // Las incapacidades vigentes tambien se pintan (mismo alcance que las solicitudes).
    const dondeIncapacidad: Prisma.incapacidadWhereInput = {
      vigente: true,
      fechaInicio: { lte: hasta },
      fechaFin: { gte: desde },
      ...(donde.funcionarioId ? { funcionarioId: donde.funcionarioId as string } : {}),
      ...(donde.funcionario ? { funcionario: donde.funcionario as Prisma.funcionarioWhereInput } : {}),
    };

    const [filas, feriados, incapacidades] = await Promise.all([
      this.prisma.solicitud.findMany({
        where: donde,
        orderBy: [{ fechaInicio: 'asc' }, { consecutivo: 'asc' }],
        take: MAXIMO_DE_EVENTOS,
        select: SELECCION_DE_LISTA,
      }),
      this.feriadosEntre(desde, hasta),
      this.prisma.incapacidad.findMany({
        where: dondeIncapacidad,
        orderBy: { fechaInicio: 'asc' },
        take: MAXIMO_DE_EVENTOS,
        select: {
          id: true,
          consecutivo: true,
          fechaInicio: true,
          fechaFin: true,
          cantidadDias: true,
          fechaRegistro: true,
          funcionario: FUNCIONARIO_RESUMIDO,
          usuarioRegistro: { select: { id: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
        },
      }),
    ]);

    return {
      eventos: [...filas.map((f) => this.aLista(f)), ...incapacidades.map((i) => incapacidadComoEvento(i))].sort((a, b) =>
        a.fechaInicio.localeCompare(b.fechaInicio),
      ),
      feriados: [...feriados].map(([fecha, nombre]) => ({ fecha, nombre })),
      truncado: filas.length >= MAXIMO_DE_EVENTOS,
    };
  }

  /* ================================================================== */
  /* Apoyo                                                               */
  /* ================================================================== */

  /**
   * Revisa todo lo que impide la solicitud y calcula los dias. Lanza el
   * error con su codigo si algo falla. "cliente" permite repetirlo dentro de
   * la transaccion, ya con la persona bloqueada.
   */
  private async preparar(
    datos: CrearSolicitudDto,
    quienActua: UsuarioAutenticado,
    cliente: Prisma.TransactionClient | PrismaService = this.prisma,
    opciones: { sinExigirJustificante?: boolean } = {},
  ): Promise<SolicitudPreparada> {
    const tipo = await cliente.tipoSolicitud.findUnique({
      where: { id: datos.tipoSolicitudId },
      select: {
        id: true,
        clave: true,
        nombre: true,
        activo: true,
        seMideEnHoras: true,
        afectaDisponibilidad: true,
        descuentaVacaciones: true,
        requiereJustificante: true,
        requiereAprobacion: true,
        tipoDocumentoGeneradoId: true,
      },
    });
    if (!tipo || !tipo.activo || tipo.seMideEnHoras) {
      throw new BadRequestException({ codigo: 'TIPO_SOLICITUD_INVALIDO', message: 'El tipo de solicitud no existe o no está disponible.' });
    }

    // ---- A nombre de quien ----
    const enNombreDeTercero = Boolean(datos.funcionarioId && datos.funcionarioId !== quienActua.funcionarioId);
    const funcionarioId = datos.funcionarioId ?? quienActua.funcionarioId;
    if (!funcionarioId) throw this.sinFuncionario();

    const persona = await cliente.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        id: true,
        nombre: true,
        primerApellido: true,
        segundoApellido: true,
        estado: true,
        jefaturaId: true,
        usuario: { select: { id: true } },
        jefatura: { select: { usuario: { select: { id: true, estado: true } } } },
      },
    });
    if (!persona) {
      throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    }
    // En nombre de otra persona: RRHH a cualquiera; la jefatura, a su personal a cargo (decision 01/10).
    if (enNombreDeTercero) {
      const esSuJefatura =
        quienActua.permisos.includes('solicitudes.aprobar') && quienActua.funcionarioId !== null && persona.jefaturaId === quienActua.funcionarioId;
      if (!quienActua.permisos.includes(PERMISO_ADMINISTRAR) && !esSuJefatura) {
        throw new ForbiddenException({
          codigo: 'SOLICITUD_AJENA',
          message: 'Solo puede hacer solicitudes a nombre de su personal a cargo (o Recursos Humanos, de cualquiera).',
        });
      }
    }
    if (persona.estado !== 'activo') {
      throw new BadRequestException({ codigo: 'FUNCIONARIO_INACTIVO', message: 'La persona no está activa: no se pueden registrar solicitudes a su nombre.' });
    }
    const jefaturaUsuario = persona.jefatura?.usuario ?? null;
    if (persona.jefaturaId && (!jefaturaUsuario || jefaturaUsuario.estado !== 'activo')) {
      throw new BadRequestException({
        codigo: 'JEFATURA_SIN_CUENTA',
        message: 'Su jefatura no tiene una cuenta activa para recibir la solicitud. Avise a Recursos Humanos.',
      });
    }

    // ---- Fechas ----
    const inicio = interpretarFechaSola(datos.fechaInicio, 'de inicio');
    const fin = interpretarFechaSola(datos.fechaFin, 'de fin');
    if (fin < inicio) {
      throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    }
    if ((fin.getTime() - inicio.getTime()) / 86_400_000 + 1 > MAXIMO_DE_DIAS_CORRIDOS) {
      throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'Una solicitud no puede abarcar más de un año.' });
    }
    // De hoy en adelante, para TODOS (decision 10/10): no tiene sentido pedir vacaciones, permisos,
    // licencias o capacitaciones para un dia que ya paso. (Las incapacidades si: la boleta llega despues.)
    if (inicio < hoyEnCostaRica()) {
      throw new BadRequestException({
        codigo: 'FECHA_PASADA',
        message: 'Las solicitudes son de hoy en adelante: no se pueden pedir fechas que ya pasaron.',
      });
    }

    const feriados = await this.feriadosEntre(inicio, fin, cliente);
    const dias = diasHabilesEntre(inicio, fin, new Set(feriados.keys()));
    if (dias === 0) {
      throw new BadRequestException({
        codigo: 'SIN_DIAS_HABILES',
        message: 'Las fechas elegidas son fines de semana o feriados: no hay días hábiles que solicitar.',
      });
    }

    // ---- Traslape con otra solicitud viva ----
    if (tipo.afectaDisponibilidad) {
      const choque = await cliente.solicitud.findFirst({
        where: {
          funcionarioId,
          estado: { in: ['pendiente', 'aprobada'] },
          tipoSolicitud: { afectaDisponibilidad: true },
          fechaInicio: { lte: fin },
          fechaFin: { gte: inicio },
        },
        select: { consecutivo: true, fechaInicio: true, fechaFin: true },
      });
      if (choque) {
        throw new ConflictException({
          codigo: 'SOLICITUD_TRASLAPADA',
          message: `Ya tiene la solicitud ${choque.consecutivo} (del ${aFechaSola(choque.fechaInicio)} al ${aFechaSola(choque.fechaFin)}) que coincide con esas fechas.`,
        });
      }
    }

    // ---- Traslape con una incapacidad vigente ----
    if (tipo.afectaDisponibilidad) {
      const incapacidad = await cliente.incapacidad.findFirst({
        where: { funcionarioId, vigente: true, fechaInicio: { lte: fin }, fechaFin: { gte: inicio } },
        select: { consecutivo: true, fechaInicio: true, fechaFin: true },
      });
      if (incapacidad) {
        throw new ConflictException({
          codigo: 'INCAPACIDAD_TRASLAPADA',
          message: `Tiene una incapacidad registrada (${incapacidad.consecutivo}, del ${aFechaSola(incapacidad.fechaInicio)} al ${aFechaSola(incapacidad.fechaFin)}) que coincide con esas fechas.`,
        });
      }
    }

    // ---- Saldo (solo las que descuentan vacaciones) ----
    if (tipo.descuentaVacaciones) {
      const ancla = await cliente.movimientoVacaciones.findFirst({ where: { funcionarioId, tipo: 'saldoInicial' }, select: { id: true } });
      if (!ancla) {
        throw new BadRequestException({
          codigo: 'SALDO_NO_CARGADO',
          message: 'Recursos Humanos todavía no ha cargado el saldo de vacaciones de esta persona.',
        });
      }
      const disponible = await sumarMovimientos(cliente, funcionarioId, null);
      const reservadas = await cliente.solicitud.aggregate({
        where: { funcionarioId, estado: 'pendiente', tipoSolicitud: { descuentaVacaciones: true } },
        _sum: { cantidadDias: true },
      });
      const libre = redondear(disponible - Number(reservadas._sum.cantidadDias ?? 0));
      if (libre < dias) {
        throw new BadRequestException({
          codigo: 'SALDO_INSUFICIENTE',
          message: `El saldo no alcanza: tiene ${libre} día(s) libres y la solicitud necesita ${dias}.`,
        });
      }
    }

    // ---- Justificante ----
    if (datos.justificanteDocumentoId) {
      const documento = await cliente.documento.findFirst({
        where: { id: datos.justificanteDocumentoId, funcionarioId, vigente: true },
        select: { id: true },
      });
      if (!documento) {
        throw new BadRequestException({ codigo: 'JUSTIFICANTE_INVALIDO', message: 'El justificante no existe en el expediente de la persona.' });
      }
    } else if (tipo.requiereJustificante && !opciones.sinExigirJustificante) {
      throw new BadRequestException({ codigo: 'JUSTIFICANTE_REQUERIDO', message: `${tipo.nombre} necesita adjuntar un justificante.` });
    }

    return {
      tipo,
      funcionario: {
        id: persona.id,
        nombreCompleto: [persona.nombre, persona.primerApellido, persona.segundoApellido].filter(Boolean).join(' '),
        usuarioId: persona.usuario?.id ?? null,
        jefaturaUsuarioId: jefaturaUsuario?.id ?? null,
        tieneJefatura: Boolean(persona.jefaturaId),
        laRegistraSuJefatura: enNombreDeTercero && jefaturaUsuario !== null && jefaturaUsuario.id === quienActua.id,
      },
      inicio,
      fin,
      dias,
      desglose: desglosarDias(inicio, fin, feriados),
      enNombreDeTercero,
    };
  }

  /** Para la vista previa cuando la solicitud no es valida: igual se muestran los dias. */
  private async desgloseSiSePuede(datos: CrearSolicitudDto): Promise<{ diasHabiles?: number; desglose?: ReturnType<typeof desglosarDias> }> {
    try {
      const inicio = interpretarFechaSola(datos.fechaInicio, 'de inicio');
      const fin = interpretarFechaSola(datos.fechaFin, 'de fin');
      if (fin < inicio || (fin.getTime() - inicio.getTime()) / 86_400_000 + 1 > MAXIMO_DE_DIAS_CORRIDOS) return {};
      const feriados = await this.feriadosEntre(inicio, fin);
      return { diasHabiles: diasHabilesEntre(inicio, fin, new Set(feriados.keys())), desglose: desglosarDias(inicio, fin, feriados) };
    } catch {
      return {};
    }
  }

  /** Feriados del catalogo entre dos fechas (se repiten solos cada anio: ver feriados.ts). */
  private feriadosEntre(
    desde: Date,
    hasta: Date,
    cliente: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, string>> {
    return this.feriados.entre(desde, hasta, cliente);
  }

  private async siguienteConsecutivo(tx: Prisma.TransactionClient, clave: string): Promise<string> {
    const prefijo = `${PREFIJOS[clave] ?? 'SOL'}-${hoyEnCostaRica().getUTCFullYear()}-`;
    const ultimo = await tx.solicitud.findFirst({
      where: { consecutivo: { startsWith: prefijo } },
      orderBy: { consecutivo: 'desc' },
      select: { consecutivo: true },
    });
    const numero = ultimo ? Number(ultimo.consecutivo.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(numero).padStart(4, '0')}`;
  }

  private registrarConsumo(
    tx: Prisma.TransactionClient,
    funcionarioId: string,
    solicitudId: string,
    dias: number,
    fechaInicio: Date,
    nombreDelTipo: string,
    usuarioId: string,
  ): Promise<unknown> {
    return tx.movimientoVacaciones.create({
      data: {
        funcionarioId,
        tipo: 'consumo',
        cantidadDias: -dias,
        // El consumo cuenta desde que se toman los dias: asi un aniversario
        // anterior a las vacaciones no las "salva" del tope.
        fechaMovimiento: fechaInicio,
        solicitudId,
        usuarioRegistroId: usuarioId,
        observacion: nombreDelTipo,
      },
    });
  }

  private async cargarParaResolver(id: string, quienActua: UsuarioAutenticado) {
    const s = await this.prisma.solicitud.findUnique({
      where: { id },
      select: {
        id: true,
        consecutivo: true,
        estado: true,
        aprobadorId: true,
        funcionarioId: true,
        tipoSolicitud: { select: { descuentaVacaciones: true } },
      },
    });
    if (!s) throw this.noEncontrada();
    if (s.aprobadorId !== quienActua.id) {
      throw new ForbiddenException({ codigo: 'SOLICITUD_AJENA', message: 'Esta solicitud le corresponde a otra jefatura.' });
    }
    if (s.estado !== 'pendiente') throw this.yaResuelta(s.estado);
    return s;
  }

  private filtrosComunes(filtros: ConsultarSolicitudesDto): Prisma.solicitudWhereInput {
    const donde: Prisma.solicitudWhereInput = {};
    if (filtros.estado) donde.estado = filtros.estado;
    if (filtros.tipoSolicitudId) donde.tipoSolicitudId = filtros.tipoSolicitudId;
    if (filtros.desde) donde.fechaFin = { gte: interpretarFechaSola(filtros.desde, '"desde"') };
    if (filtros.hasta) donde.fechaInicio = { lte: interpretarFechaSola(filtros.hasta, '"hasta"') };
    return donde;
  }

  private async listar(
    donde: Prisma.solicitudWhereInput,
    paginacion: { pagina: number; tamano: number },
    orden: 'asc' | 'desc',
  ): Promise<PaginaDeResultados<SolicitudDeLista>> {
    const [total, filas] = await Promise.all([
      this.prisma.solicitud.count({ where: donde }),
      this.prisma.solicitud.findMany({
        where: donde,
        orderBy: [{ fechaSolicitud: orden }, { consecutivo: orden }],
        skip: (paginacion.pagina - 1) * paginacion.tamano,
        take: paginacion.tamano,
        select: SELECCION_DE_LISTA,
      }),
    ]);
    return armarPagina(filas.map((f) => this.aLista(f)), total, paginacion.pagina, paginacion.tamano);
  }

  private async detalleSinPermisos(id: string): Promise<SolicitudDeLista> {
    const fila = await this.prisma.solicitud.findUnique({ where: { id }, select: SELECCION_DE_LISTA });
    if (!fila) throw this.noEncontrada();
    return this.aLista(fila);
  }

  private aLista(f: FilaDeLista): SolicitudDeLista {
    const nombre = (p: { nombre: string; primerApellido: string } | null | undefined): string | null =>
      p ? `${p.nombre} ${p.primerApellido}` : null;
    return {
      id: f.id,
      consecutivo: f.consecutivo,
      estado: f.estado,
      leidaPorAprobador: f.leidaPorAprobador,
      fechaSolicitud: f.fechaSolicitud.toISOString(),
      fechaInicio: aFechaSola(f.fechaInicio)!,
      fechaFin: aFechaSola(f.fechaFin)!,
      cantidadDias: f.cantidadDias === null ? null : Number(f.cantidadDias),
      motivo: f.motivo,
      motivoRechazo: f.motivoRechazo,
      fechaResolucion: f.fechaResolucion ? f.fechaResolucion.toISOString() : null,
      tieneConstancia: Boolean(f.documentoGeneradoId),
      constanciaId: f.documentoGeneradoId,
      justificanteId: f.justificanteDocumentoId,
      estadoDocumentoGenerado: f.estadoDocumentoGenerado,
      origen: 'solicitud',
      tipo: {
        id: f.tipoSolicitud.id,
        clave: f.tipoSolicitud.clave,
        nombre: f.tipoSolicitud.nombre,
        color: f.tipoSolicitud.colorCalendario,
        descuentaVacaciones: f.tipoSolicitud.descuentaVacaciones,
        requiereAprobacion: f.tipoSolicitud.requiereAprobacion,
      },
      funcionario: {
        id: f.funcionario.id,
        nombre: [f.funcionario.nombre, f.funcionario.primerApellido, f.funcionario.segundoApellido].filter(Boolean).join(' '),
        departamento: f.funcionario.departamento?.nombre ?? null,
      },
      solicitadaPor: { id: f.usuarioSolicitante.id, nombre: nombre(f.usuarioSolicitante.funcionario) },
      aprobador: f.aprobador ? { id: f.aprobador.id, nombre: nombre(f.aprobador.funcionario) } : null,
      // La cuenta de la persona afectada es distinta de quien hizo la solicitud: la hizo RRHH por ella.
      enNombreDeTercero: f.usuarioSolicitante.id !== f.funcionario.usuario?.id,
      // Aprobada por la propia cuenta de la persona: esta en el tope de la jerarquia.
      autoaprobada: f.estado === 'aprobada' && f.aprobador !== null && f.aprobador.id === f.funcionario.usuario?.id,
    };
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', message: 'No se encontró la solicitud indicada.' });
  }

  private yaResuelta(estado: string): ConflictException {
    return new ConflictException({
      codigo: 'SOLICITUD_YA_RESUELTA',
      message: `La solicitud ya está ${estado === 'resuelta' ? 'resuelta' : estado}: no se puede volver a resolver.`,
    });
  }

  private sinFuncionario(): BadRequestException {
    return new BadRequestException({
      codigo: 'SIN_FUNCIONARIO',
      message: 'Su cuenta no está asociada a un funcionario, así que no tiene solicitudes propias.',
    });
  }
}

/** Color con que se pinta una incapacidad en el calendario. */
export const COLOR_INCAPACIDAD = '#c0392b';

/**
 * Una incapacidad con la forma de un evento del calendario. Para no exponer
 * datos medicos, el calendario solo dice "Incapacidad" (sin el tipo ni la
 * boleta); el detalle lo ve la persona y RRHH en su propia pantalla.
 */
function incapacidadComoEvento(i: {
  id: string;
  consecutivo: string;
  fechaInicio: Date;
  fechaFin: Date;
  cantidadDias: Prisma.Decimal;
  fechaRegistro: Date;
  funcionario: { id: string; nombre: string; primerApellido: string; segundoApellido: string | null; departamento: { nombre: string } | null; usuario: { id: string } | null };
  usuarioRegistro: { id: string; funcionario: { nombre: string; primerApellido: string } | null };
}): SolicitudDeLista {
  return {
    id: i.id,
    consecutivo: i.consecutivo,
    estado: 'aprobada',
    leidaPorAprobador: true,
    fechaSolicitud: i.fechaRegistro.toISOString(),
    fechaInicio: aFechaSola(i.fechaInicio)!,
    fechaFin: aFechaSola(i.fechaFin)!,
    cantidadDias: Number(i.cantidadDias),
    motivo: null,
    motivoRechazo: null,
    fechaResolucion: null,
    tieneConstancia: false,
    constanciaId: null,
    justificanteId: null,
    estadoDocumentoGenerado: 'noAplica',
    origen: 'incapacidad',
    tipo: { id: 'incapacidad', clave: 'incapacidad', nombre: 'Incapacidad', color: COLOR_INCAPACIDAD, descuentaVacaciones: false, requiereAprobacion: false },
    funcionario: {
      id: i.funcionario.id,
      nombre: [i.funcionario.nombre, i.funcionario.primerApellido, i.funcionario.segundoApellido].filter(Boolean).join(' '),
      departamento: i.funcionario.departamento?.nombre ?? null,
    },
    solicitadaPor: { id: i.usuarioRegistro.id, nombre: i.usuarioRegistro.funcionario ? `${i.usuarioRegistro.funcionario.nombre} ${i.usuarioRegistro.funcionario.primerApellido}` : null },
    aprobador: null,
    enNombreDeTercero: i.usuarioRegistro.id !== i.funcionario.usuario?.id,
    autoaprobada: false,
  };
}

/** Queda aprobada al crearla: no tiene jefatura (tope) o la registra su propia jefatura. */
function seApruebaAlCrear(p: SolicitudPreparada): boolean {
  // Los tramites que son un derecho (licencia) quedan aprobados al registrarlos.
  return !p.tipo.requiereAprobacion || !p.funcionario.tieneJefatura || p.funcionario.laRegistraSuJefatura;
}

/** Error de llave unica de Prisma (P2002). */
function esChoqueDeUnicidad(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
