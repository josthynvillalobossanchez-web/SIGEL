import { ArcaControlador } from '../auth/arca-auth.js';
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { Audit, AuditCtx, Roles } from '../auth/arca-auth.js';
import { ConceptDto } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ArcaControlador('concepts')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  list(@Query('active') active?: string) {
    return this.service.list(active === undefined ? undefined : active === 'true');
  }

  @Post()
  @Roles('ADMINISTRADOR')
  create(@Body() dto: ConceptDto, @Audit() ctx: AuditCtx) {
    return this.service.create(dto, ctx);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: ConceptDto, @Audit() ctx: AuditCtx) {
    return this.service.update(id, dto, ctx);
  }
}
