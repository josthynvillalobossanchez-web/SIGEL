import { Decimal } from 'decimal.js';
import { ApiError } from '../common/api-error.js';
import { money, Money, MoneyInput, ZERO } from '../common/money.js';

/**
 * Cálculo puro de totales y pago mixto (sin dependencias de Nest ni de la base de datos).
 * El servidor recalcula siempre: importe = max(0, cantidad × monto − descuento + recargo);
 * total = subtotal − descuentos + recargos.
 */
export interface LineInput {
  quantity: number;
  unitAmount: MoneyInput;
  discount?: MoneyInput;
  surcharge?: MoneyInput;
}

export interface PaymentInput {
  card?: MoneyInput;
  sinpe?: MoneyInput;
  transfer?: MoneyInput;
  cashReceived?: MoneyInput;
}

export interface CalcResult {
  lineTotals: Decimal[];
  subtotal: Decimal;
  discounts: Decimal;
  surcharges: Decimal;
  total: Decimal;
  electronic: Decimal;
  cashDue: Decimal;
  change: Decimal;
}

export function lineAmount(l: LineInput): Decimal {
  const gross = money(l.unitAmount).times(l.quantity);
  return Decimal.max(0, gross.minus(money(l.discount)).plus(money(l.surcharge))).toDecimalPlaces(2);
}

export function calculate(lines: LineInput[], pay: PaymentInput): CalcResult {
  if (!lines || lines.length === 0) {
    throw ApiError.unprocessable('NO_LINES', 'El recibo debe tener al menos un concepto.');
  }
  let subtotal: Decimal = ZERO;
  let discounts: Decimal = ZERO;
  let surcharges: Decimal = ZERO;
  const lineTotals: Decimal[] = [];
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw ApiError.unprocessable('INVALID_QUANTITY', 'La cantidad debe ser mayor a cero.');
    }
    requireNonNegative(l.unitAmount, l.discount, l.surcharge);
    subtotal = subtotal.plus(money(l.unitAmount).times(l.quantity));
    discounts = discounts.plus(money(l.discount));
    surcharges = surcharges.plus(money(l.surcharge));
    lineTotals.push(lineAmount(l));
  }
  const total = subtotal.minus(discounts).plus(surcharges).toDecimalPlaces(2);
  if (total.lte(0)) {
    throw ApiError.unprocessable('INVALID_TOTAL', 'El total a cobrar debe ser mayor a cero.');
  }
  requireNonNegative(pay.card, pay.sinpe, pay.transfer, pay.cashReceived);
  const electronic = money(pay.card).plus(money(pay.sinpe)).plus(money(pay.transfer));
  if (electronic.gt(total)) {
    throw ApiError.unprocessable('ELECTRONIC_EXCEEDS_TOTAL', 'Los pagos electrónicos superan el total.');
  }
  const cashDue = total.minus(electronic);
  const received = money(pay.cashReceived);
  if (received.lt(cashDue)) {
    throw ApiError.unprocessable('CASH_INSUFFICIENT', 'El efectivo recibido es menor al efectivo a cobrar.').with(
      'cashDue',
      cashDue.toNumber(),
    );
  }
  return {
    lineTotals,
    subtotal: subtotal.toDecimalPlaces(2),
    discounts,
    surcharges,
    total,
    electronic,
    cashDue,
    change: received.minus(cashDue),
  };
}

function requireNonNegative(...values: MoneyInput[]) {
  for (const v of values) {
    if (v !== null && v !== undefined && new Money(v.toString()).isNegative()) {
      throw ApiError.unprocessable('NEGATIVE_AMOUNT', 'Los montos no pueden ser negativos.');
    }
  }
}
