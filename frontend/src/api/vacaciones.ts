/*
 * Llamadas del modulo de vacaciones y solicitudes (backend/src/vacaciones).
 *
 * Las fechas "solas" (inicio, fin, feriados) viajan como texto "AAAA-MM-DD",
 * sin hora ni zona: asi no se corren de dia. Las fechas con hora (solicitud,
 * resolucion) vienen en ISO/UTC y se muestran con utilidades/fechas.ts.
 */
import { pedirAlServidor } from './cliente';
import type { Pagina } from './usuarios';

export type EstadoDeSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type AlcanceDeCalendario = 'propio' | 'equipo' | 'todos';

export interface TipoDeSolicitud {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  descuentaVacaciones: boolean;
  requiereJustificante: boolean;
  colorCalendario: string | null;
}

export interface SolicitudDeLista {
  id: string;
  consecutivo: string;
  estado: EstadoDeSolicitud;
  leidaPorAprobador: boolean;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  cantidadDias: number | null;
  motivo: string | null;
  motivoRechazo: string | null;
  fechaResolucion: string | null;
  tieneConstancia: boolean;
  estadoDocumentoGenerado: string;
  tipo: { id: string; clave: string; nombre: string; color: string | null; descuentaVacaciones: boolean };
  funcionario: { id: string; nombre: string; departamento: string | null };
  solicitadaPor: { id: string; nombre: string | null };
  aprobador: { id: string; nombre: string | null } | null;
  /** La hizo Recursos Humanos en nombre de la persona. */
  enNombreDeTercero: boolean;
  /** Estaba en el tope de la jerarquia: se aprobo sola. */
  autoaprobada: boolean;
}

export interface ResumenDeSaldo {
  funcionarioId: string;
  saldoCargado: boolean;
  regimen: { nombre: string; diasPorPeriodo: number | null; periodosMaximos: number; topeEnDias: number | null };
  aniosDeServicio: number;
  /** Lo que RRHH cargo al registrar (dias que ya traia). */
  inicial: number;
  /** Lo ganado al cumplir cada anio de servicio (al registrarse no se gana nada). */
  ganadosPorAniversario: number;
  acumulado: number;
  utilizado: number;
  vencido: number;
  ajustes: number;
  disponible: number;
  reservado: number;
  libre: number;
  proximoPeriodo: { fecha: string; diasParaLlegar: number; diasQueSeGanan: number | null; diasEnRiesgo: number; avisar: boolean };
}

export interface MovimientoDeVacaciones {
  id: string;
  tipo: 'saldoInicial' | 'acumulacion' | 'consumo' | 'ajuste' | 'vencimiento';
  cantidadDias: number;
  fecha: string;
  periodo: string | null;
  observacion: string | null;
  solicitud: { id: string; consecutivo: string } | null;
  registradoPor: { id: string; correo: string } | null;
}

export type TipoDeDia = 'habil' | 'finDeSemana' | 'feriado';
export interface DiaDelDesglose {
  fecha: string;
  tipo: TipoDeDia;
  nombreFeriado?: string;
}

export interface VistaPrevia {
  valida: boolean;
  problema: { codigo?: string; mensaje?: string } | null;
  diasHabiles?: number;
  desglose?: DiaDelDesglose[];
  saldo?: { libre: number; quedaria: number } | null;
  /** Queda aprobada al crearla: no tiene jefatura, o la registra su propia jefatura. */
  autoaprobada?: boolean;
  /** La registra la jefatura de la persona (por eso queda aprobada). */
  laApruebaSuJefatura?: boolean;
}

export interface DatosDeSolicitud {
  tipoSolicitudId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
  /** Solo Recursos Humanos: a nombre de quien se hace. */
  funcionarioId?: string;
  justificanteDocumentoId?: string;
}

