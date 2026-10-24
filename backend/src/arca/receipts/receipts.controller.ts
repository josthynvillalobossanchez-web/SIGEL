import { ArcaControlador } from '../auth/arca-auth.js';
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { ReceiptStatus } from '../../generated/prisma/client.js';
import type { Response } from 'express';
import { Audit, AuditCtx, CurrentUser } from '../auth/arca-auth.js';
import { AuthUser } from '../auth/arca-auth.js';
import { ApiError } from '../common/api-error.js';
import { clampPage } from '../common/page.js';
import { isIsoDate } from '../common/zones.js';
import { CreateReceiptDto, VoidDto } from './receipts.dto.js';
import { ReceiptsService } from './receipts.service.js';

function optionalInt(v: string | undefined, name: string): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) throw ApiError.badRequest('VALIDATION_ERROR', `${name} no es válido.`);
  return n;
}

/** Los cajeros son cuentas del sistema: su id es un UUID, no un numero. */
function optionalUuid(v: string | undefined, name: string): string | undefined {
  if (v === undefined || v === '') return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    throw ApiError.badRequest('VALIDATION_ERROR', `${name} no es válido.`);
  }
  return v;
}

@ArcaControlador('receipts')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Post()
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthUser, @Audit() ctx: AuditCtx) {
    return this.service.create(dto, user, ctx);
  }

  @Get()
  search(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cashierId') cashierId?: string,
    @Query('conceptId') conceptId?: string,
    @Query('status') status?: string,
    @Query('client') client?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    for (const d of [from, to]) {
      if (d && !isIsoDate(d)) throw ApiError.badRequest('INVALID_DATE', 'Use el formato AAAA-MM-DD.');
    }
    if (status && status !== 'PAGADO' && status !== 'ANULADO') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'El estado debe ser PAGADO o ANULADO.');
    }
    const p = clampPage(page, size);
    return this.service.search({
      from: from || undefined,
      to: to || undefined,
      cashierId: optionalUuid(cashierId, 'cashierId'),
      conceptId: optionalInt(conceptId, 'conceptId'),
      status: status as ReceiptStatus | undefined,
      client,
      page: p.page,
      size: p.size,
    });
  }

  @Get('voidable')
  voidable(@Query('includeExpired') includeExpired: string | undefined, @CurrentUser() user: AuthUser) {
    return this.service.voidable(includeExpired === 'true', user);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Get(':id/print')
  async print(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string | undefined,
    @Audit() ctx: AuditCtx,
    @Res() res: Response,
  ) {
    const html = await this.service.print(id, format === 'LETTER' ? 'LETTER' : 'THERMAL', ctx);
    res.type('text/html').send(html);
  }

  @Post(':id/void')
  @HttpCode(200)
  voidReceipt(@Param('id', ParseIntPipe) id: number, @Body() dto: VoidDto, @CurrentUser() user: AuthUser, @Audit() ctx: AuditCtx) {
    return this.service.voidReceipt(id, dto, user, ctx);
  }
}
