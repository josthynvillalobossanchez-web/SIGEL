import { ArcaControlador } from '../auth/arca-auth.js';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { Audit, AuditCtx, Roles } from '../auth/arca-auth.js';
import { SettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@ArcaControlador('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  /** Cualquier usuario autenticado: la interfaz necesita el formato de impresión por defecto. */
  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  @Roles('ADMINISTRADOR')
  update(@Body() dto: SettingsDto, @Audit() ctx: AuditCtx) {
    return this.service.update(dto, ctx);
  }
}
