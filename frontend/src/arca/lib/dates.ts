/** Fechas: el backend guarda UTC; la interfaz muestra siempre hora de Costa Rica (UTC−6, sin horario de verano). */
const TZ = 'America/Costa_Rica';

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('es-CR', { timeZone: TZ, hourCycle: 'h23', ...opts })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** dd/mm/aaaa */
export function formatDate(v: string | Date): string {
  const p = parts(toDate(v), { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.day}/${p.month}/${p.year}`;
}

/** HH:mm */
export function formatTime(v: string | Date): string {
  const p = parts(toDate(v), { hour: '2-digit', minute: '2-digit' });
  return `${p.hour}:${p.minute}`;
}

export function formatDateTime(v: string | Date): string {
  return `${formatDate(v)} ${formatTime(v)}`;
}

/** Fecha local de Costa Rica como AAAA-MM-DD (para filtros y campos de fecha). */
export function isoDate(v: string | Date = new Date()): string {
  const p = parts(toDate(v), { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "Martes 20/10/2026" */
export function longDay(v: string | Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat('es-CR', { timeZone: TZ, weekday: 'long' }).format(toDate(v));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${formatDate(v)}`;
}

/** Primer día del mes de una fecha local, AAAA-MM-DD. */
export function firstOfMonth(v: string | Date = new Date()): string {
  return `${isoDate(v).slice(0, 8)}01`;
}
