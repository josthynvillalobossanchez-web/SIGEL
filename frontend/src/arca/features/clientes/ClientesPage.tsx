import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { clientsApi } from '../../api/endpoints';
import { ApiProblem } from '../../api/http';
import type { Client, ClientIdType, ReceiptSummary } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Field, Select, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import pages from '../../components/pages.module.css';
import { formatDate } from '../../lib/dates';
import { CLIENT_ID_TYPE_LABEL, CLIENT_ID_TYPE_OPTION } from '../../lib/labels';
import { formatColones } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';
import styles from './ClientesPage.module.css';

const ID_FORMAT_ERROR = 'Formato inválido: use 9 dígitos sin guiones.';

/** Clientes: búsqueda, ficha con historial de pagos y registro. No hay saldos ni pendientes. */
export function ClientesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<{ mode: 'new' | 'edit'; client?: Client } | null>(null);

  const list = useAsync(() => clientsApi.search(term, 0, 50), [term]);
  const clients = list.data?.content ?? [];
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  // El texto de búsqueda se aplica con retardo.
  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const columns: Column<Client>[] = [
    { key: 'id', header: 'Identificación', render: (c) => <span className={pages.strong}>{c.idNumber}</span> },
    { key: 'n', header: 'Nombre', render: (c) => c.fullName },
    { key: 't', header: 'Tipo', render: (c) => CLIENT_ID_TYPE_LABEL[c.idType] },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Contribuyentes registrados. El cobro siempre es inmediato: no hay deudas ni saldos pendientes."
        actions={
          <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => setForm({ mode: 'new' })}>
            Registrar cliente
          </Button>
        }
      />
      <div className={`${pages.grid2} ${styles.layout}`}>
        <Card as="div">
          <Field label="Buscar por cédula o nombre" className={styles.search}>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </Field>
          {list.error && <Alert className={pages.mt8}>{list.error.message}</Alert>}
          <div className={pages.mt16} aria-live="polite">
            {list.data && (
              <DataTable
                caption="Clientes"
                columns={columns}
                rows={clients}
                rowKey={(c) => c.id}
                selectedKey={selected?.id}
                onRowClick={(c) => {
                  setSelectedId(c.id);
                  setForm(null);
                }}
                rowLabel={(c) => `Ver ficha de ${c.fullName}`}
                empty={<EmptyState>{term ? 'Sin resultados' : 'Aún no hay clientes registrados.'}</EmptyState>}
              />
            )}
          </div>
        </Card>

        <div className={pages.stack}>
          {form && (
            <ClientForm
              key={form.client?.id ?? 'new'}
              client={form.client}
              onCancel={() => setForm(null)}
              onSaved={(c) => {
                setForm(null);
                setSelectedId(c.id);
                list.reload();
              }}
            />
          )}
          {!form && selected && <Ficha client={selected} onEdit={() => setForm({ mode: 'edit', client: selected })} onCharge={() => navigate(`/cobro/recibos/nuevo?cliente=${selected.id}`)} />}
          {!form && !selected && <EmptyState>Seleccione un cliente para ver su ficha.</EmptyState>}
        </div>
      </div>
    </>
  );
}

function Ficha({ client, onEdit, onCharge }: { client: Client; onEdit: () => void; onCharge: () => void }) {
  const history = useAsync(() => clientsApi.receipts(client.id, 0, 10), [client.id]);
  const columns: Column<ReceiptSummary>[] = [
    { key: 'f', header: 'Fecha', render: (r) => formatDate(r.issuedAt) },
    {
      key: 'n',
      header: 'Recibo',
      render: (r) => (
        <Link to={`/cobro/recibos/${r.id}`} className={pages.strong}>
          {r.number}
        </Link>
      ),
    },
    { key: 'k', header: 'Concepto', render: (r) => r.concept },
    { key: 'm', header: 'Monto', align: 'right', render: (r) => (r.status === 'ANULADO' ? <s>{formatColones(r.total)}</s> : formatColones(r.total)) },
  ];
  return (
    <Card
      as="div"
      aside={
        <button type="button" className={pages.linkBtn} onClick={onEdit}>
          Editar
        </button>
      }
    >
      <h2>{client.fullName}</h2>
      <div className={pages.muted}>
        {client.idNumber} · {CLIENT_ID_TYPE_LABEL[client.idType]}
      </div>
      <dl className={styles.facts}>
        <dt>Teléfono</dt>
        <dd>{client.phone ?? '—'}</dd>
        <dt>Correo</dt>
        <dd>{client.email ?? '—'}</dd>
        <dt>Dirección</dt>
        <dd>{client.address ? `${client.address}, Palmares, Alajuela` : '—'}</dd>
      </dl>
      <h3 className={styles.histTitle}>Historial de pagos</h3>
      {history.error && <Alert>{history.error.message}</Alert>}
      {history.data && (
        <DataTable caption="Historial de pagos" columns={columns} rows={history.data.content} rowKey={(r) => r.id} empty={<EmptyState>Sin pagos registrados.</EmptyState>} />
      )}
      <div className={pages.actions}>
        <Button variant="primary" block onClick={onCharge}>
          Cobrar a este cliente
        </Button>
      </div>
    </Card>
  );
}

function ClientForm({ client, onCancel, onSaved }: { client?: Client; onCancel: () => void; onSaved: (c: Client) => void }) {
  const [idType, setIdType] = useState<ClientIdType>(client?.idType ?? 'FISICA');
  const [idNumber, setIdNumber] = useState(client?.idNumber ?? '');
  const [fullName, setFullName] = useState(client?.fullName ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [address, setAddress] = useState(client?.address ?? '');
  const [idError, setIdError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const badId = !/^\d{9}$/.test(idNumber.trim());
    const badName = !fullName.trim();
    const badEmail = !!email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim());
    setIdError(badId ? ID_FORMAT_ERROR : null);
    setNameError(badName ? 'Escriba el nombre completo.' : null);
    setEmailError(badEmail ? 'Correo inválido.' : null);
    setError(null);
    if (badId || badName || badEmail) return;
    setBusy(true);
    const body = { idType, idNumber: idNumber.trim(), fullName: fullName.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() };
    try {
      onSaved(client ? await clientsApi.update(client.id, body) : await clientsApi.create(body));
    } catch (err) {
      if (err instanceof ApiProblem && err.code === 'INVALID_ID_FORMAT') setIdError(ID_FORMAT_ERROR);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card title={client ? 'Editar cliente' : 'Registrar cliente'}>
        <div className={pages.formGrid} style={{ gridTemplateColumns: '160px 1fr' }}>
          <Field label="Tipo">
            <Select value={idType} onChange={(e) => setIdType(e.target.value as ClientIdType)}>
              {(Object.keys(CLIENT_ID_TYPE_OPTION) as ClientIdType[]).map((t) => (
                <option key={t} value={t}>
                  {CLIENT_ID_TYPE_OPTION[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Identificación" error={idError}>
            <TextInput value={idNumber} onChange={(e) => setIdNumber(e.target.value)} inputMode="numeric" autoComplete="off" />
          </Field>
        </div>
        <div className={pages.formGrid} style={{ marginTop: 16 }}>
          <Field label="Nombre completo" error={nameError}>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
          </Field>
          <div className={pages.formGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Teléfono">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
            </Field>
            <Field label="Correo" error={emailError}>
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="off" />
            </Field>
          </div>
          <Field label="Dirección">
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        {error && <Alert className={pages.mt16}>{error}</Alert>}
        <div className={pages.actions}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button variant="link" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
  );
}
