import { Injectable } from '@nestjs/common';
import { Prisma, ReceiptStatus } from '../../generated/prisma/client.js';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { type AuthUser, nombreVisible, USUARIO_VISIBLE } from '../auth/arca-auth.js';
import { CredentialService } from '../auth/credenciales.js';
import { ClientsService, toDto as clientDto } from '../clients/clients.service.js';
import { ApiError } from '../common/api-error.js';
import { Clock } from '../common/clock.js';
import { dec, formatColones, money, num } from '../common/money.js';
import { pageOf } from '../common/page.js';
import { localDate, startOfDay, startOfNextDay } from '../common/zones.js';
import { Settings, SettingsService } from '../settings/settings.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { calculate } from './receipt-calculator.js';
import { renderReceiptHtml } from './receipt-html.js';
import { CreateReceiptDto, VoidDto } from './receipts.dto.js';
import { assertAuthorizer, assertVoidable, canVoid, VOID_WINDOW_MS } from './void-policy.js';

const fullInclude = {
  cashier: USUARIO_VISIBLE,
  cashbox: true,
  client: true,
  lines: { orderBy: { id: 'asc' } },
  payments: { orderBy: { id: 'asc' } },
  voidInfo: { include: { requestedByUser: USUARIO_VISIBLE, authorizedByUser: USUARIO_VISIBLE } },
} satisfies Prisma.ReceiptInclude;
type FullReceipt = Prisma.ReceiptGetPayload<{ include: typeof fullInclude }>;

const summaryInclude = { cashier: USUARIO_VISIBLE, client: true, lines: { orderBy: { id: 'asc' } } } satisfies Prisma.ReceiptInclude;
type SummaryReceipt = Prisma.ReceiptGetPayload<{ include: typeof summaryInclude }>;

