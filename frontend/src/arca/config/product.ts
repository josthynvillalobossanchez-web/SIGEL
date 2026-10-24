import type { GroupBy } from '../api/types';

/**
 * Agrupaciones disponibles en Reportes.
 *
 * Hay una sola piscina activa, así que agrupar por piscina no aporta y no se ofrece. Agrupar por turno sigue disponible
 * en el backend (`SHIFT`); para habilitarlo basta descomentar la línea. El formato de impresión, la impresión automática y
 * los datos municipales del recibo se configuran desde el panel de Configuración (no desde el código).
 */
export const reportGroupings: { key: GroupBy; label: string; title: string }[] = [
  { key: 'PERIOD', label: 'Por período', title: 'Ingresos por período' },
  { key: 'CONCEPT', label: 'Por concepto', title: 'Ingresos por concepto' },
  { key: 'CASHIER', label: 'Por cajero', title: 'Ingresos por cajero' },
  // { key: 'SHIFT', label: 'Por turno', title: 'Ingresos por turno' },
];
