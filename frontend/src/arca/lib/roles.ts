export type Role = 'CAJERO' | 'SUPERVISOR' | 'ADMINISTRADOR';

export const ROLE_LABEL: Record<Role, string> = {
  CAJERO: 'Cajero',
  SUPERVISOR: 'Supervisor',
  ADMINISTRADOR: 'Administrador',
};

export const ALL_ROLES: Role[] = ['CAJERO', 'SUPERVISOR', 'ADMINISTRADOR'];

export const canAuthorizeVoid = (role: Role) => role === 'SUPERVISOR' || role === 'ADMINISTRADOR';
