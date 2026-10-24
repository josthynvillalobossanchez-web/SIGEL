import { ArcaControlador } from '../auth/arca-auth.js';
import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Audit, AuditCtx, CurrentUser, Roles } from '../auth/arca-auth.js';
import { AuthUser } from '../auth/arca-auth.js';
import { CashboxDto, CloseSessionDto, OpenSessionDto, PoolDto } from './cashbox.dto.js';
import { CashboxService } from './cashbox.service.js';

@ArcaControlador('')
export class CashboxController {
  constructor(private readonly service: CashboxService) {}

  @Get('pools')
  pools() {
    return this.service.listPools();
  }

  @Post('pools')
  @Roles('ADMINISTRADOR')
  createPool(@Body() dto: PoolDto, @Audit() ctx: AuditCtx) {
    return this.service.createPool(dto, ctx);
  }

  @Get('cashboxes')
  cashboxes() {
    return this.service.listCashboxes();
  }

  @Post('cashboxes')
  @Roles('ADMINISTRADOR')
  createCashbox(@Body() dto: CashboxDto, @Audit() ctx: AuditCtx) {
    return this.service.createCashbox(dto, ctx);
  }

  @Put('cashboxes/:id')
  @Roles('ADMINISTRADOR')
  updateCashbox(@Param('id', ParseIntPipe) id: number, @Body() dto: CashboxDto, @Audit() ctx: AuditCtx) {
    return this.service.updateCashbox(id, dto, ctx);
  }

  /** Sesión abierta del usuario autenticado (204 si no tiene). */
  @Get('cashbox-sessions/current')
  async current(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const s = await this.service.currentFor(user.id);
    if (!s) return res.status(204).end();
    return res.json(s);
  }

  @Get('cashbox-sessions')
  @Roles('SUPERVISOR', 'ADMINISTRADOR')
  recent() {
    return this.service.recent();
  }

  @Post('cashbox-sessions')
  open(@Body() dto: OpenSessionDto, @CurrentUser() user: AuthUser, @Audit() ctx: AuditCtx) {
    return this.service.open(dto, user, ctx);
  }

  @Post('cashbox-sessions/:id/close')
  @HttpCode(200)
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseSessionDto, @CurrentUser() user: AuthUser, @Audit() ctx: AuditCtx) {
    return this.service.close(id, dto, user, ctx);
  }

  @Get('cashbox-sessions/:id/summary')
  summary(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.summary(id, user);
  }

  @Get('cashbox-sessions/:id/report')
  async report(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const pdf = await this.service.closingReport(id, user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="cierre-${id}.pdf"` }).send(pdf);
  }
}
