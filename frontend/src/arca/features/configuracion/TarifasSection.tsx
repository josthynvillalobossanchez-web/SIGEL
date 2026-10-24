import { useState, type FormEvent } from 'react';
import { conceptsApi } from '../../api/endpoints';
import { ApiProblem } from '../../api/http';
import type { Concept, ConceptType, Periodicity } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Field, Select, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import pages from '../../components/pages.module.css';
import { CONCEPT_TYPE_LABEL, PERIODICITY_LABEL } from '../../lib/labels';
import { toCents } from '../../lib/money';
import { errorMessage, useAsync } from '../../lib/useAsync';

/**
 * Tarifas y conceptos. La tarifa se cambia directamente en la tabla (campo + Guardar); el formulario permite crear
 * conceptos nuevos y editar nombre, tipo, periodicidad y estado. Los cambios de tarifa quedan en el historial y en la
 * bitácora, y los recibos ya emitidos no cambian.
 */
export function TarifasSection() {
  const list = useAsync(() => conceptsApi.list(), []);
  const [editing, setEditing] = useState<{ concept?: Concept } | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const columns: Column<Concept>[] = [
    { key: 'c', header: 'Código', render: (c) => <span className={pages.strong}>{c.code}</span> },
    { key: 'n', header: 'Concepto', render: (c) => c.name },
    { key: 't', header: 'Tipo', render: (c) => CONCEPT_TYPE_LABEL[c.type] },
    { key: 'p', header: 'Periodicidad', render: (c) => PERIODICITY_LABEL[c.periodicity] },
    {
      key: 'r',
      header: 'Tarifa ₡',
      width: 250,
      render: (c) => <PriceCell key={`${c.id}-${c.price}`} concept={c} onError={setRowError} onSaved={list.reload} />,
    },
    { key: 'e', header: 'Estado', render: (c) => (c.active ? 'Activo' : 'Inactivo') },
    {
      key: 'a',
      header: 'Acciones',
      srOnlyHeader: true,
      align: 'right',
      render: (c) => (
        <button type="button" className={pages.linkBtn} onClick={() => setEditing({ concept: c })} aria-label={`Editar ${c.name}`}>
          Editar
        </button>
      ),
    },
  ];

  return (
    <div className={pages.stack}>
      <div className={pages.toolbar} style={{ justifyContent: 'space-between' }}>
        <p className={pages.muted} style={{ margin: 0, maxWidth: 640 }}>
          Fije aquí las tarifas oficiales. Al cobrar, cada concepto toma su tarifa actual; los recibos ya emitidos conservan la que tenían.
        </p>
        <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={() => setEditing({})}>
          Nuevo concepto
        </Button>
      </div>
      {editing && (
        <ConceptForm
          key={editing.concept?.id ?? 'new'}
          concept={editing.concept}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
      <Card as="div">
        {(list.error || rowError) && <Alert>{rowError ?? list.error?.message}</Alert>}
        {list.data && (
          <DataTable
            caption="Conceptos y tarifas"
            columns={columns}
            rows={list.data}
            rowKey={(c) => c.id}
            empty={<EmptyState>El catálogo está vacío. Cree el primer concepto con «Nuevo concepto».</EmptyState>}
          />
        )}
      </Card>
    </div>
  );
}

/** Tarifa editable en la propia fila: aparece «Guardar» solo cuando el valor cambió. */
function PriceCell({ concept, onError, onSaved }: { concept: Concept; onError: (m: string | null) => void; onSaved: () => void }) {
  const [price, setPrice] = useState(concept.price);
  const [busy, setBusy] = useState(false);
  const dirty = toCents(price) !== toCents(concept.price);

  async function save() {
    setBusy(true);
    onError(null);
    try {
      await conceptsApi.update(concept.id, {
        code: concept.code,
        name: concept.name,
        type: concept.type,
        periodicity: concept.periodicity,
        price,
        active: concept.active,
      });
      onSaved();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
      <div style={{ width: 128 }}>
        <MoneyInput value={price} onValueChange={setPrice} aria-label={`Tarifa de ${concept.name}`} onKeyDown={(e) => e.key === 'Enter' && dirty && void save()} />
      </div>
      <div style={{ width: 84 }}>
        {dirty && (
          <Button variant="primary" disabled={busy} onClick={() => void save()} aria-label={`Guardar la tarifa de ${concept.name}`}>
            {busy ? '…' : 'Guardar'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConceptForm({ concept, onCancel, onSaved }: { concept?: Concept; onCancel: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(concept?.code ?? '');
  const [name, setName] = useState(concept?.name ?? '');
  const [type, setType] = useState<ConceptType>(concept?.type ?? 'ENTRADA');
  const [periodicity, setPeriodicity] = useState<Periodicity>(concept?.periodicity ?? 'POR_USO');
  const [price, setPrice] = useState(concept?.price ?? 0);
  const [active, setActive] = useState(concept?.active ?? true);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setCodeError(code.trim() ? null : 'Escriba el código.');
    setNameError(name.trim() ? null : 'Escriba el nombre del concepto.');
    setError(null);
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    const body = { code: code.trim(), name: name.trim(), type, periodicity, price, active };
    try {
      if (concept) await conceptsApi.update(concept.id, body);
      else await conceptsApi.create(body);
      onSaved();
    } catch (err) {
      if (err instanceof ApiProblem && err.code === 'DUPLICATE_CODE') setCodeError(err.message);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card title={concept ? `Editar ${concept.code}` : 'Nuevo concepto'}>
        <div className={pages.formGrid} style={{ gridTemplateColumns: '140px 1fr 160px 160px 160px' }}>
          <Field label="Código" error={codeError}>
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} readOnly={!!concept} maxLength={20} autoComplete="off" />
          </Field>
          <Field label="Concepto" error={nameError}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={150} autoComplete="off" />
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as ConceptType)}>
              {(Object.keys(CONCEPT_TYPE_LABEL) as ConceptType[]).map((t) => (
                <option key={t} value={t}>
                  {CONCEPT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Periodicidad">
            <Select value={periodicity} onChange={(e) => setPeriodicity(e.target.value as Periodicity)}>
              {(Object.keys(PERIODICITY_LABEL) as Periodicity[]).map((p) => (
                <option key={p} value={p}>
                  {PERIODICITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tarifa ₡">
            <MoneyInput size={44} value={price} onValueChange={setPrice} />
          </Field>
        </div>
        <label className={pages.mt16} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 20, height: 20 }} />
          Concepto activo (disponible para cobrar)
        </label>
        {error && <Alert className={pages.mt8}>{error}</Alert>}
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
