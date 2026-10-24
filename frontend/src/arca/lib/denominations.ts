/** Denominaciones del arqueo. value 0 = "Cheques / otros": se registra pero no suma al efectivo contado. */
export interface Denomination {
  value: number;
  label: string;
}

export const DENOMINATIONS: Denomination[] = [
  { value: 20000, label: '₡20.000' },
  { value: 10000, label: '₡10.000' },
  { value: 5000, label: '₡5.000' },
  { value: 2000, label: '₡2.000' },
  { value: 1000, label: '₡1.000' },
  { value: 500, label: '₡500' },
  { value: 100, label: '₡100' },
  { value: 50, label: '₡50' },
  { value: 25, label: '₡25' },
  { value: 10, label: '₡10' },
  { value: 5, label: '₡5' },
  { value: 0, label: 'Cheques / otros' },
];

export type Counts = Record<number, number>;

export function countedTotal(counts: Counts): number {
  return DENOMINATIONS.reduce((sum, d) => sum + d.value * (counts[d.value] ?? 0), 0);
}
