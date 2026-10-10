/*
 * Llamadas del cierre del Sprint 2 (backend/src/ausencias): constancia y
 * justificante de las solicitudes, incapacidades, capacitaciones y horas extra.
 * Los archivos viajan en FormData con su propio nombre de campo
 * ("justificante", "boleta", "certificado").
 */
import { pedirAlServidor, pedirArchivo } from './cliente';
import type { Pagina } from './usuarios';
import type { DatosDeSolicitud, SolicitudDeLista } from './vacaciones';

const ruta = (id: string) => encodeURIComponent(id);

function formulario(campos: Record<string, string | number | boolean | undefined | null>, campoArchivo?: string, archivo?: File | null): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null && v !== '') f.append(k, String(v));
  if (campoArchivo && archivo) f.append(campoArchivo, archivo, archivo.name);
  return f;
}

/* --- Constancia y justificante --- */
export const crearSolicitudConJustificante = (datos: DatosDeSolicitud, justificante: File) =>
  pedirAlServidor<SolicitudDeLista>('POST', '/solicitudes/con-justificante', { cuerpo: formulario({ ...datos }, 'justificante', justificante) });
export const abrirJustificante = (solicitudId: string) => pedirArchivo(`/solicitudes/${ruta(solicitudId)}/justificante`);
export const generarConstanciaDeNuevo = (solicitudId: string) =>
  pedirAlServidor<{ generada: boolean }>('POST', `/solicitudes/${ruta(solicitudId)}/constancia`);

