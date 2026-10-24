import { Decimal } from 'decimal.js';

/** Dinero: decimal.js, escala 2, HALF_UP. Moneda única: CRC. Nunca `number` para operar. */
export const Money = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export type Money = Decimal;

export type MoneyInput = Decimal.Value | { toString(): string } | null | undefined;

export function money(v: MoneyInput): Decimal {
  if (v === null || v === undefined || v === '') return new Money(0).toDecimalPlaces(2);
  return new Money(v.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export const ZERO = money(0);

/** Valor para JSON (número con 2 decimales). */
export function num(v: MoneyInput): number {
  return money(v).toNumber();
}

/** Para escribir en columnas DECIMAL de Prisma. */
export function dec(v: MoneyInput): string {
  return money(v).toFixed(2);
}

/** Formato es-CR: ₡1.234.567,89 (miles con punto, decimales con coma, menos tipográfico). */
export function formatColones(v: MoneyInput): string {
  if (v === null || v === undefined) return '—';
  const m = money(v);
  const [int, frac] = m.abs().toFixed(2).split('.');
  return `${m.isNegative() && !m.isZero() ? '−' : ''}₡${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`;
}
