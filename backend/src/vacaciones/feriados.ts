/**
 * Feriados que se repiten solos (decision de Josthyn, 01/10/2026).
 *
 * Cada feriado del catalogo tiene una regla:
 *   - "fija":         cada anio el mismo dia y mes (1 de enero, 15 de setiembre...).
 *   - "unica":        solo esa fecha (un asueto, o el traslado de un feriado un anio).
 *   - "juevesSanto" / "viernesSanto": cambian cada anio; se calculan con la Pascua.
 *
 * Son funciones puras: reciben las reglas y un rango, y devuelven las fechas
 * "AAAA-MM-DD" con su nombre. Asi RRHH los digita una sola vez y el sistema
 * los consulta cuando cuenta los dias habiles de una solicitud.
 */

export const REGLAS_DE_FERIADO = ['fija', 'unica', 'juevesSanto', 'viernesSanto'] as const;
export type ReglaDeFeriado = (typeof REGLAS_DE_FERIADO)[number];

export interface FeriadoDelCatalogo {
  nombre: string;
  regla: string;
  mes: number | null;
  dia: number | null;
  fecha: Date | null;
}

const UN_DIA_MS = 86_400_000;
const texto = (d: Date) => d.toISOString().slice(0, 10);

/** Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Jones/Butcher). */
export function domingoDePascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** La fecha del feriado en un anio dado, o null si ese anio no aplica (p. ej. 29 de febrero). */
export function fechaEnAnio(f: FeriadoDelCatalogo, anio: number): Date | null {
  switch (f.regla) {
    case 'fija': {
      if (!f.mes || !f.dia) return null;
      const fecha = new Date(Date.UTC(anio, f.mes - 1, f.dia));
      return fecha.getUTCMonth() === f.mes - 1 ? fecha : null; // 29 de febrero en anio no bisiesto
    }
    case 'unica':
      return f.fecha && f.fecha.getUTCFullYear() === anio ? f.fecha : null;
    case 'juevesSanto':
      return new Date(domingoDePascua(anio).getTime() - 3 * UN_DIA_MS);
    case 'viernesSanto':
      return new Date(domingoDePascua(anio).getTime() - 2 * UN_DIA_MS);
    default:
      return null;
  }
}

/** Todos los feriados entre dos fechas (ambas incluidas), "AAAA-MM-DD" -> nombre. */
export function feriadosEnRango(catalogo: readonly FeriadoDelCatalogo[], desde: Date, hasta: Date): Map<string, string> {
  const resultado = new Map<string, string>();
  for (let anio = desde.getUTCFullYear(); anio <= hasta.getUTCFullYear(); anio++) {
    for (const f of catalogo) {
      const fecha = fechaEnAnio(f, anio);
      if (!fecha || fecha < desde || fecha > hasta) continue;
      const clave = texto(fecha);
      // Si dos caen el mismo dia (p. ej. un traslado), se juntan los nombres.
      resultado.set(clave, resultado.has(clave) ? `${resultado.get(clave)} / ${f.nombre}` : f.nombre);
    }
  }
  return new Map([...resultado.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** La proxima vez que cae (hoy incluido), o null si ya no vuelve (una "unica" que paso). */
export function proximaFecha(f: FeriadoDelCatalogo, hoy: Date): Date | null {
  for (let anio = hoy.getUTCFullYear(); anio <= hoy.getUTCFullYear() + 8; anio++) {
    const fecha = fechaEnAnio(f, anio);
    if (fecha && fecha >= hoy) return fecha;
    if (f.regla === 'unica') return null;
  }
  return null;
}

/**
 * Feriados de ley de Costa Rica (Codigo de Trabajo, art. 148, con sus
 * reformas). Sirven para llenar el catalogo con un clic; RRHH puede
 * desactivar o quitar los que la Municipalidad no de libres (por ejemplo,
 * los de pago no obligatorio) y agregar asuetos.
 */
export const FERIADOS_DE_LEY_CR: { nombre: string; regla: ReglaDeFeriado; mes?: number; dia?: number }[] = [
  { nombre: 'Año Nuevo', regla: 'fija', mes: 1, dia: 1 },
  { nombre: 'Jueves Santo', regla: 'juevesSanto' },
  { nombre: 'Viernes Santo', regla: 'viernesSanto' },
  { nombre: 'Día de Juan Santamaría', regla: 'fija', mes: 4, dia: 11 },
  { nombre: 'Día del Trabajo', regla: 'fija', mes: 5, dia: 1 },
  { nombre: 'Anexión del Partido de Nicoya', regla: 'fija', mes: 7, dia: 25 },
  { nombre: 'Día de la Virgen de los Ángeles', regla: 'fija', mes: 8, dia: 2 },
  { nombre: 'Día de la Madre', regla: 'fija', mes: 8, dia: 15 },
  { nombre: 'Día de la Persona Negra y la Cultura Afrocostarricense', regla: 'fija', mes: 8, dia: 31 },
  { nombre: 'Día de la Independencia', regla: 'fija', mes: 9, dia: 15 },
  { nombre: 'Día de la Abolición del Ejército', regla: 'fija', mes: 12, dia: 1 },
  { nombre: 'Navidad', regla: 'fija', mes: 12, dia: 25 },
];
