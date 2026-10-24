import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { nombreVisible, USUARIO_VISIBLE } from '../auth/arca-auth.js';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { ApiError } from '../common/api-error.js';
import { formatColones, money, num, ZERO } from '../common/money.js';
import { formatDate, isIsoDate, localDate, startOfDay, startOfNextDay } from '../common/zones.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type GroupBy = 'PERIOD' | 'CONCEPT' | 'CASHIER' | 'POOL' | 'SHIFT';
export type Granularity = 'DAY' | 'WEEK' | 'MONTH';

export const GROUPS: GroupBy[] = ['PERIOD', 'CONCEPT', 'CASHIER', 'POOL', 'SHIFT'];
export const GRANULARITIES: Granularity[] = ['DAY', 'WEEK', 'MONTH'];

export interface RevenueRow {
  key: string;
  label: string;
  total: number;
  count: number;
}

export interface RevenueReport {
  from: string;
  to: string;
  groupBy: GroupBy;
  total: number;
  rows: RevenueRow[];
}

const SHIFT_LABEL: Record<string, string> = { MANANA: 'Mañana', TARDE: 'Tarde', NOCHE: 'Noche' };

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async revenue(from: string, to: string, groupBy: GroupBy, granularity: Granularity): Promise<RevenueReport> {
    if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
      throw ApiError.badRequest('INVALID_RANGE', 'Indique un rango de fechas válido.');
    }
    const range = { issuedAt: { gte: startOfDay(from), lt: startOfNextDay(to) }, status: 'PAGADO' as const };
    let rows: RevenueRow[];
    switch (groupBy) {
      case 'PERIOD':
        rows = await this.byPeriod(range, granularity);
        break;
      case 'CONCEPT': {
        const g = await this.prisma.receiptLine.groupBy({
          by: ['conceptId'],
          where: { receipt: range },
          _sum: { lineTotal: true },
          _count: { _all: true },
        });
        const names = new Map((await this.prisma.concept.findMany({ where: { id: { in: g.map((x) => x.conceptId) } } })).map((c) => [c.id, c.name]));
        rows = g.map((x) => row(names.get(x.conceptId) ?? String(x.conceptId), x._sum.lineTotal, x._count._all));
        break;
      }
      case 'CASHIER': {
        const g = await this.prisma.receipt.groupBy({ by: ['cashierId'], where: range, _sum: { total: true }, _count: { _all: true } });
        const names = new Map(
          (await this.prisma.usuario.findMany({ where: { id: { in: g.map((x) => x.cashierId) } }, ...USUARIO_VISIBLE })).map((u) => [u.id, nombreVisible(u)]),
        );
        rows = g.map((x) => row(names.get(x.cashierId) ?? String(x.cashierId), x._sum.total, x._count._all));
        break;
      }
      case 'POOL': {
        const g = await this.prisma.receipt.groupBy({ by: ['poolId'], where: range, _sum: { total: true }, _count: { _all: true } });
        const names = new Map((await this.prisma.pool.findMany({ where: { id: { in: g.map((x) => x.poolId) } } })).map((p) => [p.id, p.name]));
        rows = g.map((x) => row(names.get(x.poolId) ?? String(x.poolId), x._sum.total, x._count._all));
        break;
      }
      case 'SHIFT': {
        const g = await this.prisma.receipt.groupBy({ by: ['shift'], where: range, _sum: { total: true }, _count: { _all: true } });
        rows = g.map((x) => row(SHIFT_LABEL[x.shift], x._sum.total, x._count._all));
        break;
      }
    }
    if (groupBy !== 'PERIOD') rows.sort((a, b) => b.total - a.total);
    const total = rows.reduce<Decimal>((acc, r) => acc.plus(money(r.total)), ZERO);
    return { from, to, groupBy, total: num(total), rows };
  }

  /** Agrupa por día local en memoria: Costa Rica es UTC−6, así que no se delega la zona horaria a SQL. */
  private async byPeriod(range: { issuedAt: { gte: Date; lt: Date }; status: 'PAGADO' }, g: Granularity): Promise<RevenueRow[]> {
    const receipts = await this.prisma.receipt.findMany({ where: range, select: { issuedAt: true, total: true } });
    const buckets = new Map<string, { total: Decimal; count: number }>();
    for (const r of receipts) {
      const key = bucketKey(localDate(r.issuedAt), g);
      const b = buckets.get(key) ?? { total: ZERO, count: 0 };
      b.total = b.total.plus(money(r.total));
      b.count += 1;
      buckets.set(key, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, b]) => ({ key, label: bucketLabel(key, g), total: num(b.total), count: b.count }));
  }

  async export(format: string, from: string, to: string, groupBy: GroupBy, granularity: Granularity, ctx: AuditContext) {
    const report = await this.revenue(from, to, groupBy, granularity);
    await this.audit.log(ctx, 'REPORT_EXPORTED', 'Report', groupBy, `${format} ${from} - ${to}`);
    return format === 'xlsx' ? this.xlsx(report) : this.pdf(report);
  }

  private async xlsx(r: RevenueReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ingresos');
    ws.columns = [
      { header: 'Grupo', key: 'label', width: 40 },
      { header: 'Recibos', key: 'count', width: 12 },
      { header: 'Total (CRC)', key: 'total', width: 18, style: { numFmt: '#,##0.00' } },
    ];
    ws.getRow(1).font = { bold: true };
    r.rows.forEach((x) => ws.addRow(x));
    ws.addRow({ label: 'TOTAL', total: r.total }).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private pdf(r: RevenueReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.font('Helvetica-Bold').fontSize(16).text('ARCA · Reporte de ingresos');
      doc.font('Helvetica').fontSize(10).text(`Del ${formatDate(r.from)} al ${formatDate(r.to)} · por ${r.groupBy}`).moveDown();
      const line = (a: string, b: string, c: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        const y = doc.y;
        doc.text(a, 48, y, { width: 280 });
        doc.text(b, 328, y, { width: 60, align: 'right' });
        doc.text(c, 388, y, { width: 160, align: 'right' });
      };
      line('Grupo', 'Recibos', 'Total', true);
      r.rows.forEach((x) => line(x.label, String(x.count), formatColones(x.total)));
      line('TOTAL', '', formatColones(r.total), true);
      doc.end();
    });
  }
}

function row(label: string, total: unknown, count: number): RevenueRow {
  return { key: label, label, total: num(total as never), count };
}

function bucketKey(day: string, g: Granularity): string {
  if (g === 'DAY') return day;
  if (g === 'MONTH') return `${day.slice(0, 7)}-01`;
  // Semana: lunes anterior o igual
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400_000).toISOString().slice(0, 10);
}

function bucketLabel(key: string, g: Granularity): string {
  if (g === 'DAY') return formatDate(key);
  if (g === 'WEEK') return `Semana del ${formatDate(key)}`;
  return `${key.slice(5, 7)}/${key.slice(0, 4)}`;
}
