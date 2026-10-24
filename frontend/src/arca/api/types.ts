import type { Role } from '../lib/roles';

/** Tipos del contrato REST /api/v1 del backend (ver arca-bk/openapi.yaml). */

export type Shift = 'MANANA' | 'TARDE' | 'NOCHE';
export type ReceiptStatus = 'PAGADO' | 'ANULADO';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'SINPE_MOVIL' | 'TRANSFERENCIA';
export type VoidReason = 'ERROR_MONTO' | 'CLIENTE_EQUIVOCADO' | 'CONCEPTO_EQUIVOCADO' | 'PAGO_DUPLICADO' | 'OTRO';
export type ClientIdType = 'FISICA' | 'JURIDICA' | 'DIMEX';
export type ConceptType = 'ENTRADA' | 'SUSCRIPCION' | 'SERVICIO';
export type Periodicity = 'POR_USO' | 'MENSUAL';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface UserInfo {
  /** Cuentas del sistema: el id es un UUID. */
  id: string;
  username: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface Cashbox {
  id: number;
  code: string;
  name: string;
  poolId: number;
  poolName: string;
  active: boolean;
}

export interface PublicCashbox {
  id: number;
  code: string;
  name: string;
}

export interface Pool {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

export interface CashSession {
  id: number;
  cashboxId: number;
  cashboxCode: string;
  cashboxName: string;
  cashierId: string;
  cashierName: string;
  shift: Shift;
  openedAt: string;
  openingFloat: number;
  closedAt: string | null;
  closingNumber: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
  cashbox: Cashbox | null;
  session: CashSession | null;
}

export interface MeResponse {
  user: UserInfo;
  cashbox: Cashbox | null;
  session: CashSession | null;
}

export interface Client {
  id: number;
  idType: ClientIdType;
  idNumber: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
}

export interface ClientInput {
  idType: ClientIdType;
  idNumber: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Concept {
  id: number;
  code: string;
  name: string;
  type: ConceptType;
  periodicity: Periodicity;
  price: number;
  active: boolean;
}

export type ConceptInput = Omit<Concept, 'id'>;

export interface PersonRef {
  id: string;
  fullName: string;
  username: string;
}

export interface ReceiptLine {
  conceptId: number;
  conceptName: string;
  quantity: number;
  unitAmount: number;
  discount: number;
  surcharge: number;
  lineTotal: number;
}

export interface ReceiptPayment {
  method: PaymentMethod;
  amount: number;
}

export interface Receipt {
  id: number;
  number: string;
  issuedAt: string;
  status: ReceiptStatus;
  cashier: PersonRef;
  cashbox: { id: number; code: string; name: string };
  client: Client | null;
  poolId: number;
  shift: Shift;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  subtotal: number;
  discounts: number;
  surcharges: number;
  total: number;
  cashDue: number;
  cashReceived: number;
  change: number;
  voidInfo: { reason: VoidReason; detail: string; requestedBy: PersonRef; authorizedBy: PersonRef; voidedAt: string } | null;
  voidable: boolean;
  municipality: { legalId: string; phone: string; address: string };
}

export interface ReceiptSummary {
  id: number;
  number: string;
  issuedAt: string;
  cashierName: string;
  clientName: string | null;
  concept: string;
  total: number;
  status: ReceiptStatus;
  voidable: boolean;
  hoursElapsed: number;
}

export interface CreateReceiptInput {
  clientId?: number;
  lines: { conceptId: number; quantity: number; unitAmount: number; discount: number; surcharge: number }[];
  payments: { card: number; sinpe: number; transfer: number; cashReceived: number };
}

export interface VoidInput {
  reason: VoidReason;
  detail: string;
  supervisorUsername: string;
  supervisorPassword: string;
}

export interface ReceiptFilters {
  from?: string;
  to?: string;
  cashierId?: string;
  conceptId?: number;
  status?: ReceiptStatus;
  client?: string;
  page?: number;
  size?: number;
}

export interface CashSummary {
  sessionId: number;
  closed: boolean;
  closingNumber: string | null;
  openingFloat: number;
  cashCollected: number;
  cashVoided: number;
  cashSystem: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  justification: string | null;
  counts: { denomination: number; quantity: number }[];
}

export interface Dashboard {
  date: string;
  shift: Shift;
  totalCollected: number;
  receiptCount: number;
  byMethod: { method: PaymentMethod; amount: number }[];
  session: CashSession | null;
  latest: ReceiptSummary[];
}

export type GroupBy = 'PERIOD' | 'CONCEPT' | 'CASHIER' | 'POOL' | 'SHIFT';

export interface RevenueReport {
  from: string;
  to: string;
  groupBy: GroupBy;
  total: number;
  rows: { key: string; label: string; total: number; count: number }[];
}

export interface AppUser {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  cashboxId: number | null;
  cashboxName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
}

export interface UserLookup {
  id: string;
  fullName: string;
  role: Role;
}

export interface RoleInfo {
  role: Role;
  description: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  ip: string | null;
}

export type PrintFormat = 'TERMICO' | 'CARTA';

/** Configuración editable por el administrador (datos municipales del recibo e impresión). */
export interface Settings {
  municipalLegalId: string;
  municipalPhone: string;
  municipalAddress: string;
  printFormat: PrintFormat;
  autoPrint: boolean;
}