/* --- Incapacidades --- */
export interface TipoDeIncapacidad {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export interface Incapacidad {
  id: string;
  consecutivo: string;
  funcionario: { id: string; nombre: string; departamento: string | null };
  /** null cuando quien consulta es la jefatura: solo ve las fechas. */
  tipo: { id: string; nombre: string } | null;
  entidadEmisora: string | null;
  numeroBoleta: string | null;
  fechaInicio: string;
  fechaFin: string;
  cantidadDias: number;
  observacion: string | null;
  boletaId: string | null;
  registradaPor: { id: string; nombre: string | null };
  enNombreDeTercero: boolean;
  fechaRegistro: string;
  vigente: boolean;
  motivoAnulacion: string | null;
}

export interface DatosDeIncapacidad {
  funcionarioId?: string;
  tipoIncapacidadId: string;
  fechaInicio: string;
  fechaFin: string;
  entidadEmisora?: string;
  numeroBoleta?: string;
  observacion?: string;
}

export interface FiltrosDeIncapacidades {
  pagina?: number;
  tamano?: number;
  busqueda?: string;
  tipoIncapacidadId?: string;
  departamentoId?: string;
  desde?: string;
  hasta?: string;
  estado?: 'vigentes' | 'anuladas' | 'todas';
}

export const consultarTiposDeIncapacidad = () => pedirAlServidor<TipoDeIncapacidad[]>('GET', '/incapacidades/tipos');
export const consultarMisIncapacidades = (filtros: FiltrosDeIncapacidades) =>
  pedirAlServidor<Pagina<Incapacidad>>('GET', '/incapacidades/mias', { parametros: { ...filtros } });
export const consultarTodasLasIncapacidades = (filtros: FiltrosDeIncapacidades) =>
  pedirAlServidor<Pagina<Incapacidad>>('GET', '/incapacidades', { parametros: { ...filtros } });
export const consultarIncapacidad = (id: string) => pedirAlServidor<Incapacidad>('GET', `/incapacidades/${ruta(id)}`);
export const registrarIncapacidad = (datos: DatosDeIncapacidad, boleta: File) =>
  pedirAlServidor<{ incapacidad: Incapacidad; avisos: string[] }>('POST', '/incapacidades', { cuerpo: formulario({ ...datos }, 'boleta', boleta) });

/* --- Capacitaciones --- */
export type Modalidad = 'presencial' | 'virtual' | 'mixta';

export interface Capacitacion {
  id: string;
  nombre: string;
  institucion: string | null;
  modalidad: Modalidad | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  cantidadHoras: number | null;
  afectaJornada: boolean;
  solicitud: { id: string; consecutivo: string; estado: string } | null;
  certificadoId: string | null;
  observacion: string | null;
  registradaPor: string | null;
  fechaRegistro: string;
  puedeModificar: boolean;
}

export interface DatosDeCapacitacion {
  funcionarioId?: string;
  nombre: string;
  institucion?: string;
  modalidad?: Modalidad | '';
  fechaInicio?: string;
  fechaFin?: string;
  cantidadHoras?: number | '';
  afectaJornada?: boolean;
  observacion?: string;
}

export const consultarCapacitaciones = (funcionarioId: string) =>
  pedirAlServidor<Capacitacion[]>('GET', '/capacitaciones', { parametros: { funcionarioId } });
export const registrarCapacitacion = (datos: DatosDeCapacitacion, certificado?: File | null) =>
  pedirAlServidor<Capacitacion>('POST', '/capacitaciones', { cuerpo: formulario({ ...datos }, 'certificado', certificado) });
export const adjuntarCertificado = (id: string, certificado: File) =>
  pedirAlServidor<Capacitacion>('POST', `/capacitaciones/${ruta(id)}/certificado`, { cuerpo: formulario({}, 'certificado', certificado) });
export const darDeBajaCapacitacion = (id: string) => pedirAlServidor<unknown>('POST', `/capacitaciones/${ruta(id)}/baja`);

/* --- Horas extra (solo RRHH) --- */
export interface HoraExtra {
  id: string;
  funcionario: { id: string; nombre: string; departamento: string | null };
  fecha: string;
  horaInicio: string;
  horaFin: string;
  /** Duracion en minutos (se muestra con textoDeMinutos: "2 h 40 min"). */
  cantidadMinutos: number;
  nocturna: boolean;
  motivo: string | null;
  registradaPor: string;
  fechaRegistro: string;
  vigente: boolean;
  motivoAnulacion: string | null;
}

export interface ResumenDeHorasExtra {
  mes: string;
  totalMinutos: number;
  totalRegistros: number;
  porPersona: { funcionario: { id: string; nombre: string; departamento: string | null }; minutos: number; registros: number }[];
  registros: Pagina<HoraExtra>;
}

export interface FiltrosDeHorasExtra {
  mes?: string;
  funcionarioId?: string;
  departamentoId?: string;
  busqueda?: string;
  incluirAnuladas?: boolean;
  pagina?: number;
  tamano?: number;
}

export interface DatosDeHoraExtra {
  funcionarioId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo?: string;
}

export const consultarHorasExtra = (filtros: FiltrosDeHorasExtra) =>
  pedirAlServidor<ResumenDeHorasExtra>('GET', '/horas-extra', { parametros: { ...filtros } });
export const registrarHoraExtra = (datos: DatosDeHoraExtra) => pedirAlServidor<HoraExtra>('POST', '/horas-extra', { cuerpo: datos });
export const anularHoraExtra = (id: string, motivo: string) =>
  pedirAlServidor<HoraExtra>('POST', `/horas-extra/${ruta(id)}/anular`, { cuerpo: { motivo } });

/** Minutos entre dos "HH:MM" (si el fin es menor, termina al dia siguiente). Igual que el backend. */
export function minutosEntre(inicio: string, fin: string): number | null {
  const m = (h: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : null);
  const a = m(inicio), b = m(fin);
  if (a === null || b === null || a === b) return null;
  return (b - a + 1440) % 1440;
}

/** 160 -> "2 h 40 min"; 45 -> "45 min"; 180 -> "3 h"; 0 -> "0 h". Las horas son de 60 minutos. */
export function textoDeMinutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h && !m) return '0 h';
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
