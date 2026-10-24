import { Injectable } from '@nestjs/common';
import { Prisma, Shift } from '../../generated/prisma/client.js';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { type AuthUser, nombreVisible, USUARIO_VISIBLE } from '../auth/arca-auth.js';
import { ApiError } from '../common/api-error.js';
import { Clock } from '../common/clock.js';
import { dec, money, num, ZERO } from '../common/money.js';
import { localHour } from '../common/zones.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Tx } from '../common/tx.js';
import { renderClosingReport } from './closing-report.pdf.js';
import { CashboxDto, CloseSessionDto, OpenSessionDto, PoolDto } from './cashbox.dto.js';

/** Denominaciones válidas del arqueo; 0 = "Cheques / otros" (se registra pero no suma al efectivo). */
export const DENOMINATIONS = new Set([20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 0]);

export function shiftOf(instant: Date): Shift {
  const h = localHour(instant);
  return h < 12 ? 'MANANA' : h < 18 ? 'TARDE' : 'NOCHE';
}

const sessionInclude = { cashbox: true, cashier: USUARIO_VISIBLE } satisfies Prisma.CashboxSessionInclude;
type SessionRow = Prisma.CashboxSessionGetPayload<{ include: typeof sessionInclude }>;

@Injectable()
export class CashboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  // --- piscinas y cajas ----------------------------------------------------------------------------------------

  async listPools() {
    const pools = await this.prisma.pool.findMany({ orderBy: { code: 'asc' } });
    return pools.map((p) => ({ id: p.id, code: p.code, name: p.name, active: p.active }));
  }

  async createPool(dto: PoolDto, ctx: AuditContext) {
    const code = dto.code.trim();
    if (await this.prisma.pool.findUnique({ where: { code } })) {
      throw ApiError.conflict('DUPLICATE_CODE', 'Ya existe una piscina con ese código.');
    }
    const p = await this.prisma.pool.create({ data: { code, name: dto.name.trim() } });
    await this.audit.log(ctx, 'POOL_CREATED', 'Pool', p.id, p.code);
    return { id: p.id, code: p.code, name: p.name, active: p.active };
  }

  async listCashboxes() {
    const rows = await this.prisma.cashbox.findMany({ where: { active: true }, include: { pool: true }, orderBy: { code: 'asc' } });
    return rows.map(toCashboxDto);
  }

  /** Cajas activas para la pantalla de login (sin autenticación): solo código y nombre. */
  async listPublicCashboxes() {
    const rows = await this.prisma.cashbox.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
    return rows.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  }

  async cashboxDto(id: number) {
    const c = await this.prisma.cashbox.findUnique({ where: { id }, include: { pool: true } });
    return c ? toCashboxDto(c) : null;
  }

  async createCashbox(dto: CashboxDto, ctx: AuditContext) {
    const code = dto.code.trim();
    if (await this.prisma.cashbox.findUnique({ where: { code } })) {
      throw ApiError.conflict('DUPLICATE_CODE', 'Ya existe una caja con ese código.');
    }
    const poolId = await this.resolvePool(dto.poolId);
    const c = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cashbox.create({
        data: { code, name: dto.name.trim(), poolId },
        include: { pool: true },
      });
      await tx.receiptSequence.create({ data: { cashboxId: created.id } }); // numeración consecutiva por caja
      return created;
    });
    await this.audit.log(ctx, 'CASHBOX_CREATED', 'Cashbox', c.id, c.code);
    return toCashboxDto(c);
  }

  async updateCashbox(id: number, dto: CashboxDto, ctx: AuditContext) {
    const poolId = await this.resolvePool(dto.poolId);
    const exists = await this.prisma.cashbox.findUnique({ where: { id } });
    if (!exists) throw ApiError.notFound('Caja no encontrada.');
    const c = await this.prisma.cashbox.update({
      where: { id },
      data: { name: dto.name.trim(), poolId, ...(dto.active !== undefined && { active: dto.active }) },
      include: { pool: true },
    });
    await this.audit.log(ctx, 'CASHBOX_UPDATED', 'Cashbox', c.id, c.code);
    return toCashboxDto(c);
  }

  /** Con una sola piscina activa no hace falta elegirla: la caja usa esa. */
  private async resolvePool(id?: number): Promise<number> {
    if (id !== undefined) {
      if (!(await this.prisma.pool.findUnique({ where: { id } }))) throw ApiError.notFound('Piscina no encontrada.');
      return id;
    }
    const active = await this.prisma.pool.findMany({ where: { active: true }, take: 2 });
    if (active.length === 1) return active[0].id;
    throw ApiError.unprocessable(
      'POOL_REQUIRED',
      active.length === 0 ? 'Cree primero una piscina.' : 'Hay varias piscinas activas: indique cuál.',
    );
  }

  // --- sesiones ------------------------------------------------------------------------------------------------

  async currentFor(userId: string) {
    const s = await this.prisma.cashboxSession.findFirst({ where: { cashierId: userId, closedAt: null }, include: sessionInclude });
    return s ? toSessionDto(s) : null;
  }

  async open(dto: OpenSessionDto, user: AuthUser, ctx: AuditContext) {
    const session = await this.prisma
      .$transaction(async (tx) => {
        // Serializa aperturas concurrentes sobre la misma caja; el UNIQUE(open_key) es la red de seguridad.
        await tx.$queryRaw`SELECT id FROM cashbox WHERE id = ${dto.cashboxId} FOR UPDATE`;
        const cashbox = await tx.cashbox.findUnique({ where: { id: dto.cashboxId } });
        if (!cashbox) throw ApiError.notFound('Caja no encontrada.');
        if (!cashbox.active) throw ApiError.unprocessable('CASHBOX_INACTIVE', 'La caja está inactiva.');
        if (await tx.cashboxSession.findFirst({ where: { cashboxId: cashbox.id, closedAt: null } })) {
          throw ApiError.conflict('CASHBOX_ALREADY_OPEN', 'La caja ya tiene una sesión abierta.');
        }
        if (await tx.cashboxSession.findFirst({ where: { cashierId: user.id, closedAt: null } })) {
          throw ApiError.conflict('SESSION_ALREADY_OPEN', 'Ya tiene una caja abierta. Ciérrela antes de abrir otra.');
        }
        const now = this.clock.now();
        return tx.cashboxSession.create({
          data: {
            cashboxId: cashbox.id,
            cashierId: user.id,
            openedAt: now,
            shift: shiftOf(now),
            openingFloat: dec(dto.openingFloat),
          },
          include: sessionInclude,
        });
      })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw ApiError.conflict('CASHBOX_ALREADY_OPEN', 'La caja ya tiene una sesión abierta.');
        }
        throw e;
      });
    await this.audit.log(ctx, 'CASHBOX_OPENED', 'CashboxSession', session.id, `${session.cashbox.code} · fondo ${dec(session.openingFloat)}`);
    return toSessionDto(session);
  }

  async close(id: number, dto: CloseSessionDto, user: AuthUser, ctx: AuditContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Mismo bloqueo que usa el cobro: ningún recibo puede colarse entre el cálculo y el cierre.
      await tx.$queryRaw`SELECT id FROM cashbox_session WHERE id = ${id} FOR UPDATE`;
      const s = await tx.cashboxSession.findUnique({ where: { id }, include: sessionInclude });
      if (!s) throw ApiError.notFound('Sesión de caja no encontrada.');
      assertCanAccess(s, user);
      if (s.closedAt) throw ApiError.conflict('SESSION_CLOSED', 'La caja ya está cerrada.');

      let counted = 0;
      const seen = new Set<number>();
      for (const l of dto.counts) {
        if (!DENOMINATIONS.has(l.denomination) || seen.has(l.denomination)) {
          throw ApiError.badRequest('INVALID_DENOMINATION', `Denominación inválida: ${l.denomination}`);
        }
        seen.add(l.denomination);
        counted += l.denomination * l.quantity;
      }
      const cashSystem = await this.cashSum(tx, id, 'PAGADO');
      const expected = money(s.openingFloat).plus(cashSystem);
      const countedCash = money(counted);
      const difference = countedCash.minus(expected);
      const justification = dto.justification?.trim() || null;
      if (!difference.isZero() && !justification) {
        throw ApiError.unprocessable('JUSTIFICATION_REQUIRED', 'Registre una justificación antes de cerrar: hay una diferencia de caja.')
          .with('difference', num(difference));
      }
      const closingNumber = `C-${s.cashbox.code}-${String(s.id).padStart(6, '0')}`;
      await tx.cashCount.createMany({
        data: dto.counts.map((l) => ({ sessionId: id, denomination: l.denomination, quantity: l.quantity })),
      });
      await tx.cashboxSession.update({
        where: { id },
        data: {
          closedAt: this.clock.now(),
          countedCash: dec(countedCash),
          expectedCash: dec(expected),
          difference: dec(difference),
          justification,
          closingNumber,
        },
      });
      await this.audit.log(ctx, 'CASHBOX_CLOSED', 'CashboxSession', id, `${closingNumber} · diferencia ${dec(difference)}`, tx);
      return id;
    });
    return this.summary(result, user);
  }

  async summary(id: number, user: AuthUser) {
    const s = await this.prisma.cashboxSession.findUnique({ where: { id }, include: sessionInclude });
    if (!s) throw ApiError.notFound('Sesión de caja no encontrada.');
    assertCanAccess(s, user);
    return this.summarize(s);
  }

  async recent() {
    const rows = await this.prisma.cashboxSession.findMany({ include: sessionInclude, orderBy: { openedAt: 'desc' }, take: 50 });
    return rows.map(toSessionDto);
  }

  async closingReport(id: number, user: AuthUser): Promise<Buffer> {
    const s = await this.prisma.cashboxSession.findUnique({ where: { id }, include: sessionInclude });
    if (!s) throw ApiError.notFound('Sesión de caja no encontrada.');
    assertCanAccess(s, user);
    if (!s.closedAt) throw ApiError.unprocessable('SESSION_OPEN', 'La caja aún no está cerrada.');
    return renderClosingReport(s, await this.summarize(s));
  }

  // --- internos ------------------------------------------------------------------------------------------------

  /** Efectivo neto cobrado por estado de recibo (el efectivo guardado ya descuenta el vuelto). */
  private async cashSum(db: Tx | PrismaService, sessionId: number, status: 'PAGADO' | 'ANULADO') {
    const agg = await db.receiptPayment.aggregate({
      _sum: { amount: true },
      where: { method: 'EFECTIVO', receipt: { sessionId, status } },
    });
    return money(agg._sum.amount);
  }

  async summarize(s: SessionRow) {
    const paid = await this.cashSum(this.prisma, s.id, 'PAGADO');
    const voided = await this.cashSum(this.prisma, s.id, 'ANULADO');
    const open = !s.closedAt;
    const counts = await this.prisma.cashCount.findMany({ where: { sessionId: s.id }, orderBy: { denomination: 'desc' } });
    return {
      sessionId: s.id,
      closed: !open,
      closingNumber: s.closingNumber,
      openingFloat: num(s.openingFloat),
      cashCollected: num(paid.plus(voided)),
      cashVoided: num(voided),
      cashSystem: num(paid),
      expectedCash: open ? num(money(s.openingFloat).plus(paid)) : num(s.expectedCash),
      countedCash: s.countedCash === null ? null : num(s.countedCash),
      difference: s.difference === null ? null : num(s.difference),
      justification: s.justification,
      counts: counts.map((c) => ({ denomination: c.denomination, quantity: c.quantity })),
    };
  }
}

function assertCanAccess(s: SessionRow, user: AuthUser) {
  if (user.role === 'CAJERO' && s.cashierId !== user.id) {
    throw ApiError.forbidden('FORBIDDEN', 'Solo puede operar su propia caja.');
  }
}

export type CashboxRow = Prisma.CashboxGetPayload<{ include: { pool: true } }>;

export function toCashboxDto(c: CashboxRow) {
  return { id: c.id, code: c.code, name: c.name, poolId: c.poolId, poolName: c.pool.name, active: c.active };
}

export function toSessionDto(s: SessionRow) {
  return {
    id: s.id,
    cashboxId: s.cashboxId,
    cashboxCode: s.cashbox.code,
    cashboxName: s.cashbox.name,
    cashierId: s.cashierId,
    cashierName: nombreVisible(s.cashier),
    shift: s.shift,
    openedAt: s.openedAt,
    openingFloat: num(s.openingFloat),
    closedAt: s.closedAt,
    closingNumber: s.closingNumber,
  };
}

export { ZERO };
