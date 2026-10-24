/** Dinero en colones. Todo cálculo se hace en céntimos enteros para evitar errores de coma flotante. */

export const toCents = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100);
export const fromCents = (c: number): number => c / 100;

/** Formato es-CR: ₡1.234.567,89 (miles con punto, decimales con coma, menos tipográfico). */
export function formatColones(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const cents = toCents(n);
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '−' : ''}₡${int},${frac}`;
}

/** Número sin símbolo para campos de entrada: 10.000 o 10.000,50 (los decimales solo si existen). */
export function formatAmountInput(n: number): string {
  if (!n) return '';
  const cents = toCents(n);
  const int = Math.floor(Math.abs(cents) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = Math.abs(cents) % 100;
  return frac === 0 ? int : `${int},${String(frac).padStart(2, '0')}`;
}

/**
 * Lee un monto escrito en formato es-CR: "." separa miles y "," los decimales.
 * Ignora ₡ y espacios; un texto inválido o negativo vale 0.
 */
export function parseAmount(text: string): number {
  if (/[−-]/.test(text)) return 0; // los montos no pueden ser negativos
  const cleaned = text.replace(/[₡\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d*(\.\d*)?$/.test(cleaned) || cleaned === '' || cleaned === '.') return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? fromCents(toCents(n)) : 0;
}

/** Cantidad entera >= 0. */
export function parseQuantity(text: string): number {
  const n = Math.round(parseAmount(text));
  return n < 0 ? 0 : n;
}
