import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Tx } from '../common/tx.js';

export interface AuditContext {
  username?: string | null;
  ip?: string | null;
}

/**
 * Bitácora append-only: solo se inserta y se consulta. La IP y el usuario se pasan explícitamente
 * (el controlador los toma de la petición) para no depender de estado global.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async log(
    ctx: AuditContext,
    action: string,
    entity: string | null,
    entityId: string | number | null,
    detail?: string | null,
    tx?: Tx,
  ) {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        at: this.clock.now(),
        username: ctx.username ?? null,
        action,
        entity,
        entityId: entityId === null ? null : String(entityId),
        detail: detail ? detail.slice(0, 1000) : null,
        ip: ctx.ip ?? null,
      },
    });
  }

  async search(q: { from?: Date; to?: Date; user?: string; action?: string; skip: number; take: number }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.from || q.to ? { at: { ...(q.from && { gte: q.from }), ...(q.to && { lt: q.to }) } } : {}),
      ...(q.user ? { username: q.user } : {}),
      ...(q.action ? { action: q.action } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip: q.skip, take: q.take }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  }
}
