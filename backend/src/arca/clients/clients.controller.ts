import { ArcaControlador } from '../auth/arca-auth.js';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Audit, AuditCtx } from '../auth/arca-auth.js';
import { clampPage } from '../common/page.js';
import { ReceiptsService } from '../receipts/receipts.service.js';
import { ClientRequestDto } from './clients.dto.js';
import { ClientsService } from './clients.service.js';

@ArcaControlador('clients')
export class ClientsController {
  constructor(
    private readonly service: ClientsService,
    private readonly receipts: ReceiptsService,
  ) {}

  @Get()
  search(@Query('q') q?: string, @Query('page') page?: string, @Query('size') size?: string) {
    const p = clampPage(page, size);
    return this.service.search(q, p.page, p.size);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: ClientRequestDto, @Audit() ctx: AuditCtx) {
    return this.service.create(dto, ctx);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ClientRequestDto, @Audit() ctx: AuditCtx) {
    return this.service.update(id, dto, ctx);
  }

  @Get(':id/receipts')
  async receiptsOf(@Param('id', ParseIntPipe) id: number, @Query('page') page?: string, @Query('size') size?: string) {
    await this.service.find(id);
    const p = clampPage(page, size);
    return this.receipts.byClient(id, p.page, p.size);
  }
}
