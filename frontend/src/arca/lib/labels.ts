import type { ClientIdType, ConceptType, Periodicity, PaymentMethod, Shift, VoidReason } from '../api/types';

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  SINPE_MOVIL: 'SINPE Móvil',
  TRANSFERENCIA: 'Transferencia',
};

export const VOID_REASON_LABEL: Record<VoidReason, string> = {
  ERROR_MONTO: 'Error en el monto',
  CLIENTE_EQUIVOCADO: 'Cliente equivocado',
  CONCEPTO_EQUIVOCADO: 'Concepto equivocado',
  PAGO_DUPLICADO: 'Pago duplicado',
  OTRO: 'Otro',
};

export const CLIENT_ID_TYPE_LABEL: Record<ClientIdType, string> = {
  FISICA: 'Física',
  JURIDICA: 'Jurídica',
  DIMEX: 'DIMEX',
};

export const CLIENT_ID_TYPE_OPTION: Record<ClientIdType, string> = {
  FISICA: 'Cédula física',
  JURIDICA: 'Cédula jurídica',
  DIMEX: 'DIMEX',
};

export const CONCEPT_TYPE_LABEL: Record<ConceptType, string> = {
  ENTRADA: 'Entrada',
  SUSCRIPCION: 'Suscripción',
  SERVICIO: 'Servicio',
};

export const PERIODICITY_LABEL: Record<Periodicity, string> = {
  POR_USO: 'Por uso',
  MENSUAL: 'Mensual',
};

export const SHIFT_LABEL: Record<Shift, string> = {
  MANANA: 'Mañana',
  TARDE: 'Tarde',
  NOCHE: 'Noche',
};

/** Acciones de la bitácora (el backend envía el código). */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOGIN_OK: 'Inició sesión',
  LOGIN_FAILED: 'Intento de ingreso fallido',
  RECEIPT_CREATED: 'Emitió recibo',
  RECEIPT_VOIDED: 'Autorizó anulación',
  RECEIPT_REPRINTED: 'Reimprimió recibo',
  VOID_AUTH_FAILED: 'Autorización de anulación fallida',
  CASHBOX_OPENED: 'Abrió caja',
  CASHBOX_CLOSED: 'Cerró caja',
  CASHBOX_CREATED: 'Creó caja',
  CASHBOX_UPDATED: 'Editó caja',
  POOL_CREATED: 'Creó piscina',
  CONCEPT_CREATED: 'Creó concepto',
  CONCEPT_UPDATED: 'Editó concepto',
  CONCEPT_PRICE_CHANGED: 'Editó tarifa',
  CLIENT_CREATED: 'Registró cliente',
  CLIENT_UPDATED: 'Editó cliente',
  USER_CREATED: 'Creó usuario',
  USER_UPDATED: 'Editó usuario',
  ROLE_CHANGED: 'Cambió rol',
  PASSWORD_RESET: 'Restableció contraseña',
  PASSWORD_CHANGED: 'Cambió su contraseña',
  REPORT_EXPORTED: 'Exportó reporte',
};

export const auditActionLabel = (code: string) => AUDIT_ACTION_LABEL[code] ?? code;