export interface SearchQuery {
  from?: string;
  to?: string;
  cashierId?: string;
  conceptId?: number;
  status?: ReceiptStatus;
  client?: string;
  page: number;
  size: number;
}

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly credentials: CredentialService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  // --- emitir --------------------------------------------------------------------------------------------------

  /** Recalcula todo en el servidor, exige caja abierta y asigna el número consecutivo por caja (FOR UPDATE). */
  async create(dto: CreateReceiptDto, user: AuthUser, ctx: AuditContext) {
    const open = await this.prisma.cashboxSession.findFirst({ where: { cashierId: user.id, closedAt: null }, include: { cashbox: true } });
    if (!open) throw ApiError.unprocessable('CASHBOX_CLOSED', 'Debe abrir su caja antes de cobrar.');
    const client = dto.clientId === undefined ? null : await this.clients.find(dto.clientId);

    const conceptIds = [...new Set(dto.lines.map((l) => l.conceptId))];
    const concepts = new Map((await this.prisma.concept.findMany({ where: { id: { in: conceptIds } } })).map((c) => [c.id, c]));
    for (const l of dto.lines) {
      const c = concepts.get(l.conceptId);
      if (!c) throw ApiError.notFound(`Concepto no encontrado: ${l.conceptId}`);
      if (!c.active) throw ApiError.unprocessable('CONCEPT_INACTIVE', `El concepto "${c.name}" está inactivo.`);
    }
    const p = dto.payments;
    const calc = calculate(
      dto.lines.map((l) => ({ quantity: l.quantity, unitAmount: l.unitAmount, discount: l.discount, surcharge: l.surcharge })),
      { card: p.card, sinpe: p.sinpe, transfer: p.transfer, cashReceived: p.cashReceived },
    );

    const id = await this.prisma.$transaction(
      async (tx) => {
        // Mismo bloqueo que el cierre de caja: ningún recibo entra a una sesión que se está cerrando.
        const locked = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM cashbox_session WHERE id = ${open.id} AND closed_at IS NULL FOR UPDATE`;
        if (locked.length === 0) throw ApiError.unprocessable('CASHBOX_CLOSED', 'Debe abrir su caja antes de cobrar.');
        // Bloqueo de la secuencia dentro de la transacción: números consecutivos, sin saltos ni duplicados.
        await tx.$queryRaw`SELECT cashbox_id FROM receipt_sequence WHERE cashbox_id = ${open.cashboxId} FOR UPDATE`;
        const seq = await tx.receiptSequence.update({
          where: { cashboxId: open.cashboxId },
          data: { seqValue: { increment: 1 } },
        });
        const now = this.clock.now();
        const payments = [
          { method: 'EFECTIVO' as const, amount: calc.cashDue },
          { method: 'TARJETA' as const, amount: money(p.card) },
          { method: 'SINPE_MOVIL' as const, amount: money(p.sinpe) },
          { method: 'TRANSFERENCIA' as const, amount: money(p.transfer) },
        ].filter((x) => x.amount.gt(0));
        const cashbox = open.cashbox;
        const receipt = await tx.receipt.create({
          data: {
            number: `${cashbox.code}-${localDate(now).slice(0, 4)}-${String(seq.seqValue).padStart(6, '0')}`,
            sessionId: open.id,
            cashboxId: cashbox.id,
            cashierId: user.id,
            clientId: client?.id ?? null,
            poolId: cashbox.poolId,
            shift: open.shift,
            issuedAt: now,
            status: 'PAGADO',
            subtotal: dec(calc.subtotal),
            discounts: dec(calc.discounts),
            surcharges: dec(calc.surcharges),
            total: dec(calc.total),
            cashDue: dec(calc.cashDue),
            cashReceived: dec(p.cashReceived),
            changeAmount: dec(calc.change),
            lines: {
              create: dto.lines.map((l, i) => ({
                conceptId: l.conceptId,
                conceptName: concepts.get(l.conceptId)!.name,
                quantity: l.quantity,
                unitAmount: dec(l.unitAmount),
                discount: dec(l.discount),
                surcharge: dec(l.surcharge),
                lineTotal: dec(calc.lineTotals[i]),
              })),
            },
            payments: { create: payments.map((x) => ({ method: x.method, amount: dec(x.amount) })) },
          },
        });
        await this.audit.log(ctx, 'RECEIPT_CREATED', 'Receipt', receipt.id, `Recibo ${receipt.number} · ${formatColones(calc.total)}`, tx);
        return receipt.id;
      },
      { maxWait: 15_000, timeout: 20_000 },
    );
    return this.get(id);
  }

  // --- consultar -----------------------------------------------------------------------------------------------

  async get(id: number) {
    const r = await this.prisma.receipt.findUnique({ where: { id }, include: fullInclude });
    if (!r) throw ApiError.notFound('Recibo no encontrado.');
    return this.toDto(r, await this.settings.get());
  }

  async search(q: SearchQuery) {
    const where: Prisma.ReceiptWhereInput = {
      ...(q.from || q.to
        ? { issuedAt: { ...(q.from && { gte: startOfDay(q.from) }), ...(q.to && { lt: startOfNextDay(q.to) }) } }
        : {}),
      ...(q.cashierId !== undefined && { cashierId: q.cashierId }),
      ...(q.status && { status: q.status }),
      ...(q.conceptId !== undefined && { lines: { some: { conceptId: q.conceptId } } }),
      ...(q.client?.trim() && {
        client: { OR: [{ fullName: { contains: q.client.trim() } }, { idNumber: { startsWith: q.client.trim() } }] },
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        include: summaryInclude,
        orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
        skip: q.page * q.size,
        take: q.size,
      }),
      this.prisma.receipt.count({ where }),
    ]);
    const now = this.clock.now();
    return pageOf(rows.map((r) => this.toSummary(r, now)), q.page, q.size, total);
  }

  async byClient(clientId: number, page: number, size: number) {
    const where = { clientId };
    const [rows, total] = await Promise.all([
      this.prisma.receipt.findMany({ where, include: summaryInclude, orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }], skip: page * size, take: size }),
      this.prisma.receipt.count({ where }),
    ]);
    const now = this.clock.now();
    return pageOf(rows.map((r) => this.toSummary(r, now)), page, size, total);
  }

  /** Recibos pagados para la pantalla de anulación; con includeExpired se muestran también los de hasta 7 días. */
  async voidable(includeExpired: boolean, user: AuthUser) {
    const now = this.clock.now();
    const since = new Date(now.getTime() - (includeExpired ? 7 * 24 * 3600 * 1000 : VOID_WINDOW_MS));
    const rows = await this.prisma.receipt.findMany({
      where: { status: 'PAGADO', issuedAt: { gte: since }, ...(user.role === 'CAJERO' && { cashierId: user.id }) },
      include: summaryInclude,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.toSummary(r, now));
  }

  // --- anular --------------------------------------------------------------------------------------------------

  /**
   * Anula un recibo pagado de hasta 48 h con credenciales de supervisor (verificadas en esta petición, sin abrir
   * sesión). El contador de intentos y la bitácora de fallos se escriben antes de lanzar el error.
   */
  async voidReceipt(id: number, dto: VoidDto, user: AuthUser, ctx: AuditContext) {
    const r = await this.prisma.receipt.findUnique({ where: { id } });
    if (!r) throw ApiError.notFound('Recibo no encontrado.');
    assertVoidable(r.status, r.issuedAt, this.clock.now());

    const check = await this.credentials.check(dto.supervisorUsername, dto.supervisorPassword);
    if (check.status === 'LOCKED') {
      await this.audit.log(ctx, 'VOID_AUTH_FAILED', 'Receipt', id, `Supervisor bloqueado: ${dto.supervisorUsername}`);
      throw new ApiError(423, 'ACCOUNT_LOCKED', 'El usuario supervisor está bloqueado temporalmente.');
    }
    if (check.status === 'BAD_CREDENTIALS') {
      await this.audit.log(ctx, 'VOID_AUTH_FAILED', 'Receipt', id, `Credenciales de supervisor incorrectas: ${dto.supervisorUsername}`);
      throw ApiError.unprocessable('INVALID_SUPERVISOR_CREDENTIALS', 'Usuario o contraseña del supervisor incorrectos.').with(
        'remainingAttempts',
        check.remainingAttempts,
      );
    }
    const supervisor = check.user!;
    if (supervisor.role === 'CAJERO') {
      await this.audit.log(ctx, 'VOID_AUTH_FAILED', 'Receipt', id, `Usuario sin rol de supervisor: ${supervisor.username}`);
    }
    assertAuthorizer(supervisor.role ?? undefined);

    await this.prisma.$transaction(async (tx) => {
      // Cambio de estado condicional: dos anulaciones simultáneas no pueden ganar ambas.
      const changed = await tx.receipt.updateMany({ where: { id, status: 'PAGADO' }, data: { status: 'ANULADO' } });
      if (changed.count !== 1) throw ApiError.unprocessable('ALREADY_VOIDED', 'El recibo ya está anulado.');
      await tx.receiptVoid.create({
        data: {
          receiptId: id,
          reason: dto.reason,
          detail: dto.detail.trim(),
          requestedBy: user.id,
          authorizedBy: supervisor.id,
          voidedAt: this.clock.now(),
        },
      });
      await this.audit.log(ctx, 'RECEIPT_VOIDED', 'Receipt', id, `Recibo ${r.number}. Motivo: ${dto.reason}. Autorizó: ${supervisor.username}`, tx);
    });
    return this.get(id);
  }

  // --- imprimir ------------------------------------------------------------------------------------------------

  async print(id: number, format: string, ctx: AuditContext) {
    const dto = await this.get(id);
    await this.audit.log(ctx, 'RECEIPT_REPRINTED', 'Receipt', id, `Recibo ${dto.number} · ${format}`);
    return renderReceiptHtml(dto, format.toUpperCase() === 'LETTER');
  }

  // --- mapeo ---------------------------------------------------------------------------------------------------

  private toDto(r: FullReceipt, settings: Settings) {
    const v = r.voidInfo;
    return {
      id: r.id,
      number: r.number,
      issuedAt: r.issuedAt,
      status: r.status,
      cashier: { id: r.cashier.id, fullName: nombreVisible(r.cashier), username: r.cashier.correo },
      cashbox: { id: r.cashbox.id, code: r.cashbox.code, name: r.cashbox.name },
      client: r.client ? clientDto(r.client) : null,
      poolId: r.poolId,
      shift: r.shift,
      lines: r.lines.map((l) => ({
        conceptId: l.conceptId,
        conceptName: l.conceptName,
        quantity: l.quantity,
        unitAmount: num(l.unitAmount),
        discount: num(l.discount),
        surcharge: num(l.surcharge),
        lineTotal: num(l.lineTotal),
      })),
      payments: r.payments.map((p) => ({ method: p.method, amount: num(p.amount) })),
      subtotal: num(r.subtotal),
      discounts: num(r.discounts),
      surcharges: num(r.surcharges),
      total: num(r.total),
      cashDue: num(r.cashDue),
      cashReceived: num(r.cashReceived),
      change: num(r.changeAmount),
      voidInfo: v
        ? {
            reason: v.reason,
            detail: v.detail,
            requestedBy: { id: v.requestedByUser.id, fullName: nombreVisible(v.requestedByUser), username: v.requestedByUser.correo },
            authorizedBy: { id: v.authorizedByUser.id, fullName: nombreVisible(v.authorizedByUser), username: v.authorizedByUser.correo },
            voidedAt: v.voidedAt,
          }
        : null,
      voidable: canVoid(r.status, r.issuedAt, this.clock.now()),
      municipality: { legalId: settings.municipalLegalId, phone: settings.municipalPhone, address: settings.municipalAddress },
    };
  }

  toSummary(r: SummaryReceipt, now: Date) {
    const first = r.lines[0]?.conceptName ?? '';
    return {
      id: r.id,
      number: r.number,
      issuedAt: r.issuedAt,
      cashierName: nombreVisible(r.cashier),
      clientName: r.client?.fullName ?? null,
      concept: r.lines.length > 1 ? `${first} +${r.lines.length - 1}` : first,
      total: num(r.total),
      status: r.status,
      voidable: canVoid(r.status, r.issuedAt, now),
      hoursElapsed: Math.floor((now.getTime() - r.issuedAt.getTime()) / 3600_000),
    };
  }
}

export type ReceiptDto = Awaited<ReturnType<ReceiptsService['get']>>;
export { summaryInclude };
