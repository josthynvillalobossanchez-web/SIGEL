import { fromCents, toCents } from './money';

/** Cálculos puros del cobro. El servidor recalcula siempre; esto solo da la vista previa y valida el botón. */

export interface DraftLine {
  conceptId: number;
  name: string;
  qty: number;
  monto: number;
  desc: number;
  rec: number;
}

export interface DraftPayments {
  card: number;
  sinpe: number;
  transfer: number;
  cashReceived: number;
}

export interface Totals {
  subtotal: number;
  discounts: number;
  surcharges: number;
  total: number;
  electronic: number;
  cashDue: number;
}

/** importe = max(0, cant × monto − descuento + recargo) */
export function lineAmount(l: Pick<DraftLine, 'qty' | 'monto' | 'desc' | 'rec'>): number {
  const gross = l.qty * toCents(l.monto);
  return fromCents(Math.max(0, gross - toCents(l.desc) + toCents(l.rec)));
}

/** efectivo a cobrar = max(0, total − pagos electrónicos) */
export function cashDue(total: number, electronic: number): number {
  return fromCents(Math.max(0, toCents(total) - toCents(electronic)));
}

/** vuelto = max(0, efectivo recibido − efectivo a cobrar) */
export function change(cashReceived: number, due: number): number {
  return fromCents(Math.max(0, toCents(cashReceived) - toCents(due)));
}

export function totals(lines: DraftLine[], pay: Pick<DraftPayments, 'card' | 'sinpe' | 'transfer'>): Totals {
  const subtotal = lines.reduce((a, l) => a + l.qty * toCents(l.monto), 0);
  const discounts = lines.reduce((a, l) => a + toCents(l.desc), 0);
  const surcharges = lines.reduce((a, l) => a + toCents(l.rec), 0);
  const total = subtotal - discounts + surcharges;
  const electronic = toCents(pay.card) + toCents(pay.sinpe) + toCents(pay.transfer);
  return {
    subtotal: fromCents(subtotal),
    discounts: fromCents(discounts),
    surcharges: fromCents(surcharges),
    total: fromCents(total),
    electronic: fromCents(electronic),
    cashDue: fromCents(Math.max(0, total - electronic)),
  };
}

/** diferencia = contado − esperado (negativa: faltante; positiva: sobrante) */
export function cashDifference(counted: number, expected: number): number {
  return fromCents(toCents(counted) - toCents(expected));
}

export type ChargeBlock = 'NO_LINES' | 'INVALID_TOTAL' | 'ELECTRONIC_EXCEEDS_TOTAL' | 'CASH_INSUFFICIENT' | 'INVALID_QUANTITY' | null;

/** Primer motivo que impide cobrar, o null si se puede cobrar. */
export function chargeBlock(lines: DraftLine[], pay: DraftPayments): ChargeBlock {
  if (lines.length === 0) return 'NO_LINES';
  if (lines.some((l) => l.qty <= 0)) return 'INVALID_QUANTITY';
  const t = totals(lines, pay);
  if (t.total <= 0) return 'INVALID_TOTAL';
  if (toCents(t.electronic) > toCents(t.total)) return 'ELECTRONIC_EXCEEDS_TOTAL';
  if (toCents(pay.cashReceived) < toCents(t.cashDue)) return 'CASH_INSUFFICIENT';
  return null;
}
