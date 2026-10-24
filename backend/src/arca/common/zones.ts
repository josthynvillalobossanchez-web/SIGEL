/**
 * Las fechas se guardan en UTC; solo se convierten a hora de Costa Rica al presentar o agrupar por día.
 * Costa Rica es UTC−6 todo el año (sin horario de verano).
 */
const CR_OFFSET_HOURS = 6;

/** Inicio del día local (YYYY-MM-DD) como instante UTC. */
export function startOfDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, CR_OFFSET_HOURS, 0, 0, 0));
}

export function startOfNextDay(date: string): Date {
  const s = startOfDay(date);
  return new Date(s.getTime() + 24 * 3600 * 1000);
}

/** Fecha local (YYYY-MM-DD) de un instante. */
export function localDate(instant: Date): string {
  return new Date(instant.getTime() - CR_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
}

/** Hora local (0-23.99) de un instante. */
export function localHour(instant: Date): number {
  const d = new Date(instant.getTime() - CR_OFFSET_HOURS * 3600 * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function formatDateTime(instant: Date): string {
  const d = new Date(instant.getTime() - CR_OFFSET_HOURS * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
