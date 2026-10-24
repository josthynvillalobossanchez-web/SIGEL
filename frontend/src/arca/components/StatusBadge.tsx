import type { ReceiptStatus } from '../api/types';
import { Icon } from './Icon';
import styles from './StatusBadge.module.css';

const LABEL: Record<ReceiptStatus, string> = { PAGADO: 'Pagado', ANULADO: 'Anulado' };

/** El estado nunca se comunica solo con color: icono + texto. Solo existen Pagado y Anulado (no hay pendientes). */
export function StatusBadge({ status }: { status: ReceiptStatus }) {
  return (
    <span className={`${styles.badge} ${status === 'PAGADO' ? styles.paid : styles.voided}`}>
      <Icon name={status === 'PAGADO' ? 'check' : 'ban'} size={14} />
      {LABEL[status]}
    </span>
  );
}
