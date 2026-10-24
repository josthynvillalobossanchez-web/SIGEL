import { useEffect, useId, useState, type RefObject } from 'react';
import { clientsApi } from '../../api/endpoints';
import { ApiProblem } from '../../api/http';
import type { Client, ClientIdType } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field, Select, TextInput } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { CLIENT_ID_TYPE_OPTION } from '../../lib/labels';
import { errorMessage } from '../../lib/useAsync';
import styles from './ClientSection.module.css';

interface Props {
  client: Client | null;
  anonymous: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onPick: (c: Client) => void;
  onAnonymous: () => void;
  onClear: () => void;
}

const ID_FORMAT_ERROR = 'Formato inválido: use 9 dígitos sin guiones.';

/** 1 · Cliente (opcional para entradas): búsqueda por cédula o nombre, registro nuevo o "Sin identificar". */
export function ClientSection({ client, anonymous, searchRef, onPick, onAnonymous, onClear }: Props) {
  const searchId = useId();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Búsqueda con retardo: evita una llamada por tecla.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = window.setTimeout(() => {
      clientsApi
        .search(term, 0, 8)
        .then((p) => {
          setResults(p.content);
          setSearchError(null);
        })
        .catch((e) => setSearchError(errorMessage(e)))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const chosen = client ?? (anonymous ? 'anon' : null);

  return (
    <Card title={<>1 · Cliente <span className={styles.optional}>(opcional para entradas)</span></>}>
      {!chosen && (
        <>
          <div className={styles.searchRow}>
            <div className={styles.grow}>
              <label htmlFor={searchId} className={styles.searchLabel}>
                Cédula (física, jurídica, DIMEX) o nombre
              </label>
              <div className={styles.searchBox}>
                <Icon name="search" size={18} className={styles.searchIcon} />
                <input
                  id={searchId}
                  ref={searchRef}
                  type="text"
                  className={styles.searchInput}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <Button icon={<Icon name="plus" size={16} />} onClick={() => setShowNew((v) => !v)} aria-expanded={showNew}>
              Registrar nuevo
            </Button>
            <Button onClick={onAnonymous}>Sin identificar</Button>
          </div>

          <div aria-live="polite">
            {searchError && <Alert className={styles.top8}>{searchError}</Alert>}
            {q.trim().length >= 2 && !searching && !searchError && results.length === 0 && (
              <p className={styles.noResults}>Sin resultados. Puede registrar un cliente nuevo.</p>
            )}
            {results.length > 0 && (
              <ul className={styles.results} aria-label="Resultados de la búsqueda de clientes">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className={styles.result} data-focus-inset onClick={() => { onPick(r); setQ(''); setResults([]); }}>
                      <b>{r.fullName}</b>
                      <span>{r.idNumber}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showNew && (
            <NewClientForm
              initialId={/^\d+$/.test(q.trim()) ? q.trim() : ''}
              onCancel={() => setShowNew(false)}
              onSaved={(c) => {
                onPick(c);
                setShowNew(false);
                setQ('');
              }}
            />
          )}
        </>
      )}

      {chosen && (
        <div className={styles.chosen}>
          <div>
            <div className={styles.chosenName}>{client ? client.fullName : 'Cliente sin identificar'}</div>
            <div className={styles.chosenMeta}>
              {client
                ? [client.idNumber, client.phone, client.email].filter(Boolean).join(' · ')
                : 'Sin identificación'}
            </div>
          </div>
          <Button variant="link" onClick={onClear}>
            Cambiar
          </Button>
        </div>
      )}
    </Card>
  );
}

function NewClientForm({ initialId, onCancel, onSaved }: { initialId: string; onCancel: () => void; onSaved: (c: Client) => void }) {
  const [idType, setIdType] = useState<ClientIdType>('FISICA');
  const [idNumber, setIdNumber] = useState(initialId);
  const [fullName, setFullName] = useState('');
  const [idError, setIdError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const id = idNumber.trim();
    const name = fullName.trim();
    const badId = !/^\d{9}$/.test(id);
    setIdError(badId ? ID_FORMAT_ERROR : null);
    setNameError(name ? null : 'Escriba el nombre completo.');
    setError(null);
    if (badId || !name) return;
    setBusy(true);
    try {
      onSaved(await clientsApi.create({ idType, idNumber: id, fullName: name }));
    } catch (e) {
      if (e instanceof ApiProblem && e.code === 'INVALID_ID_FORMAT') setIdError(ID_FORMAT_ERROR);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.newForm}>
      <h3 className={styles.newTitle}>Registrar cliente nuevo</h3>
      <div className={styles.newGrid}>
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
        <Field label="Nombre completo" error={nameError}>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      {error && <Alert className={styles.top8}>{error}</Alert>}
      <div className={styles.newActions}>
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y usar'}
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
