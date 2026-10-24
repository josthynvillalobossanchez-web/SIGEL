import { ArcaControlador } from '../auth/arca-auth.js';
import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/arca-auth.js';
import { ApiError } from '../common/api-error.js';
import { clampPage, pageOf } from '../common/page.js';
import { isIsoDate, startOfDay, startOfNextDay } from '../common/zones.js';
import { AuditService } from './audit.service.js';

@ArcaControlador('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('ADMINISTRADOR')
  async list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('user') user?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    for (const d of [from, to]) {
      if (d && !isIsoDate(d)) throw ApiError.badRequest('INVALID_DATE', 'Use el formato AAAA-MM-DD.');
    }
    const p = clampPage(page, size, 200);
    const { rows, total } = await this.audit.search({
      from: from ? startOfDay(from) : undefined,
      to: to ? startOfNextDay(to) : undefined,
      user: user?.trim() || undefined,
      action: action?.trim() || undefined,
      skip: p.skip,
      take: p.size,
    });
    return pageOf(
      rows.map((r) => ({
        id: r.id,
        at: r.at,
        username: r.username,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        detail: r.detail,
        ip: r.ip,
      })),
      p.page,
      p.size,
      total,
    );
  }
}