export interface FiltrosDeSolicitudes {
  pagina?: number;
  tamano?: number;
  estado?: EstadoDeSolicitud;
  tipoSolicitudId?: string;
  funcionarioId?: string;
  departamentoId?: string;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export interface FeriadoDelCalendario {
  fecha: string;
  nombre: string;
}

export interface CalendarioDeSolicitudes {
  eventos: SolicitudDeLista[];
  feriados: FeriadoDelCalendario[];
  /** Habia mas eventos de los que se pueden mostrar: conviene acortar el rango. */
  truncado: boolean;
}

/** Como se repite un feriado del catalogo (01/10). */
export type ReglaDeFeriado = 'fija' | 'unica' | 'juevesSanto' | 'viernesSanto';

export interface DiaNoLaborable {
  id: string;
  nombre: string;
  regla: ReglaDeFeriado;
  /** Solo "fija": se repite cada anio ese dia y mes. */
  mes: number | null;
  dia: number | null;
  /** Solo "unica" (AAAA-MM-DD). */
  fecha: string | null;
  activo: boolean;
  /** La proxima vez que cae; null si ya paso y no se repite. */
  proxima: string | null;
}

export interface DatosDeFeriado {
  nombre: string;
  regla: ReglaDeFeriado;
  mes?: number;
  dia?: number;
  fecha?: string;
}

const ruta = (id: string) => encodeURIComponent(id);

/* --- Saldo --- */
export const consultarMiSaldo = () => pedirAlServidor<ResumenDeSaldo>('GET', '/vacaciones/mi-saldo');
export const consultarSaldoDe = (funcionarioId: string) => pedirAlServidor<ResumenDeSaldo>('GET', `/vacaciones/saldo/${ruta(funcionarioId)}`);
export const consultarMovimientos = (funcionarioId: string, pagina = 1) =>
  pedirAlServidor<Pagina<MovimientoDeVacaciones>>('GET', `/vacaciones/saldo/${ruta(funcionarioId)}/movimientos`, { parametros: { pagina, tamano: 10 } });
export const ajustarSaldo = (funcionarioId: string, dias: number, motivo: string) =>
  pedirAlServidor<ResumenDeSaldo>('POST', `/vacaciones/saldo/${ruta(funcionarioId)}/ajuste`, { cuerpo: { dias, motivo } });

/* --- Solicitudes --- */
export const consultarTiposDeSolicitud = () => pedirAlServidor<TipoDeSolicitud[]>('GET', '/solicitudes/tipos');
export const calcularSolicitud = (datos: DatosDeSolicitud) => pedirAlServidor<VistaPrevia>('POST', '/solicitudes/calcular', { cuerpo: datos });
export const crearSolicitud = (datos: DatosDeSolicitud) => pedirAlServidor<SolicitudDeLista>('POST', '/solicitudes', { cuerpo: datos });
export const consultarSolicitud = (id: string) => pedirAlServidor<SolicitudDeLista>('GET', `/solicitudes/${ruta(id)}`);
export const consultarMisSolicitudes = (filtros: FiltrosDeSolicitudes) =>
  pedirAlServidor<Pagina<SolicitudDeLista>>('GET', '/solicitudes/mias', { parametros: { ...filtros } });
export const consultarBandeja = (filtros: FiltrosDeSolicitudes) =>
  pedirAlServidor<Pagina<SolicitudDeLista>>('GET', '/solicitudes/bandeja', { parametros: { ...filtros } });
export const consultarTodasLasSolicitudes = (filtros: FiltrosDeSolicitudes) =>
  pedirAlServidor<Pagina<SolicitudDeLista>>('GET', '/solicitudes/todas', { parametros: { ...filtros } });
export const aprobarSolicitud = (id: string) => pedirAlServidor<SolicitudDeLista>('POST', `/solicitudes/${ruta(id)}/aprobar`);
export const rechazarSolicitud = (id: string, motivo: string) =>
  pedirAlServidor<SolicitudDeLista>('POST', `/solicitudes/${ruta(id)}/rechazar`, { cuerpo: { motivo } });
export const cancelarSolicitud = (id: string) => pedirAlServidor<SolicitudDeLista>('POST', `/solicitudes/${ruta(id)}/cancelar`);

export const consultarCalendario = (desde: string, hasta: string, alcance: AlcanceDeCalendario, departamentoId?: string) =>
  pedirAlServidor<CalendarioDeSolicitudes>('GET', '/solicitudes/calendario', { parametros: { desde, hasta, alcance, departamentoId } });

/* --- Feriados (catalogo que se repite solo cada anio) --- */
export const consultarCatalogoDeFeriados = () => pedirAlServidor<DiaNoLaborable[]>('GET', '/dias-no-laborables');
/** Las fechas activas de un anio, ya calculadas (para el selector de fechas). */
export const consultarFeriados = (anio: number) => pedirAlServidor<FeriadoDelCalendario[]>('GET', '/dias-no-laborables/fechas', { parametros: { anio } });
export const crearFeriado = (datos: DatosDeFeriado) => pedirAlServidor<DiaNoLaborable>('POST', '/dias-no-laborables', { cuerpo: datos });
export const editarFeriado = (id: string, cambios: Partial<DatosDeFeriado & { activo: boolean }>) =>
  pedirAlServidor<DiaNoLaborable>('PATCH', `/dias-no-laborables/${ruta(id)}`, { cuerpo: cambios });
export const eliminarFeriado = (id: string) => pedirAlServidor<unknown>('DELETE', `/dias-no-laborables/${ruta(id)}`);
export const cargarFeriadosDeLey = () => pedirAlServidor<DiaNoLaborable[]>('POST', '/dias-no-laborables/de-ley');
