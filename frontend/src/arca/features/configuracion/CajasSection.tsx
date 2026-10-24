import { useState, type FormEvent } from 'react';
import { cashApi } from '../../api/endpoints';
import type { Cashbox } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Field, Select, TextInput } from '../../components/Field';
import pages from '../../components/pages.module.css';
import { errorMessage, useAsync } from '../../lib/useAsync';
import styles from './Configuracion.module.css';

/**
 * Cajas (ventanillas). Con una sola piscina activa la caja la usa automáticamente; solo si no existe ninguna se pide
 * crearla, y si hubiera varias se ofrece elegir.
 */
export function CajasSection() {
  const pools = useAsync(() => cashApi.pools(), []);
  const boxes = useAsync(() => cashApi.cashboxes(), []);
  const [poolCode, setPoolCode] = useState('');
  const [poolName, setPoolName] = useState('');
  const [boxCode, setBoxCode] = useState('');
  const [boxName, setBoxName] = useState('');
  const [boxPool, setBoxPool] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activePools = (pools.data ?? []).filter((p) => p.active);
  const single = activePools.length === 1 ? activePools[0] : null;

  async function addPool(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await cashApi.createPool({ code: poolCode.trim(), name: poolName.trim() });
      setPoolCode('');
      setPoolName('');
      pools.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function addBox(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await cashApi.createCashbox({ code: boxCode.trim(), name: boxName.trim(), poolId: single ? undefined : Number(boxPool) });
      setBoxCode('');
      setBoxName('');
      boxes.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<Cashbox>[] = [
    { key: 'c', header: 'Código', render: (c) => <span className={pages.strong}>{c.code}</span> },
    { key: 'n', header: 'Caja', render: (c) => c.name },
    ...(activePools.length > 1 ? [{ key: 'p', header: 'Piscina', render: (c: Cashbox) => c.poolName }] : []),
  ];

  return (
    <div className={pages.stack} style={{ maxWidth: 760 }}>
      {error && <Alert>{error}</Alert>}
      {pools.data && activePools.length === 0 && (
        <form onSubmit={addPool} noValidate>
          <Card title="Cree la piscina">
            <p className={pages.muted} style={{ marginTop: 0 }}>
              Aún no hay una piscina registrada. Créela una vez; las cajas la usarán automáticamente.
            </p>
            <div className={pages.formGrid} style={{ gridTemplateColumns: '160px 1fr' }}>
              <Field label="Código">
                <TextInput value={poolCode} onChange={(e) => setPoolCode(e.target.value)} maxLength={20} autoComplete="off" />
              </Field>
              <Field label="Nombre">
                <TextInput value={poolName} onChange={(e) => setPoolName(e.target.value)} maxLength={120} autoComplete="off" />
              </Field>
            </div>
            <div className={pages.actions}>
              <Button type="submit" variant="primary" disabled={!poolCode.trim() || !poolName.trim()}>
                Crear piscina
              </Button>
            </div>
          </Card>
        </form>
      )}

      {activePools.length > 0 && (
        <Card title="Cajas">
          {single && (
            <p className={`${pages.muted} ${styles.pool}`}>
              Piscina: <b>{single.name}</b>
            </p>
          )}
          {boxes.error && <Alert>{boxes.error.message}</Alert>}
          {boxes.data && <DataTable caption="Cajas" columns={columns} rows={boxes.data} rowKey={(c) => c.id} empty={<EmptyState>Sin cajas. Cree la primera.</EmptyState>} />}
          <form onSubmit={addBox} className={styles.inline}>
            <Field label="Código">
              <TextInput value={boxCode} onChange={(e) => setBoxCode(e.target.value)} maxLength={20} autoComplete="off" />
            </Field>
            <Field label="Nombre">
              <TextInput value={boxName} onChange={(e) => setBoxName(e.target.value)} maxLength={120} autoComplete="off" />
            </Field>
            {!single && (
              <Field label="Piscina">
                <Select value={boxPool} onChange={(e) => setBoxPool(e.target.value)}>
                  <option value="">Seleccione…</option>
                  {activePools.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button type="submit" disabled={!boxCode.trim() || !boxName.trim() || (!single && !boxPool)}>
              Agregar caja
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
