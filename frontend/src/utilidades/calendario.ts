/*
 * Ayudantes de fechas para el calendario y los selectores de rango.
 *
 * Todo trabaja con texto "AAAA-MM-DD" (igual que el backend) y hace las
 * cuentas en UTC, asi el cambio de hora o la zona del navegador nunca
 * corren un dia.
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const NOMBRES_DE_DIAS_CORTOS = DIAS_CORTOS;

const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);

/** Hoy en Costa Rica ("AAAA-MM-DD"), sin depender de la zona del navegador. */
export function hoyEnCostaRica(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** Cuantos dias hay de una fecha a otra (negativo si la segunda es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** 0 = lunes ... 6 = domingo. */
export function posicionEnSemana(fecha: string): number {
  return (aFecha(fecha).getUTCDay() + 6) % 7;
}

export const esFinDeSemana = (fecha: string) => posicionEnSemana(fecha) >= 5;

export function anioDe(fecha: string): number {
  return Number(fecha.slice(0, 4));
}
/** 0 a 11. */
export function mesDe(fecha: string): number {
  return Number(fecha.slice(5, 7)) - 1;
}
export function diaDelMes(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

export function primeroDelMes(anio: number, mes: number): string {
  return aTexto(new Date(Date.UTC(anio, mes, 1)));
}
export function ultimoDelMes(anio: number, mes: number): string {
  return aTexto(new Date(Date.UTC(anio, mes + 1, 0)));
}

/** Mes siguiente (o anterior, con n negativo) de un { anio, mes }. */
export function moverMes(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const d = new Date(Date.UTC(anio, mes + n, 1));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() };
}

/**
 * Las semanas (lunes a domingo) que hay que dibujar para un mes: cada una
 * con sus 7 fechas, incluyendo los dias del mes anterior y siguiente que
 * completan la primera y la ultima fila.
 */
export function semanasDelMes(anio: number, mes: number): string[][] {
  const primero = primeroDelMes(anio, mes);
  const ultimo = ultimoDelMes(anio, mes);
  const inicio = sumarDias(primero, -posicionEnSemana(primero));
  const fin = sumarDias(ultimo, 6 - posicionEnSemana(ultimo));
  const semanas: string[][] = [];
  for (let lunes = inicio; lunes <= fin; lunes = sumarDias(lunes, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)));
  }
  return semanas;
}

/** Todas las fechas de un rango, ambas incluidas. */
export function fechasDelRango(inicio: string, fin: string): string[] {
  const lista: string[] = [];
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) lista.push(f);
  return lista;
}

export const nombreDelMes = (mes: number) => MESES[mes];
export const nombreCortoDelMes = (mes: number) => MESES_CORTOS[mes];
export const nombreDelDia = (fecha: string) => DIAS_LARGOS[posicionEnSemana(fecha)];

/** "26 oct" */
export function fechaCorta(fecha: string): string {
  return `${diaDelMes(fecha)} ${MESES_CORTOS[mesDe(fecha)]}`;
}

/** "lunes 26 de octubre" */
export function fechaLarga(fecha: string): string {
  return `${nombreDelDia(fecha)} ${diaDelMes(fecha)} de ${MESES[mesDe(fecha)]}`;
}

/** "viernes 1 de octubre de 2027": como fechaLarga, con el anio si no es el actual. */
export function fechaLargaConAnio(fecha: string, hoy: string): string {
  return anioDe(fecha) === anioDe(hoy) ? fechaLarga(fecha) : `${fechaLarga(fecha)} de ${anioDe(fecha)}`;
}

/** "mañana", "en 12 días", "en unos 5 meses", "en un año". */
export function cuantoFalta(dias: number): string {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias < 45) return `en ${dias} días`;
  const meses = Math.round(dias / 30.4);
  if (meses >= 12) return 'en un año';
  return `en unos ${meses} meses`;
}

/** "26 – 30 oct 2026", "26 oct – 3 nov 2026" o, si es un dia, "26 oct 2026". */
export function textoDeRango(inicio: string, fin: string): string {
  const anio = anioDe(fin);
  if (inicio === fin) return `${fechaCorta(inicio)} ${anio}`;
  const mismoMes = anioDe(inicio) === anioDe(fin) && mesDe(inicio) === mesDe(fin);
  if (mismoMes) return `${diaDelMes(inicio)} – ${diaDelMes(fin)} ${MESES_CORTOS[mesDe(fin)]} ${anio}`;
  const otroAnio = anioDe(inicio) !== anioDe(fin);
  return `${fechaCorta(inicio)}${otroAnio ? ` ${anioDe(inicio)}` : ''} – ${fechaCorta(fin)} ${anio}`;
}

export const estaEnRango = (fecha: string, inicio: string, fin: string) => fecha >= inicio && fecha <= fin;
