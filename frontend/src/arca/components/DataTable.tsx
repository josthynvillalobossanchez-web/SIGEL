import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right';
  width?: number | string;
  /** Encabezado solo para lectores de pantalla (columnas de acciones). */
  srOnlyHeader?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Descripción accesible de la tabla. */
  caption: string;
  empty?: ReactNode;
  selectedKey?: string | number | null;
  onRowClick?: (row: T) => void;
  /** Descripción de la fila clicable para lectores de pantalla. */
  rowLabel?: (row: T) => string;
}

/** Tabla con zebra (#fff / #F0F0F1). Las filas clicables son enfocables y se activan con Enter o Espacio. */
export function DataTable<T>({ columns, rows, rowKey, caption, empty, selectedKey, onRowClick, rowLabel }: Props<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ width: c.width, textAlign: c.align ?? 'left' }}>
                {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = rowKey(row);
            const clickable = !!onRowClick;
            return (
              <tr
                key={key}
                className={`${clickable ? styles.clickable : ''} ${selectedKey === key ? styles.selected : ''}`}
                tabIndex={clickable ? 0 : undefined}
                aria-selected={clickable ? selectedKey === key : undefined}
                aria-label={clickable ? rowLabel?.(row) : undefined}
                data-focus-inset
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
