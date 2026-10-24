import { useState, type FormEvent } from 'react';
import { cashApi } from '../../api/endpoints';
import type { CashSession, CashSummary } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field, Select, TextArea } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { PageHeader } from '../../components/PageHeader';
import pages from '../../components/pages.module.css';
import { cashDifference } from '../../lib/calc';
import { formatDate, formatTime } from '../../lib/dates';
import { type Counts, DENOMINATIONS, countedTotal } from '../../lib/denominations';
import { formatColones, toCents } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useSession } from '../../store/session';
import styles from './CajaPage.module.css';

/** Apertura y cierre de caja: arqueo por denominación, cuadre y reporte de cierre. */
export function CajaPage() {
  const cashSession = useSession((s) => s.cashSession);
  const reload = useSession((s) => s.reload);
  const [closed, setClosed] = useState<CashSummary | null>(null);

  async function afterChange() {
    await reload();
  }

  return (
    <>
      <PageHeader
        title="Apertura y cierre de caja"
        subtitle={cashSession ? `${cashSession.cashboxName} · ${cashSession.cashierName} · abierta ${formatDate(cashSession.openedAt)} ${formatTime(cashSession.openedAt)}` : 'No hay una caja abierta.'}
        actions={
          <span className={styles.state}>
            <span className={cashSession ? styles.dotOn : styles.dotOff} aria-hidden="true" />
            {cashSession ? 'Caja abierta' : 'Caja cerrada'}
          </span>
        }
      />
      {closed && <ClosedNotice summary={closed} />}
      {cashSession ? (
        <CloseCash
          session={cashSession}
          onClosed={async (s) => {
            setClosed(s);
            await afterChange();
          }}
        />
      ) : (
        <OpenCash
          onOpened={async () => {
            setClosed(null);
            await afterChange();
          }}
        />
      )}
    </>
  );
}

