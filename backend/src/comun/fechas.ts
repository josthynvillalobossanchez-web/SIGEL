/**
 * Ayudantes de fechas compartidos.
 *
 * Costa Rica usa UTC-6 todo el anio (no tiene horario de verano), asi que
 * el desfase es fijo y no hace falta ninguna libreria de zonas horarias.
 */
import { BadRequestException } from '@nestjs/common';

/** Desfase de Costa Rica respecto de UTC, en milisegundos (-6 horas). */
const DESFASE_COSTA_RICA_MS = -6 * 60 * 60 * 1000;

/**
 * Interpreta la fecha de vencimiento de una asignacion (rol o permiso).
 *
 * Problema que resuelve: si RRHH escribe "2026-10-31" para decir "hasta el
 * 31 de octubre", JavaScript lo toma como la medianoche UTC del 31, que en
 * Costa Rica es el 30 de octubre a las 6 p.m. La suplencia terminaria casi
 * un dia antes de lo que la persona quiso.
 *
 * Por eso:
 *   - "AAAA-MM-DD" (solo fecha)  -> ese dia a las 23:59:59.999 de Costa Rica.
 *                                   "Hasta el 31" incluye todo el 31.
 *   - Fecha con hora             -> se respeta tal cual.
 */
export function interpretarFechaDeVencimiento(texto: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [anio, mes, dia] = texto.split('-').map(Number);
    // Fin del dia en UTC, corrido al fin del dia en Costa Rica.
    const finDelDiaUtc = Date.UTC(anio, mes - 1, dia, 23, 59, 59, 999);
    return new Date(finDelDiaUtc - DESFASE_COSTA_RICA_MS);
  }
  return new Date(texto);
}

/** Cuantos anios hacia adelante se acepta una fecha de vencimiento. */
export const ANIOS_MAXIMOS_DE_VENCIMIENTO = 5;

/**
 * Revisa y convierte la fecha de vencimiento que manda la pantalla.
 *
 * Por que existe: un campo de fecha a medio llenar (por ejemplo "dd/11/1111")
 * o una fecha imposible ("2026-02-31") no deben terminar guardando algo
 * distinto de lo que la persona quiso. Aqui se rechaza con un codigo claro:
 *
 *   FECHA_NO_VALIDA               no es "AAAA-MM-DD" o el dia no existe.
 *   FECHA_VENCIMIENTO_PASADA      ya paso (hoy si vale: dura hasta las 23:59).
 *   FECHA_VENCIMIENTO_MUY_LEJANA  mas de 5 anios: algo tan largo es permanente
 *                                 y casi siempre es un anio mal escrito (20266).
 *
 * Devuelve el Date listo para guardar (fin de ese dia en Costa Rica).
 * "deQue" completa el mensaje: 'del rol "Aprobador"', 'del permiso', etc.
 */
export function validarFechaDeVencimiento(texto: string, deQue: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  const [anio, mes, dia] = partes ? partes.slice(1).map(Number) : [0, 0, 0];
  const calendario = new Date(Date.UTC(anio, mes - 1, dia));
  const existe =
    partes !== null &&
    calendario.getUTCFullYear() === anio &&
    calendario.getUTCMonth() === mes - 1 &&
    calendario.getUTCDate() === dia;
  if (!existe) {
    throw new BadRequestException({
      codigo: 'FECHA_NO_VALIDA',
      message: `La fecha de vencimiento ${deQue} no es una fecha válida. Escríbala completa (día, mes y año), o sin fecha si es permanente.`,
    });
  }

  const fecha = interpretarFechaDeVencimiento(texto);
  const ahora = new Date();
  if (fecha <= ahora) {
    throw new BadRequestException({
      codigo: 'FECHA_VENCIMIENTO_PASADA',
      message: `La fecha de vencimiento ${deQue} debe ser futura.`,
    });
  }
  const limite = new Date(ahora);
  limite.setUTCFullYear(limite.getUTCFullYear() + ANIOS_MAXIMOS_DE_VENCIMIENTO);
  if (fecha > limite) {
    throw new BadRequestException({
      codigo: 'FECHA_VENCIMIENTO_MUY_LEJANA',
      message: `La fecha de vencimiento ${deQue} no puede pasar de ${ANIOS_MAXIMOS_DE_VENCIMIENTO} años. Si es por tiempo indefinido, que sea permanente (sin fecha).`,
    });
  }
  return fecha;
}

/** Fecha en formato de Costa Rica (dd/mm/aaaa), para textos y bitacora. */
export function formatearFechaCostaRica(fecha: Date): string {
  return fecha.toLocaleDateString('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Fechas "de calendario" (sin hora): nacimiento, ingreso, salida.
 *
 * En la base son columnas DATE. Prisma las entrega como la medianoche UTC de
 * ese dia; si la pantalla las pasara a hora de Costa Rica mostraria el dia
 * ANTERIOR (medianoche UTC = 6 p. m. del dia antes en Costa Rica). Por eso
 * la API las recibe y las devuelve siempre como texto "AAAA-MM-DD", sin hora.
 */

/** "AAAA-MM-DD" -> Date (medianoche UTC), o FECHA_NO_VALIDA si el dia no existe. */
export function interpretarFechaSola(texto: string, deQue: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  const [anio, mes, dia] = partes ? partes.slice(1).map(Number) : [0, 0, 0];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (!partes || fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new BadRequestException({
      codigo: 'FECHA_NO_VALIDA',
      message: `La fecha ${deQue} no es una fecha válida (día, mes y año completos).`,
    });
  }
  return fecha;
}

/** Date de una columna DATE -> "AAAA-MM-DD" (o null). */
export function aFechaSola(fecha: Date | null | undefined): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

/** Hoy en Costa Rica como Date de calendario (medianoche UTC de ese dia). */
export function hoyEnCostaRica(): Date {
  const texto = new Date(Date.now() + DESFASE_COSTA_RICA_MS).toISOString().slice(0, 10);
  return new Date(`${texto}T00:00:00Z`);
}

/** Suma (o resta) anios a una fecha de calendario. */
export function sumarAnios(fecha: Date, anios: number): Date {
  const copia = new Date(fecha);
  copia.setUTCFullYear(copia.getUTCFullYear() + anios);
  return copia;
}
