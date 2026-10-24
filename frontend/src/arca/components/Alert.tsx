import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Alert.module.css';

interface AlertProps {
  children: ReactNode;
  tone?: 'error' | 'info';
  className?: string;
}

/**
 * Mensaje en región viva: los errores se anuncian (role="alert") y las confirmaciones se leen sin interrumpir
 * (role="status"). Renderícelo solo cuando exista el mensaje: no hay errores de ejemplo.
 */
export function Alert({ children, tone = 'error', className }: AlertProps) {
  return (
    <div
      className={`${styles.alert} ${tone === 'error' ? styles.error : styles.info} ${className ?? ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={16} className={styles.icon} />
      <span>{children}</span>
    </div>
  );
}