function ClosedNotice({ summary }: { summary: CashSummary }) {
  const [error, setError] = useState<string | null>(null);
  async function openReport() {
    setError(null);
    try {
      const blob = await cashApi.reportBlob(summary.sessionId);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <div className={styles.closed} role="status">
      <Icon name="check" size={32} strokeWidth={2} />
      <div className={styles.closedText}>
        <div className={styles.closedTitle}>Caja cerrada. Reporte de cierre {summary.closingNumber} listo para imprimir.</div>
        <div className={pages.muted}>
          Esperado {formatColones(summary.expectedCash)} · Contado {formatColones(summary.countedCash)} · Diferencia {formatColones(summary.difference)}
        </div>
        {error && <Alert className={pages.mt8}>{error}</Alert>}
      </div>
      <Button icon={<Icon name="printer" size={16} />} onClick={() => void openReport()}>
        Imprimir reporte de cierre
      </Button>
    </div>
  );
}

function OpenCash({ onOpened }: { onOpened: () => Promise<void> }) {
  const loginCashbox = useSession((s) => s.cashbox);
  const cashboxes = useAsync(() => cashApi.cashboxes(), []);
  const [cashboxId, setCashboxId] = useState(loginCashbox ? String(loginCashbox.id) : '');
  const [float, setFloat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cashboxId) {
      setFieldError('Seleccione la caja que va a abrir.');
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await cashApi.open({ cashboxId: Number(cashboxId), openingFloat: float });
      await onOpened();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 520 }}>
      <Card title="Abrir caja nueva">
        <div className={pages.formGrid}>
          <Field label="Caja" error={fieldError}>
            <Select value={cashboxId} onChange={(e) => setCashboxId(e.target.value)}>
              <option value="">Seleccione una caja…</option>
              {cashboxes.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fondo inicial ₡" help="Efectivo con el que inicia la caja. Puede ser 0.">
            <MoneyInput size={44} value={float} onValueChange={setFloat} />
          </Field>
        </div>
        {cashboxes.error && <Alert className={pages.mt16}>{cashboxes.error.message}</Alert>}
        {cashboxes.data?.length === 0 && <Alert className={pages.mt16}>No hay cajas activas. Un administrador debe crearlas.</Alert>}
        {error && <Alert className={pages.mt16}>{error}</Alert>}
        <div className={pages.actions}>
          <Button type="submit" variant="primary" height={56} block disabled={busy}>
            {busy ? 'Abriendo…' : `Abrir caja nueva (fondo inicial ${formatColones(float)})`}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function CloseCash({ session, onClosed }: { session: CashSession; onClosed: (s: CashSummary) => Promise<void> }) {
  const summary = useAsync(() => cashApi.summary(session.id), [session.id]);
  const [counts, setCounts] = useState<Counts>({});
  const [justification, setJustification] = useState('');
  const [justError, setJustError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const s = summary.data;
  const counted = countedTotal(counts);
  const expected = s?.expectedCash ?? session.openingFloat;
  const diff = cashDifference(counted, expected);
  const balanced = toCents(diff) === 0;

  async function close() {
    if (!s) return;
    setError(null);
    if (!balanced && !justification.trim()) {
      setJustError('Registre una justificación antes de cerrar.');
      return;
    }
    setJustError(null);
    setBusy(true);
    try {
      const result = await cashApi.close(session.id, {
        counts: DENOMINATIONS.filter((d) => (counts[d.value] ?? 0) > 0).map((d) => ({ denomination: d.value, quantity: counts[d.value] })),
        justification: justification.trim() || undefined,
      });
      await onClosed(result);
    } catch (e) {
      setError(errorMessage(e));
      summary.reload(); // por si cambió el efectivo del sistema
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${pages.grid2} ${styles.layout}`}>
      <Card title="Arqueo por denominación">
        <table className={styles.table}>
          <caption className="sr-only">Conteo de efectivo por denominación</caption>
          <thead>
            <tr>
              <th scope="col">Denominación</th>
              <th scope="col" style={{ width: 140 }}>Cantidad</th>
              <th scope="col" className={pages.right} style={{ width: 180 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {DENOMINATIONS.map((d) => (
              <tr key={d.value}>
                <th scope="row" className={styles.rowHead}>
                  {d.label}
                </th>
                <td>
                  <MoneyInput
                    integer
                    size={44}
                    value={counts[d.value] ?? 0}
                    onValueChange={(v) => setCounts((c) => ({ ...c, [d.value]: v }))}
                    aria-label={`Cantidad de ${d.label}`}
                  />
                </td>
                <td className={pages.right}>{d.value === 0 ? <span className={pages.muted}>No suma</span> : formatColones(d.value * (counts[d.value] ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Cuadre" sticky>
        {summary.error && <Alert>{summary.error.message}</Alert>}
        <div className={styles.row}>
          <span>Fondo inicial</span>
          <span>{formatColones(session.openingFloat)}</span>
        </div>
        <div className={styles.row}>
          <span>Cobros en efectivo del sistema</span>
          <span>{s ? formatColones(s.cashSystem) : '…'}</span>
        </div>
        {s && s.cashVoided > 0 && <div className={pages.muted}>Ya descuenta {formatColones(s.cashVoided)} de recibos anulados.</div>}
        <div className={`${styles.row} ${styles.strong}`}>
          <span>Esperado en caja</span>
          <span>{formatColones(expected)}</span>
        </div>
        <div className={`${styles.row} ${styles.strong}`}>
          <span>Contado en arqueo</span>
          <span>{formatColones(counted)}</span>
        </div>
        <div className={`${styles.diff} ${balanced ? styles.ok : styles.bad}`} role="status" aria-live="polite">
          <Icon name={balanced ? 'check' : 'alert'} size={20} />
          <div>
            <div className={styles.diffLabel}>Diferencia</div>
            <div className={styles.diffValue}>{formatColones(diff)}</div>
            <div className={styles.diffMsg}>
              {balanced ? 'La caja cuadra.' : `${diff < 0 ? 'Faltante' : 'Sobrante'} de ${formatColones(Math.abs(diff))}. Registre una justificación antes de cerrar.`}
            </div>
          </div>
        </div>
        {!balanced && (
          <Field label="Justificación de la diferencia" error={justError} className={pages.mt16}>
            <TextArea value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} />
          </Field>
        )}
        {error && <Alert className={pages.mt16}>{error}</Alert>}
        <div className={pages.actions}>
          <Button variant="primary" height={56} block disabled={busy || !s} onClick={() => void close()}>
            {busy ? 'Cerrando…' : 'Cerrar caja y generar reporte'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
