import { ArcaControlador } from '../auth/arca-auth.js';
import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Audit, AuditCtx, CurrentUser, Roles } from '../auth/arca-auth.js';
import { AuthUser } from '../auth/arca-auth.js';
import { ApiError } from '../common/api-error.js';
import { DashboardService } from './dashboard.service.js';
import { Granularity, GRANULARITIES, GroupBy, GROUPS, ReportsService } from './reports.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function parseParams(from?: string, to?: string, groupBy = 'PERIOD', granularity = 'DAY') {
  if (!from || !to) throw ApiError.badRequest('INVALID_RANGE', 'Indique un rango de fechas válido.');
  if (!GROUPS.includes(groupBy as GroupBy) || !GRANULARITIES.includes(granularity as Granularity)) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'groupBy o granularity no son válidos.');
  }
  return { from, to, groupBy: groupBy as GroupBy, granularity: granularity as Granularity };
}

@ArcaControlador('')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('reports/revenue')
  @Roles('SUPERVISOR', 'ADMINISTRADOR')
  revenue(@Query('from') from?: string, @Query('to') to?: string, @Query('groupBy') groupBy?: string, @Query('granularity') granularity?: string) {
    const p = parseParams(from, to, groupBy, granularity);
    return this.reports.revenue(p.from, p.to, p.groupBy, p.granularity);
  }

  @Get('reports/revenue/export')
  @Roles('SUPERVISOR', 'ADMINISTRADOR')
  async export(
    @Res() res: Response,
    @Audit() ctx: AuditCtx,
    @Query('format') format = 'pdf',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: string,
    @Query('granularity') granularity?: string,
  ) {
    const p = parseParams(from, to, groupBy, granularity);
    const xlsx = format === 'xlsx';
    const bytes = await this.reports.export(xlsx ? 'xlsx' : 'pdf', p.from, p.to, p.groupBy, p.granularity, ctx);
    res
      .set({ 'Content-Type': xlsx ? XLSX : 'application/pdf', 'Content-Disposition': `attachment; filename="ingresos.${xlsx ? 'xlsx' : 'pdf'}"` })
      .send(bytes);
  }

  @Get('dashboard/today')
  today(@CurrentUser() user: AuthUser) {
    return this.dashboard.today(user);
  }
}
