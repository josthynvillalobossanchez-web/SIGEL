import { formatColones } from '../common/money.js';
import { formatDateTime } from '../common/zones.js';
import type { ReceiptDto } from './receipts.service.js';

const LEGAL = 'Comprobante de pago municipal – No constituye factura electrónica';

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  SINPE_MOVIL: 'SINPE Móvil',
  TRANSFERENCIA: 'Transferencia',
};

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const row = (label: string, value: string) => `<tr><td>${label}</td><td class="n">${value}</td></tr>`;

/** HTML imprimible del recibo (tiquete 80 mm o carta), solo blanco y negro. */
export function renderReceiptHtml(r: ReceiptDto, letter: boolean): string {
  const width = letter ? 720 : 302;
  const lines = r.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.conceptName)}<br>${l.quantity} x ${formatColones(l.unitAmount)}</td><td class="n">${formatColones(l.lineTotal)}</td></tr>`,
    )
    .join('');
  const payments = r.payments.map((p) => row(METHOD_LABEL[p.method], formatColones(p.amount))).join('');
  return `<!doctype html><html lang="es-CR"><head><meta charset="utf-8"><title>Recibo ${esc(r.number)}</title><style>
body{margin:0;font-family:Inter,Arial,sans-serif;color:#000;background:#fff}
.r{position:relative;width:${width}px;padding:${letter ? '56px' : '16px 14px'};font-size:${letter ? '14px' : '12px'};line-height:1.4}
table{width:100%;border-collapse:collapse}td{padding:2px 0;text-align:left}.n{text-align:right}
hr{border:0;border-top:1px dashed #000}.legal{border:1px solid #000;padding:6px;font-weight:700;margin:8px 0}
.stamp{position:absolute;top:40%;left:15%;transform:rotate(-30deg);border:4px solid #000;padding:4px 16px;font-size:${letter ? '140px' : '48px'};font-weight:700;opacity:.3}
</style></head><body><div class="r">${r.status === 'ANULADO' ? '<div class="stamp">ANULADO</div>' : ''}
<strong>Municipalidad de Palmares</strong><br>${esc(r.municipality.legalId)}<br>${esc(r.municipality.address)}<br>${esc(r.municipality.phone)}<hr>
<strong>RECIBO DE PAGO</strong><br><strong>Nº ${esc(r.number)}</strong><br>
Fecha: ${formatDateTime(r.issuedAt)}<br>Cajero: ${esc(r.cashier.fullName)}<br>Caja: ${esc(r.cashbox.code)}<br>
Cliente: ${r.client ? `${esc(r.client.fullName)} (${esc(r.client.idNumber)})` : 'Sin identificar'}<hr>
<table>${lines}</table><hr>
<table>${row('Subtotal', formatColones(r.subtotal))}${row('Descuentos', formatColones(r.discounts))}${row('Recargos', formatColones(r.surcharges))}
<tr><td><strong>TOTAL</strong></td><td class="n"><strong>${formatColones(r.total)}</strong></td></tr></table><hr>
<table>${payments}${row('Vuelto', formatColones(r.change))}</table>
<div class="legal">${LEGAL}</div><div>Conserve este comprobante. Emitido con ARCA</div></div></body></html>`;
}
