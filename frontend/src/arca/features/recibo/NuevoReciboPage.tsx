import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { clientsApi, conceptsApi, receiptsApi } from '../../api/endpoints';
import type { Receipt } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Kbd } from '../../components/Kbd';
import { PageHeader } from '../../components/PageHeader';
import { ReceiptView } from '../../components/ReceiptView';
import { chargeBlock, totals } from '../../lib/calc';
import { formatColones } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { useSession } from '../../store/session';
import { receiptFormatOf, useSettings } from '../../store/settings';
import { ClientSection } from './ClientSection';
import { draftReducer, emptyDraft } from './draft';
import { LinesSection } from './LinesSection';
import styles from './NuevoReciboPage.module.css';
import { PaymentCard, SummaryCard } from './SummaryAndPayment';

const SHORTCUTS: [string, string][] = [
  ['F2', 'Buscar'],
  ['F4', 'Concepto'],
  ['F6', 'Efectivo'],
  ['F9', 'Cobrar'],
  ['Esc', 'Cancelar'],
];

/** Pantalla de trabajo principal: cliente → conceptos → resumen → pago mixto → cobrar e imprimir. */
export function NuevoReciboPage() {
  const cashSession = useSession((s) => s.cashSession);
  const { printFormat, autoPrint } = useSettings((s) => s.settings);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Receipt | null>(null);
  const [printToken, setPrintToken] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const catalog = useAsync(() => conceptsApi.list(true), []);

  // "Cobrar a este cliente" (desde Clientes) llega con ?cliente=ID.
  const preloadId = Number(params.get('cliente')) || null;
  useEffect(() => {
    if (!preloadId) return;
    clientsApi
      .get(preloadId)
      .then((c) => dispatch({ type: 'client', client: c }))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setParams({}, { replace: true }));
  }, [preloadId, setParams]);

  const t = totals(draft.lines, draft.pay);
  const block = chargeBlock(draft.lines, draft.pay);
  const cashOpen = !!cashSession;
  const canCharge = block === null && cashOpen && !charging && !done;

  const newReceipt = useCallback(() => {
    dispatch({ type: 'reset' });
    setDone(null);
    setError(null);
  }, []);

  const charge = useCallback(async () => {
    if (!canCharge) return;
    setCharging(true);
    setError(null);
    try {
      const receipt = await receiptsApi.create({
        clientId: draft.client?.id,
        lines: draft.lines.map((l) => ({
          conceptId: l.conceptId,
          quantity: l.qty,
          unitAmount: l.monto,
          discount: l.desc,
          surcharge: l.rec,
        })),
        payments: draft.pay,
      });
      setDone(receipt);
      if (autoPrint) setPrintToken((n) => n + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCharging(false);
    }
  }, [canCharge, draft, autoPrint]);

  // Atajos de teclado: solo existen mientras esta pantalla está montada. F-keys llevan preventDefault.
  const chargeRef = useRef(charge);
  chargeRef.current = charge;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case 'F4':
          e.preventDefault();
          selectRef.current?.focus();
          break;
        case 'F6':
          e.preventDefault();
          cashRef.current?.focus();
          break;
        case 'F9':
          e.preventDefault();
          void chargeRef.current();
          break;
        case 'Escape':
          newReceipt();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newReceipt]);

  // Imprime el tiquete recién emitido (el recibo está montado fuera de pantalla, solo visible al imprimir).
  useEffect(() => {
    if (!done || printToken === 0) return;
    const id = window.setTimeout(() => window.print(), 100);
    return () => window.clearTimeout(id);
  }, [done, printToken]);

  return (
    <>
      <PageHeader
        title="Nuevo recibo"
        subtitle="Recibo Nº · se asigna al cobrar · borrador"
        actions={
          <div className={styles.shortcuts} aria-label="Atajos de teclado">
            {SHORTCUTS.map(([k, label]) => (
              <span key={k} className={styles.shortcut}>
                <Kbd>{k}</Kbd>
                {label}
              </span>
            ))}
          </div>
        }
      />

      {!cashOpen && (
        <Alert className={styles.banner}>
          Caja cerrada: no se puede cobrar. <Link to="/cobro/caja">Abrir caja</Link>
        </Alert>
      )}

      {done && (
        <div className={styles.success} role="status">
          <Icon name="check" size={32} strokeWidth={2} />
          <div className={styles.successText}>
            <div className={styles.successTitle}>Cobro registrado · Recibo {done.number}</div>
            <div className={styles.successMeta}>
              Total {formatColones(done.total)} · Vuelto {formatColones(done.change)}
              {autoPrint && '. Enviado a imprimir.'}
            </div>
          </div>
          <Button onClick={() => navigate(`/cobro/recibos/${done.id}`)}>Ver recibo</Button>
          <Button icon={<Icon name="printer" size={16} />} onClick={() => setPrintToken((n) => n + 1)}>
            Reimprimir
          </Button>
          <Button variant="primary" onClick={newReceipt}>
            Nuevo recibo
          </Button>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.left}>
          <ClientSection
            client={draft.client}
            anonymous={draft.anonymous}
            searchRef={searchRef}
            onPick={(c) => dispatch({ type: 'client', client: c })}
            onAnonymous={() => dispatch({ type: 'anonymous' })}
            onClear={() => dispatch({ type: 'clearClient' })}
          />
          <LinesSection
            lines={draft.lines}
            catalog={catalog.data ?? []}
            catalogError={catalog.error?.message ?? null}
            selectRef={selectRef}
            dispatch={dispatch}
          />
        </div>

        <div className={styles.right}>
          <SummaryCard t={t} />
          <PaymentCard pay={draft.pay} t={t} cashRef={cashRef} dispatch={dispatch} />
          {error && <Alert>{error}</Alert>}
          <Button variant="primary" height={72} block className={styles.charge} disabled={!canCharge} onClick={() => void charge()}>
            <Icon name="printer" size={24} />
            {charging ? 'Cobrando…' : 'Cobrar e imprimir'}
            <Kbd inverse>F9</Kbd>
          </Button>
        </div>
      </div>

      {done && (
        <div className="print-only" aria-hidden="true">
          <ReceiptView receipt={done} format={receiptFormatOf(printFormat)} />
        </div>
      )}
    </>
  );
}
