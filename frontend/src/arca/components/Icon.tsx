import {
  ArrowLeftRight,
  Ban,
  Banknote,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  House,
  List,
  LogOut,
  type LucideProps,
  Plus,
  Printer,
  Receipt,
  Search,
  Shield,
  Smartphone,
  Tag,
  TriangleAlert,
  Users,
  Box,
  X,
  FileDown,
  Pencil,
  Settings,
} from 'lucide-react';
import type { ComponentType } from 'react';

const ICONS = {
  home: House,
  plus: Plus,
  receipt: Receipt,
  list: List,
  ban: Ban,
  users: Users,
  tag: Tag,
  box: Box,
  chart: BarChart3,
  shield: Shield,
  check: Check,
  clock: Clock,
  alert: TriangleAlert,
  printer: Printer,
  search: Search,
  x: X,
  logout: LogOut,
  left: ChevronLeft,
  right: ChevronRight,
  cash: Banknote,
  card: CreditCard,
  phone: Smartphone,
  transfer: ArrowLeftRight,
  download: FileDown,
  edit: Pencil,
  settings: Settings,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

/** Iconos lucide con trazo 1.75 (según el diseño). Decorativos por defecto: aria-hidden. */
export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<LucideProps, 'size'>) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" {...rest} />;
}
