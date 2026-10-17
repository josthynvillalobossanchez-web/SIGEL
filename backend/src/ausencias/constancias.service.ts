import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { aFechaSola } from '../comun/fechas.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { DiasNoLaborablesService } from '../vacaciones/dias-no-laborables.service.js';
import { PERMISO_ADMINISTRAR, VacacionesService } from '../vacaciones/vacaciones.service.js';
import { generarConstanciaPdf } from './constancia-pdf.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "lunes 12 de octubre de 2026" de una columna DATE. */
export function fechaEnPalabras(f: Date): string {
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

/** "12/10/2026 14:35" en hora de Costa Rica. */
export function fechaYHoraCR(f: Date): string {
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(f)
    .replace(',', '');
}

/**
 * Constancias de vacaciones, permisos y licencias (HU 26 y 33, Diagrama 3c): al aprobarse una solicitud
 * cuyo tipo genera documento, SINERGIA arma el PDF y lo guarda en el
 * expediente de la persona (DocumentosService.registrarGenerado). Si falla,
 * la solicitud queda con el documento "fallido" para que RRHH lo reintente.
 *
 * La llama SolicitudesService despues de aprobar (sin hacer fallar la
 * aprobacion): ver solicitudes.service.ts, metodo generarConstanciaSiAplica.
 */
@Injectable()
export class ConstanciasService {
  private readonly registro = new Logger('Constancias');

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosService,
    private readonly vacaciones: VacacionesService,
    private readonly feriados: DiasNoLaborablesService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Genera la constancia; nunca lanza: devuelve true si quedo generada. */
  async generar(solicitudId: string, usuarioOrigenId: string): Promise<boolean> {
    try {
      const s = await this.prisma.solicitud.findUnique({
        where: { id: solicitudId },
        select: {
          id: true,
          consecutivo: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          cantidadDias: true,
          motivo: true,
          fechaResolucion: true,
          estadoDocumentoGenerado: true,
          documentoGeneradoId: true,
          funcionario: {
            select: {
              id: true,
              cedula: true,
              nombre: true,
              primerApellido: true,
              segundoApellido: true,
              puesto: { select: { nombre: true } },
              departamento: { select: { nombre: true } },
            },
          },
          usuarioResolucion: { select: { correo: true, funcionario: { select: { nombre: true, primerApellido: true, segundoApellido: true } } } },
          tipoSolicitud: { select: { clave: true, nombre: true, requiereAprobacion: true, tipoDocumentoGeneradoId: true } },
        },
      });
      if (!s || s.estado !== 'aprobada' || !s.tipoSolicitud.tipoDocumentoGeneradoId || s.documentoGeneradoId) return false;

      const f = s.funcionario;
      const r = s.usuarioResolucion;
      const feriados = await this.feriados.entre(s.fechaInicio, s.fechaFin);
      const esVacaciones = s.tipoSolicitud.clave === 'vacaciones';
      const saldo = esVacaciones ? await this.vacaciones.resumen(f.id) : null;
      const contenido = await generarConstanciaPdf({
        clave: s.tipoSolicitud.clave,
        nombreDelTipo: s.tipoSolicitud.nombre,
        requiereAprobacion: s.tipoSolicitud.requiereAprobacion,
        consecutivo: s.consecutivo,
        nombreCompleto: [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' '),
        cedula: f.cedula,
        puesto: f.puesto?.nombre ?? null,
        departamento: f.departamento?.nombre ?? null,
        desde: fechaEnPalabras(s.fechaInicio),
        hasta: fechaEnPalabras(s.fechaFin),
        diasHabiles: Number(s.cantidadDias ?? 0),
        feriados: [...feriados.entries()].map(([fecha, nombre]) => `${nombre} (${fecha.slice(8)}/${fecha.slice(5, 7)})`),
        aprobadaPor: r?.funcionario ? [r.funcionario.nombre, r.funcionario.primerApellido, r.funcionario.segundoApellido].filter(Boolean).join(' ') : (r?.correo ?? 'el sistema'),
        aprobadaEl: fechaYHoraCR(s.fechaResolucion ?? new Date()),
        emitidaEl: fechaYHoraCR(new Date()),
        saldoDisponible: saldo?.disponible ?? null,
        motivo: s.motivo,
      });
      const doc = await this.documentos.registrarGenerado({
        funcionarioId: f.id,
        tipoDocumentoId: s.tipoSolicitud.tipoDocumentoGeneradoId,
        titulo: `Constancia de ${s.tipoSolicitud.nombre.toLowerCase()} ${s.consecutivo}`,
        descripcion: `Del ${aFechaSola(s.fechaInicio)} al ${aFechaSola(s.fechaFin)} (${Number(s.cantidadDias ?? 0)} día(s) hábil(es)).`,
        contenido,
        usuarioOrigenId,
      });
      await this.prisma.solicitud.update({ where: { id: s.id }, data: { documentoGeneradoId: doc.id, estadoDocumentoGenerado: 'generado' } });
      return true;
    } catch (error) {
      this.registro.error(`No se pudo generar la constancia de la solicitud ${solicitudId}: ${(error as Error).message}`);
      await this.prisma.solicitud
        .updateMany({ where: { id: solicitudId, documentoGeneradoId: null }, data: { estadoDocumentoGenerado: 'fallido' } })
        .catch(() => undefined);
      // RRHH se entera para generarla de nuevo (o subirla a mano).
      const s = await this.prisma.solicitud.findUnique({ where: { id: solicitudId }, select: { consecutivo: true } }).catch(() => null);
      await this.notificaciones.avisarARrhh({
        clave: 'constanciaFallida',
        titulo: 'No se pudo generar una constancia',
        mensaje: `La constancia de la solicitud ${s?.consecutivo ?? ''} no se pudo generar. Ábrala y use «Generar de nuevo».`,
        entidad: 'solicitud',
        registroId: solicitudId,
        enlace: `/solicitudes?abrir=${solicitudId}`,
      });
      return false;
    }
  }

  /** RRHH (o quien la aprobo) reintenta una constancia que fallo o quedo pendiente. */
  async reintentar(solicitudId: string, quienActua: UsuarioAutenticado): Promise<{ generada: boolean }> {
    const s = await this.prisma.solicitud.findUnique({
      where: { id: solicitudId },
      select: { estado: true, aprobadorId: true, documentoGeneradoId: true, estadoDocumentoGenerado: true },
    });
    if (!s) throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', message: 'No se encontró la solicitud indicada.' });
    // La constancia la ven la persona y RRHH (decision 09/10): generarla de nuevo, solo RRHH.
    if (!quienActua.permisos.includes(PERMISO_ADMINISTRAR)) {
      throw new ForbiddenException({ codigo: 'SOLICITUD_AJENA', message: 'Solo Recursos Humanos puede generar de nuevo la constancia.' });
    }
    if (s.estado !== 'aprobada' || s.estadoDocumentoGenerado === 'noAplica' || s.documentoGeneradoId) {
      throw new ConflictException({ codigo: 'CONSTANCIA_NO_APLICA', message: 'Esta solicitud no tiene una constancia pendiente de generar.' });
    }
    return { generada: await this.generar(solicitudId, quienActua.id) };
  }
}
