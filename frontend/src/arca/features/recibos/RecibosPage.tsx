import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { conceptsApi, receiptsApi, usersApi } from '../../api/endpoints';
import type { ReceiptFilters, ReceiptStatus, ReceiptSummary } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Field, Select, TextInput } from '../../components/Field';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import pages from '../../components/pages.module.css';
import { formatDateTime } from '../../lib/dates';
import { formatColones } from '../../lib/money';
import { useAsync } from '../../lib/useAsync';
import { canVoid } from '../../lib/void';
import styles from './RecibosPage.module.css';

const PAGE_SIZE = 20;

interface FormState {
  from: string;
  to: string;
  cashierId: string;
  conceptId: string;
  status: '' | ReceiptStatus;
  client: string;
}

const emptyForm: FormState = { from: '', to: '', cashierId: '', conceptId: '', status: '', client: '' };

/** Consulta de recibos con filtros, paginación en el servidor y acciones Ver / Reimprimir / Anular. */
export function RecibosPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [applied, setApplied] = useState<FormState>(emptyForm);
  const [page, setPage] = useState(0);
  const users = useAsync(() => usersApi.lookup(), []);
  const concepts = useAsync(() => conceptsApi.list(), []);

  const result = useAsync(() => {
    const f: ReceiptFilters = {
      from: applied.from || undefined,
      to: applied.to || undefined,
      cashierId: applied.cashierId || undefined,
      conceptId: applied.conceptId ? Number(applied.conceptId) : undefined,
      status: applied.status || undefined,
      client: applied.client.trim() || undefined,
      page,
      size: PAGE_SIZE,
    };
    return receiptsApi.list(f);
  }, [applied, page]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    setPage(0);
    setApplied(form);
  }

  const now = new Date();
  const data = result.data;

  const columns: Column<ReceiptSummary>[] = [
    { key: 'n', header: 'Nº recibo', render: (r) => <span className={pages.strong}>{r.number}</span> },
    { key: 'f', header: 'Fecha', render: (r) => formatDateTime(r.issuedAt) },
    { key: 'c', header: 'Cajero', render: (r) => r.cashierName },
    { key: 'cl', header: 'Cliente', render: (r) => r.clientName ?? <span className={pages.muted}>Sin identificar</span> },
    { key: 'k', header: 'Concepto', render: (r) => r.concept },
    { key: 't', header: 'Total', align: 'right', render: (r) => formatColones(r.total) },
    { key: 's', header: 'Estado', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'a',
      header: 'Acciones',
      srOnlyHeader: true,
      align: 'right',
      render: (r) => (
        <div className={pages.rowActions}>
          <button type="button" className={pages.linkBtn} onClick={() => navigate(`/cobro/recibos/${r.id}`)} aria-label={`Ver recibo ${r.number}`}>
            Ver
          </button>
          <button type="button" className={pages.linkBtn} onClick={() => navigate(`/cobro/recibos/${r.id}?print=1`)} aria-label={`Reimprimir recibo ${r.number}`}>
            Reimprimir
          </button>
          {canVoid(r, now) && (
            <button type="button" className={pages.linkBtnDanger} onClick={() => navigate(`/cobro/anulaciones?recibo=${r.id}`)} aria-label={`Anular recibo ${r.number}`}>
              Anular
            </button>
          )}
          {r.status === 'PAGADO' && !canVoid(r, now) && <span className={pages.muted}>Fuera de plazo (48 h)</span>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Recibos" subtitle="Consulta, reimpresión y anulación de recibos emitidos." />
      <Card as="div">
        <form onSubmit={submit}>
          <div className={styles.filters}>
            <Field label="Desde">
              <TextInput type="date" value={form.from} max={form.to || undefined} onChange={(e) => set('from', e.target.value)} />
            </Field>
            <Field label="Hasta">
              <TextInput type="date" value={form.to} min={form.from || undefined} onChange={(e) => set('to', e.target.value)} />
            </Field>
            <Field label="Cajero">
              <Select value={form.cashierId} onChange={(e) => set('cashierId', e.target.value)}>
                <option value="">Todos</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Concepto">
              <Select value={form.conceptId} onChange={(e) => set('conceptId', e.target.value)}>
                <option value="">Todos</option>
                {concepts.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
                <option value="">Todos</option>
                <option value="PAGADO">Pagado</option>
                <option value="ANULADO">Anulado</option>
              </Select>
            </Field>
            <Button type="submit" variant="primary" className={styles.filterBtn}>
              Filtrar
            </Button>
            <Field label="Cliente (cédula o nombre)" className={styles.clientRow}>
              <TextInput value={form.client} onChange={(e) => set('client', e.target.value)} autoComplete="off" />
            </Field>
          </div>
        </form>
      </Card>

      <Card as="div" className={pages.mt16}>
        {result.error && <Alert>{result.error.message}</Alert>}
        {data && (
          <>
            <DataTable
              caption="Recibos emitidos"
              columns={columns}
              rows={data.content}
              rowKey={(r) => r.id}
              empty={<EmptyState>Sin resultados</EmptyState>}
            />
            <div className={pages.pager}>
              <span aria-live="polite">
                Mostrando {data.content.length} de {data.totalElements} recibos
              </span>
              {data.totalPages > 1 && (
                <div className={pages.pagerButtons}>
                  <Button disabled={page === 0 || result.loading} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <span style={{ alignSelf: 'center' }}>
                    Página {page + 1} de {data.totalPages}
                  </span>
                  <Button disabled={page + 1 >= data.totalPages || result.loading} onClick={() => setPage((p) => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
        {result.loading && !data && <p role="status">Cargando…</p>}
      </Card>
    </>
  );
}
