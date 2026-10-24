/** Ventana de anulación: solo recibos PAGADO emitidos hace 48 horas o menos (el servidor valida también). */
export const VOID_WINDOW_MS = 48 * 3600 * 1000;

export interface VoidCandidate {
  status: 'PAGADO' | 'ANULADO';
  issuedAt: string | Date;
}

export function canVoid(receipt: VoidCandidate, now: Date): boolean {
  const issued = new Date(receipt.issuedAt).getTime();
  return receipt.status === 'PAGADO' && now.getTime() - issued <= VOID_WINDOW_MS;
}

/** "hace 30 min", "hace 5 h" */
export function elapsedLabel(issuedAt: string | Date, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(issuedAt).getTime()) / 60_000));
  return min < 60 ? `hace ${Math.max(min, 1)} min` : `hace ${Math.floor(min / 60)} h`;
}
