/*
 * Fechas para mostrar en pantalla, siempre en hora de Costa Rica
 * (el backend guarda en UTC).
 */

const ZONA = 'America/Costa_Rica';

/** "2026-10-31T05:59:59Z" -> "30/10/2026" o "31/10/2026" segun la hora local de CR. */
export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** "10/09/2026 07:42" en hora de Costa Rica. */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Hoy en Costa Rica como "AAAA-MM-DD", para el atributo "min" de los
 * campos de fecha (no se puede elegir un vencimiento en el pasado).
 * El formato sueco (sv-SE) da justamente AAAA-MM-DD.
 */
export function hoyEnCostaRica(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: ZONA });
}

/**
 * Convierte una fecha ISO guardada en el backend al "AAAA-MM-DD" de Costa
 * Rica, para precargar un campo de fecha al editar un vencimiento.
 */
export function aFechaDeCampo(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: ZONA });
}

/** Cuantos anios hacia adelante se acepta un vencimiento (igual que el backend, comun/fechas.ts). */
export const ANIOS_MAXIMOS_DE_VENCIMIENTO = 5;

/** Ultimo dia aceptado para un vencimiento ("AAAA-MM-DD"), para el atributo "max". */
export function limiteDeVencimiento(): string {
  const [anio, resto] = [Number(hoyEnCostaRica().slice(0, 4)), hoyEnCostaRica().slice(4)];
  return `${anio + ANIOS_MAXIMOS_DE_VENCIMIENTO}${resto}`;
}

/**
 * Problema de una fecha de vencimiento COMPLETA ("AAAA-MM-DD"), o null si
 * esta bien o esta vacia (vacia = permanente). Las fechas a medio escribir
 * no llegan aqui: el navegador las entrega como "" y las detecta
 * CampoFechaDeVencimiento con validity.badInput.
 */
export function problemaDeFechaDeVencimiento(valor: string): string | null {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'La fecha no es válida.';
  if (valor < hoyEnCostaRica()) return 'La fecha ya pasó: elija hoy o un día futuro.';
  if (valor > limiteDeVencimiento()) {
    return `No puede pasar de ${ANIOS_MAXIMOS_DE_VENCIMIENTO} años. Si es por tiempo indefinido, elija "Permanente".`;
  }
  return null;
}

/**
 * Fecha de calendario que la API manda como "AAAA-MM-DD" (nacimiento,
 * ingreso, salida) -> "dd/mm/aaaa". NO pasa por zonas horarias: si se
 * convirtiera a hora de Costa Rica, mostraria el dia anterior.
 */
export function formatearFechaSola(texto: string | null | undefined): string {
  if (!texto) return '—';
  const [anio, mes, dia] = texto.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

/** "AAAA-MM-DD" mas (o menos) n anios, como "AAAA-MM-DD". Para min/max de los campos. */
export function sumarAnios(texto: string, anios: number): string {
  return `${Number(texto.slice(0, 4)) + anios}${texto.slice(4)}`;
}
