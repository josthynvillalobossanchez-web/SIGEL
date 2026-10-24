import type { ReceiptStatus } from '../../generated/prisma/client.js';
import type { Role } from '../auth/arca-auth.js';
import { ApiError } from '../common/api-error.js';

/** Reglas puras de anulación: solo PAGADO, emitido hace 48 h o menos, autorizado por supervisor o administrador. */
export const VOID_WINDOW_MS = 48 * 3600 * 1000;

export function canVoid(status: ReceiptStatus, issuedAt: Date, now: Date): boolean {
  return status === 'PAGADO' && now.getTime() - issuedAt.getTime() <= VOID_WINDOW_MS;
}

export function assertVoidable(status: ReceiptStatus, issuedAt: Date, now: Date): void {
  if (status === 'ANULADO') {
    throw ApiError.unprocessable('ALREADY_VOIDED', 'El recibo ya está anulado.');
  }
  if (!canVoid(status, issuedAt, now)) {
    throw ApiError.unprocessable('VOID_WINDOW_EXPIRED', 'Fuera del plazo de 48 h. No se puede anular.');
  }
}

export function assertAuthorizer(role: Role | undefined): void {
  if (role !== 'SUPERVISOR' && role !== 'ADMINISTRADOR') {
    throw ApiError.forbidden('SUPERVISOR_REQUIRED', 'La anulación requiere autorización de un supervisor.');
  }
}
