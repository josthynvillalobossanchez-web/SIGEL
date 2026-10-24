import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/** Estado vacío real (caja punteada): se muestra cuando no hay datos, nunca filas de relleno. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}
