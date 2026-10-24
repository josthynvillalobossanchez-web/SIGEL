import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { receiptsApi } from '../../api/endpoints';
import { ApiProblem } from '../../api/http';
import type { Receipt, ReceiptSummary, VoidReason } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Field, Select, TextArea, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { ReceiptView } from '../../components/ReceiptView';
import { StatusBadge } from '../../components/StatusBadge';
import pages from '../../components/pages.module.css';
import { formatDateTime, formatDate } from '../../lib/dates';
import { VOID_REASON_LABEL } from '../../lib/labels';
import { formatColones } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';
import { canVoid, elapsedLabel } from '../../lib/void';
import styles from './AnulacionesPage.module.css';

const DETAIL_ERROR = 'Escriba el detalle del motivo para continuar.';
const REASONS = Object.keys(VOID_REASON_LABEL) as VoidReason[];

/**
 * Anulación: solo recibos pagados emitidos hace 48 h o menos. Motivo + detalle obligatorios y credenciales de
 * un supervisor. El recibo nunca se elimina: queda ANULADO con motivo y quién autorizó, y se registra en la bitácora.
 */
export function AnulacionesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const list = useAsync(() => receiptsApi.voidable(true), []);
  const [selectedId, setSelectedId] = useState<number | null>(Number(params.get('recibo')) || null);
  const [reason, setReason] = useState<VoidReason>('ERROR_MONTO');
  const [detail, setDetail] = useState('');
  const [supUser, setSupUser] = useState('');
  const [supPass, setSupPass] = useState('');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Receipt | null>(null);
  const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const now = new Date();
  const rows = list.data ?? [];
  const selected = rows.find((r) => r.id === selectedId && canVoid(r, now)) ?? null;
  const firstOk = rows.find((r) => canVoid(r, now)) ?? null;

  // Sin selección válida, se propone el primer recibo anulable (como en el diseño).
  useEffect(() => {
    if (!result && list.data && !selected && firstOk) setSelectedId(firstOk.id);
  }, [list.data, selected, firstOk, result]);

  function pick(r: ReceiptSummary) {
    if (!canVoid(r, now)) return;
    setSelectedId(r.id);
    setResult(null);
    setError(null);
    setDetailError(null);
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let i = index + dir; i >= 0 && i < rows.length; i += dir) {
      if (canVoid(rows[i], now)) {
        pick(rows[i]);
        optionRefs.current[rows[i].id]?.focus();
        return;
      }
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    if (!detail.trim()) {
      setDetailError(DETAIL_ERROR);
      return;
    }
    setDetailError(null);
    if (!supUser.trim() || !supPass) {
      setError('Ingrese el correo y la contraseña de un supervisor para autorizar la anulación.');
      return;
    }
    setBusy(true);
    try {
      const voided = await receiptsApi.void(selected.id, {
        reason,
        detail: detail.trim(),
        supervisorUsername: supUser.trim(),
        supervisorPassword: supPass,
      });
      setResult(voided);
      setDetail('');
      setSupPass('');
      setSupUser('');
      list.reload();
    } catch (err) {
      if (err instanceof ApiProblem && err.fieldMessage('detail')) setDetailError(err.fieldMessage('detail') ?? DETAIL_ERROR);
      else setError(errorMessage(err));
      setSupPass('');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDetail('');
    setSupUser('');
    setSupPass('');
    setDetailError(null);
    setError(null);
    setResult(null);
  }

  return (
    <>
      <PageHeader title="Anulación de recibo" subtitle="El recibo anulado nunca se elimina: queda en el historial con su motivo y quién autorizó." />
      <div className={`${pages.grid2} ${styles.layout}`}>
        <div className={pages.stack}>
          <Card title="Recibos pagados (últimas 48 h anulables)">
            {list.error && <Alert>{list.error.message}</Alert>}
            {list.loading && !list.data && <p role="status">Cargando…</p>}
            {list.data && rows.length === 0 && <EmptyState>Sin recibos pagados recientes.</EmptyState>}
            {rows.length > 0 && (
              <div className={styles.list} role="radiogroup" aria-label="Recibos pagados">
                {rows.map((r, i) => {
                  const ok = canVoid(r, now);
                  const on = ok && selected?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      ref={(el) => {
                        optionRefs.current[r.id] = el;
                      }}
                      role="radio"
                      aria-checked={on}
                      aria-disabled={!ok}
                      tabIndex={on || (!selected && ok && firstOk?.id === r.id) ? 0 : -1}
                      data-focus-inset
                      className={`${styles.option} ${on ? styles.on : ''} ${ok ? '' : styles.late}`}
                      onClick={() => pick(r)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          pick(r);
                        } else onKeyDown(e, i);
                      }}
                    >
                      <div>
                        <b>{r.number}</b>
                        <div className={pages.muted}>
                          {formatDate(r.issuedAt)} · {elapsedLabel(r.issuedAt, now)}
                        </div>
                      </div>
                      <div className={styles.mid}>
                        {r.clientName ?? 'Sin identificar'} · {r.concept}
                        {!ok && (
                          <div className={styles.lateNote}>
                            <Icon name="clock" size={14} />
                            Fuera del plazo de 48 h. No se puede anular.
                          </div>
                        )}
                      </div>
                      <b>{formatColones(r.total)}</b>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {selected && (
            <form onSubmit={submit} noValidate>
              <Card title="Datos de la anulación">
                <dl className={styles.summary}>
                  <div><dt>Nº</dt><dd>{selected.number}</dd></div>
                  <div><dt>Fecha</dt><dd>{formatDateTime(selected.issuedAt)}</dd></div>
                  <div><dt>Total</dt><dd>{formatColones(selected.total)}</dd></div>
                  <div><dt>Cliente</dt><dd>{selected.clientName ?? 'Sin identificar'}</dd></div>
                  <div><dt>Cajero</dt><dd>{selected.cashierName}</dd></div>
                  <div><dt>Estado</dt><dd><StatusBadge status={selected.status} /></dd></div>
                </dl>

                <div className={styles.fields}>
                  <Field label="Motivo">
                    <Select value={reason} onChange={(e) => setReason(e.target.value as VoidReason)}>
                      {REASONS.map((r) => (
                        <option key={r} value={r}>
                          {VOID_REASON_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Detalle (obligatorio)" error={detailError}>
                    <TextArea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
                  </Field>
                </div>

                <fieldset className={styles.supervisor}>
                  <legend>Autorización del supervisor</legend>
                  <div className={pages.formGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <Field label="Correo del supervisor">
                      <TextInput value={supUser} onChange={(e) => setSupUser(e.target.value)} autoComplete="off" required />
                    </Field>
                    <Field label="Contraseña del supervisor">
                      <TextInput type="password" value={supPass} onChange={(e) => setSupPass(e.target.value)} autoComplete="off" required />
                    </Field>
                  </div>
                </fieldset>

                {error && <Alert className={pages.mt16}>{error}</Alert>}
                <div className={pages.actions}>
                  <Button type="submit" variant="danger" height={48} disabled={busy}>
                    {busy ? 'Anulando…' : 'Anular recibo'}
                  </Button>
                  <Button variant="link" onClick={cancel}>
                    Cancelar
                  </Button>
                </div>
              </Card>
            </form>
          )}
        </div>

        <Card title="Resultado" sticky aria-live="polite">
          {!result && <EmptyState>La vista previa del recibo anulado aparecerá aquí.</EmptyState>}
          {result && (
            <>
              <div className={styles.preview}>
                <ReceiptView receipt={result} format="termico" redStamp />
              </div>
              <Alert tone="info" className={pages.mt16}>
                Anulación registrada. Autorizó {result.voidInfo?.authorizedBy.fullName} el{' '}
                {result.voidInfo ? formatDateTime(result.voidInfo.voidedAt) : ''}. El recibo se conserva en el historial.
              </Alert>
              <div className={pages.actions}>
                <Button onClick={() => navigate(`/cobro/recibos/${result.id}`)}>Ver recibo</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
