import type { ReactNode } from 'react';
import styles from './Kbd.module.css';

/** Tecla de atajo (recuadro de radio 2). `inverse` para fondos oscuros. */
export function Kbd({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return <kbd className={`${styles.kbd} ${inverse ? styles.inverse : ''}`}>{children}</kbd>;
}
