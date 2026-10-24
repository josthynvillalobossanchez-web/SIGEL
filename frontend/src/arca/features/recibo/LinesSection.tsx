import type { RefObject } from 'react';
import type { Concept } from '../../api/types';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { MoneyInput } from '../../components/MoneyInput';
import { lineAmount, type DraftLine } from '../../lib/calc';
import { formatColones } from '../../lib/money';
import type { DraftAction } from './draft';
import styles from './LinesSection.module.css';

interface Props {
  lines: DraftLine[];
  catalog: Concept[];
  catalogError: string | null;
  selectRef: RefObject<HTMLSelectElement | null>;
  dispatch: (a: DraftAction) => void;
}

/** 2 · Conceptos a cobrar. Cada línea nace con la tarifa del catálogo; monto, descuento y mora son editables. */
export function LinesSection({ lines, catalog, catalogError, selectRef, dispatch }: Props) {
  return (
    <Card
      title="2 · Conceptos a cobrar"
      aside={
        <div className={styles.add}>
          <label htmlFor="cat" className={styles.addLabel}>
            Agregar del catálogo
          </label>
          <select
            id="cat"
            ref={selectRef}
            className={styles.select}
            value=""
            onChange={(e) => {
              const c = catalog.find((x) => x.id === Number(e.target.value));
              if (c) dispatch({ type: 'addConcept', concept: c });
            }}
          >
            <option value="">Seleccionar concepto…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {catalogError && (
        <p role="alert" className={styles.catalogError}>
          {catalogError}
        </p>
      )}
      {lines.length === 0 ? (
        <EmptyState>
          {catalog.length === 0 && !catalogError
            ? 'El catálogo no tiene conceptos activos. Un administrador debe cargarlos en Catálogo.'
            : 'Sin conceptos. Agregue uno del catálogo (F4).'}
        </EmptyState>
      ) : (
        <table className={styles.table}>
          <caption className="sr-only">Conceptos del recibo</caption>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col" style={{ width: 72 }}>Cant.</th>
              <th scope="col" style={{ width: 128 }} className={styles.right}>Monto ₡</th>
              <th scope="col" style={{ width: 112 }} className={styles.right}>Descuento ₡</th>
              <th scope="col" style={{ width: 112 }} className={styles.right}>Mora ₡</th>
              <th scope="col" style={{ width: 128 }} className={styles.right}>Importe</th>
              <th scope="col" style={{ width: 44 }}>
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className={styles.name}>{l.name}</td>
                <td>
                  <MoneyInput integer value={l.qty} onValueChange={(v) => dispatch({ type: 'line', index: i, patch: { qty: v } })} aria-label={`Cantidad de ${l.name}`} />
                </td>
                <td>
                  <MoneyInput value={l.monto} onValueChange={(v) => dispatch({ type: 'line', index: i, patch: { monto: v } })} aria-label={`Monto de ${l.name}`} />
                </td>
                <td>
                  <MoneyInput value={l.desc} onValueChange={(v) => dispatch({ type: 'line', index: i, patch: { desc: v } })} aria-label={`Descuento de ${l.name}`} />
                </td>
                <td>
                  <MoneyInput value={l.rec} onValueChange={(v) => dispatch({ type: 'line', index: i, patch: { rec: v } })} aria-label={`Interés o recargo por mora de ${l.name}`} />
                </td>
                <td className={`${styles.right} ${styles.amount}`}>{formatColones(lineAmount(l))}</td>
                <td>
                  <button type="button" className={styles.remove} data-focus-inset aria-label={`Quitar ${l.name}`} title="Quitar" onClick={() => dispatch({ type: 'removeLine', index: i })}>
                    <Icon name="x" size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
