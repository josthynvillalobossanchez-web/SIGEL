/*
 * Notificaciones dentro de SINERGIA (Sprint 3, HU 42-44). Cada quien ve
 * solo las suyas: el destinatario lo pone el backend desde la sesion.
 */
import { pedirAlServidor } from './cliente';
import type { Pagina } from './usuarios';

export interface Notificacion {
  id: string;
  /** Que la origino: solicitudPorAprobar, solicitudAprobada, incapacidadRegistrada... */
  clave: string;
  titulo: string;
  mensaje: string;
  entidad: string | null;
  registroId: string | null;
  /** Pantalla que abre el aviso (ruta interna), o null si no lleva a ninguna. */
  enlace: string | null;
  leida: boolean;
  fechaCreacion: string;
}

export type EstadoDeNotificaciones = 'sinLeer' | 'leidas' | 'todas';

export const consultarNotificaciones = (estado: EstadoDeNotificaciones, pagina: number, tamano = 15) =>
  pedirAlServidor<Pagina<Notificacion> & { sinLeer: number }>('GET', '/notificaciones', { parametros: { estado, pagina, tamano } });
export const consultarResumenDeNotificaciones = () => pedirAlServidor<{ sinLeer: number; recientes: Notificacion[] }>('GET', '/notificaciones/resumen');
export const marcarNotificacionLeida = (id: string) => pedirAlServidor<Notificacion>('POST', `/notificaciones/${encodeURIComponent(id)}/leida`);
export const marcarTodasLasNotificaciones = () => pedirAlServidor<{ marcadas: number }>('POST', '/notificaciones/leer-todas');

/** "hace 5 min", "hace 3 h", "ayer", "12 oct". */
export function cuandoFue(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  if (horas < 48) return 'ayer';
  return new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'America/Costa_Rica' }).format(new Date(iso));
}

/**
 * Aviso para que la campana se actualice ya (sin esperar al siguiente
 * minuto) cuando la pagina de Notificaciones marca algo como leido.
 */
export const EVENTO_NOTIFICACIONES = 'sinergia:notificaciones';
export function avisarCambioDeNotificaciones(): void {
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
}
