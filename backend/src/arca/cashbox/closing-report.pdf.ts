import { Prisma } from '../../generated/prisma/client.js';
import PDFDocument from 'pdfkit';
import { nombreVisible, USUARIO_VISIBLE } from '../auth/arca-auth.js';
import { formatColones } from '../common/money.js';
import { formatDateTime } from '../common/zones.js';

type Session = Prisma.CashboxSessionGetPayload<{ include: { cashbox: true; cashier: typeof USUARIO_VISIBLE } }>;

interface Summary {
  closingNumber: string | null;
  openingFloat: number;
  cashSystem: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  justification: string | null;
  counts: { denomination: number; quantity: number }[];
}

/** Reporte de cierre de caja: blanco y negro, listo para imprimir. */
export function renderClosingReport(s: Session, sum: Summary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text('ARCA · Reporte de cierre de caja');
    doc.font('Helvetica').fontSize(10).text('Municipalidad de Palmares, Alajuela').moveDown();
    doc.font('Helvetica-Bold').text(`Cierre Nº ${sum.closingNumber ?? ''}`);
    doc.font('Helvetica')
      .text(`Caja: ${s.cashbox.code} – ${s.cashbox.name}`)
      .text(`Cajero: ${nombreVisible(s.cashier)}`)
      .text(`Apertura: ${formatDateTime(s.openedAt)}   Cierre: ${s.closedAt ? formatDateTime(s.closedAt) : ''}`)
      .moveDown();

    const row = (label: string, value: number | null, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      const y = doc.y;
      doc.text(label, 48, y, { width: 340 });
      doc.text(value === null ? '—' : formatColones(value), 388, y, { width: 160, align: 'right' });
    };
    row('Fondo inicial', sum.openingFloat);
    row('Cobros en efectivo del sistema (neto de anulados)', sum.cashSystem);
    row('Esperado en caja', sum.expectedCash, true);
    row('Contado en arqueo', sum.countedCash, true);
    row('Diferencia', sum.difference, true);
    if (sum.justification) {
      doc.moveDown().font('Helvetica').text(`Justificación: ${sum.justification}`, 48);
    }

    doc.moveDown().font('Helvetica-Bold').text('Arqueo por denominación', 48);
    doc.font('Helvetica');
    for (const c of sum.counts) {
      const y = doc.y;
      doc.text(c.denomination === 0 ? 'Cheques / otros' : `₡${c.denomination}`, 48, y, { width: 200 });
      doc.text(String(c.quantity), 248, y, { width: 80, align: 'right' });
      doc.text(formatColones(c.denomination * c.quantity), 388, y, { width: 160, align: 'right' });
    }
    doc.moveDown(3).text('Firma del cajero: ______________________     Firma del supervisor: ______________________', 48);
    doc.end();
  });
}
