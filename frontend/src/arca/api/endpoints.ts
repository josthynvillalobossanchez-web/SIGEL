import { download, request } from './http';
import type {
  AuditEntry,
  CashSession,
  CashSummary,
  Cashbox,
  Client,
  ClientInput,
  Concept,
  ConceptInput,
  CreateReceiptInput,
  Dashboard,
  GroupBy,
  MeResponse,
  Page,
  Pool,
  Receipt,
  ReceiptFilters,
  ReceiptSummary,
  RevenueReport,
  Settings,
  UserLookup,
  VoidInput,
} from './types';

/** Capa de acceso al backend: una función por endpoint del contrato /api/v1. */

export const authApi = {
  /** Quien soy en ARCA: cuenta del sistema, rol de cobro, caja y sesion de caja abierta. */
  me: () => request<MeResponse>('/auth/me'),
};

export const cashApi = {
  pools: () => request<Pool[]>('/pools'),
  createPool: (body: { code: string; name: string }) => request<Pool>('/pools', { method: 'POST', body }),
  cashboxes: () => request<Cashbox[]>('/cashboxes'),
  createCashbox: (body: { code: string; name: string; poolId?: number }) => request<Cashbox>('/cashboxes', { method: 'POST', body }),
  current: () => request<CashSession | undefined>('/cashbox-sessions/current'),
  open: (body: { cashboxId: number; openingFloat: number }) => request<CashSession>('/cashbox-sessions', { method: 'POST', body }),
  summary: (id: number) => request<CashSummary>(`/cashbox-sessions/${id}/summary`),
  close: (id: number, body: { counts: { denomination: number; quantity: number }[]; justification?: string }) =>
    request<CashSummary>(`/cashbox-sessions/${id}/close`, { method: 'POST', body }),
  reportBlob: (id: number) => request<Blob>(`/cashbox-sessions/${id}/report`, { as: 'blob' }),
};

export const conceptsApi = {
  list: (active?: boolean) => request<Concept[]>('/concepts', { query: { active } }),
  create: (body: ConceptInput) => request<Concept>('/concepts', { method: 'POST', body }),
  update: (id: number, body: ConceptInput) => request<Concept>(`/concepts/${id}`, { method: 'PUT', body }),
};

export const clientsApi = {
  search: (q: string, page = 0, size = 20) => request<Page<Client>>('/clients', { query: { q, page, size } }),
  create: (body: ClientInput) => request<Client>('/clients', { method: 'POST', body }),
  update: (id: number, body: ClientInput) => request<Client>(`/clients/${id}`, { method: 'PUT', body }),
  get: (id: number) => request<Client>(`/clients/${id}`),
  receipts: (id: number, page = 0, size = 10) => request<Page<ReceiptSummary>>(`/clients/${id}/receipts`, { query: { page, size } }),
};

export const receiptsApi = {
  create: (body: CreateReceiptInput) => request<Receipt>('/receipts', { method: 'POST', body }),
  list: (f: ReceiptFilters) => request<Page<ReceiptSummary>>('/receipts', { query: { ...f } }),
  get: (id: number) => request<Receipt>(`/receipts/${id}`),
  voidable: (includeExpired = true) => request<ReceiptSummary[]>('/receipts/voidable', { query: { includeExpired } }),
  void: (id: number, body: VoidInput) => request<Receipt>(`/receipts/${id}/void`, { method: 'POST', body }),
  /** Registra la reimpresión en la bitácora (el HTML devuelto no se usa: la vista imprime con CSS). */
  logPrint: (id: number, format: 'THERMAL' | 'LETTER') =>
    request<string>(`/receipts/${id}/print`, { query: { format }, as: 'text' }),
};

export const dashboardApi = {
  today: () => request<Dashboard>('/dashboard/today'),
};

export const reportsApi = {
  revenue: (q: { from: string; to: string; groupBy: GroupBy }) => request<RevenueReport>('/reports/revenue', { query: { ...q } }),
  export: (format: 'pdf' | 'xlsx', q: { from: string; to: string; groupBy: GroupBy }) =>
    download('/reports/revenue/export', { format, ...q }, `ingresos.${format}`),
};

export const usersApi = {
  /** Cuentas con acceso al cobro, para los filtros. Las cuentas y roles se administran en el sistema. */
  lookup: () => request<UserLookup[]>('/users/lookup'),
};

export const auditApi = {
  list: (q: { page?: number; size?: number; action?: string; user?: string; from?: string; to?: string }) =>
    request<Page<AuditEntry>>('/audit-logs', { query: { ...q } }),
};

export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (body: Settings) => request<Settings>('/settings', { method: 'PUT', body }),
};
