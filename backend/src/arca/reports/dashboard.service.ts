import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/arca-auth.js';
import { CashboxService, shiftOf } from '../cashbox/cashbox.service.js';
import { Clock } from '../common/clock.js';
import { money, num, ZERO } from '../common/money.js';
import { localDate, startOfDay, startOfNextDay } from '../common/zones.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReceiptsService, summaryInclude } from '../receipts/receipts.service.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashboxes: CashboxService,
    private readonly receipts: ReceiptsService,
    private readonly clock: Clock,
  ) {}

  /** Un cajero ve solo sus cobros; supervisor y administrador ven todos los del día. */
  async today(user: AuthUser) {
    const now = this.clock.now();
    const date = localDate(now);
    const where = {
      issuedAt: { gte: startOfDay(date), lt: startOfNextDay(date) },
      ...(user.role === 'CAJERO' && { cashierId: user.id }),
    };
    const all = await this.prisma.receipt.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    });
    const paid = all.filter((r) => r.status === 'PAGADO');
    const total = paid.reduce((acc, r) => acc.plus(money(r.total)), ZERO);
    const methods = paid.length
      ? await this.prisma.receiptPayment.groupBy({
          by: ['method'],
          where: { receiptId: { in: paid.map((r) => r.id) } },
          _sum: { amount: true },
        })
      : [];
    const session = await this.cashboxes.currentFor(user.id);
    return {
      date,
      shift: session?.shift ?? shiftOf(now),
      totalCollected: num(total),
      receiptCount: all.length,
      byMethod: methods.map((m) => ({ method: m.method, amount: num(m._sum.amount) })),
      session,
      latest: all.slice(0, 5).map((r) => this.receipts.toSummary(r, now)),
    };
  }
}
