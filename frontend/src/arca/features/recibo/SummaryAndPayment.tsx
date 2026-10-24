import type { RefObject } from 'react';
import { Alert } from '../../components/Alert';
import { Card } from '../../components/Card';
import { Icon, type IconName } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { change, type DraftPayments, type Totals } from '../../lib/calc';
import { formatColones, toCents } from '../../lib/money';
import type { DraftAction } from './draft';
import styles from './SummaryAndPayment.module.css';

/** 3 · Resumen: subtotal, descuentos, recargos y TOTAL A COBRAR (36/700). */
export function SummaryCard({ t }: { t: Totals }) {
  return (
    <Card title="3 · Resumen">
      <div className={styles.row}>
        <span>Subtotal</span>
        <span>{formatColones(t.subtotal)}</span>
      </div>
      <div className={styles.row}>
        <span>Descuentos</span>
        <span>− {formatColones(t.discounts)}</span>
      </div>
      <div className={styles.row}>
        <span>Intereses y recargos</span>
        <span>{formatColones(t.surcharges)}</span>
      </div>
      <div className={styles.totalBox}>
        <div className={styles.totalLabel}>Total a cobrar</div>
        <div className={styles.total} data-testid="total">
          {formatColones(t.total)}
        </div>
      </div>
    </Card>
  );
}

interface PaymentProps {
  pay: DraftPayments;
  t: Totals;
  cashRef: RefObject<HTMLInputElement | null>;
  dispatch: (a: DraftAction) => void;
}

const METHODS: { key: 'card' | 'sinpe' | 'transfer'; label: string; icon: IconName }[] = [
  { key: 'card', label: 'Tarjeta', icon: 'card' },
  { key: 'sinpe', label: 'SINPE Móvil', icon: 'phone' },
  { key: 'transfer', label: 'Transferencia', icon: 'transfer' },
];

/** 4 · Pago mixto. El efectivo toma el saldo restante; errores solo cuando ocurren. */
export function PaymentCard({ pay, t, cashRef, dispatch }: PaymentProps) {
  const overPay = toCents(t.electronic) > toCents(t.total);
  const shortCash = t.total > 0 && !overPay && toCents(pay.cashReceived) < toCents(t.cashDue);
  return (
    <Card title="4 · Pago">
      <p className={styles.help}>Pago mixto: complete varios métodos. El efectivo toma el saldo restante.</p>
      <div className={styles.payRow} style={{ minHeight: 44 }}>
        <span className={styles.method}>
          <Icon name="cash" size={18} />
          Efectivo
        </span>
        <b data-testid="cash-due">{formatColones(t.cashDue)}</b>
      </div>
      {METHODS.map((m) => (
        <div key={m.key} className={styles.payRow} style={{ minHeight: 52 }}>
          <span className={styles.method}>
            <Icon name={m.icon} size={18} />
            {m.label}
          </span>
          <div style={{ width: 128 }}>
            <MoneyInput value={pay[m.key]} onValueChange={(v) => dispatch({ type: 'pay', patch: { [m.key]: v } })} aria-label={`Monto ${m.label}`} />
          </div>
        </div>
      ))}
      <div className={styles.cashBox}>
        <label htmlFor="q-cash" className={styles.cashLabel}>
          Efectivo recibido (F6)
        </label>
        <MoneyInput
          id="q-cash"
          ref={cashRef}
          large
          size={48}
          value={pay.cashReceived}
          onValueChange={(v) => dispatch({ type: 'pay', patch: { cashReceived: v } })}
          aria-invalid={shortCash || undefined}
          aria-describedby={shortCash ? 'cash-error' : undefined}
        />
      </div>
      <div className={styles.change}>
        <span>Vuelto</span>
        <span data-testid="change">{formatColones(change(pay.cashReceived, t.cashDue))}</span>
      </div>
      <div aria-live="polite">
        {shortCash && (
          <Alert className={styles.alert}>
            <span id="cash-error">El efectivo recibido es menor al efectivo a cobrar ({formatColones(t.cashDue)}).</span>
          </Alert>
        )}
        {overPay && <Alert className={styles.alert}>Los pagos electrónicos superan el total.</Alert>}
      </div>
    </Card>
  );
}
