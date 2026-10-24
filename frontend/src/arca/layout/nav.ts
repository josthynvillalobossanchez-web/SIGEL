import type { IconName } from '../components/Icon';
import type { Role } from '../lib/roles';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Atajo mostrado en el menú. */
  key?: string;
  end?: boolean;
  /** Roles que ven la opción; sin valor, todos. */
  roles?: Role[];
}

export const NAV: NavItem[] = [
  { to: '/cobro', label: 'Inicio', icon: 'home', key: 'F1', end: true },
  { to: '/cobro/recibos/nuevo', label: 'Nuevo recibo', icon: 'plus', key: 'F2' },
  { to: '/cobro/recibos', label: 'Recibos', icon: 'list', end: true },
  { to: '/cobro/anulaciones', label: 'Anulaciones', icon: 'ban' },
  { to: '/cobro/clientes', label: 'Clientes', icon: 'users' },
  { to: '/cobro/caja', label: 'Caja', icon: 'box' },
  { to: '/cobro/reportes', label: 'Reportes', icon: 'chart', roles: ['SUPERVISOR', 'ADMINISTRADOR'] },
  { to: '/cobro/configuracion', label: 'Configuración', icon: 'settings', roles: ['ADMINISTRADOR'] },
];

/** Rutas protegidas por rol (las mismas reglas que el menú). */
export const ROUTE_ROLES: Record<string, Role[] | undefined> = Object.fromEntries(NAV.map((n) => [n.to, n.roles]));

export function crumbFor(pathname: string): string {
  if (/^\/cobro\/recibos\/\d+/.test(pathname)) return 'Recibos / Vista del recibo';
  const hit = NAV.filter((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))).sort((a, b) => b.to.length - a.to.length)[0];
  return hit?.label ?? '';
}

/** "Recibo" (vista) resalta "Recibos" en el menú. */
export function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/cobro/recibos') return pathname === '/cobro/recibos' || /^\/cobro\/recibos\/\d+/.test(pathname);
  if (item.end) return pathname === item.to;
  return pathname.startsWith(item.to);
}
