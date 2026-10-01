import { Module } from '@nestjs/common';
import { DiasNoLaborablesService } from './dias-no-laborables.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import { VacacionesService } from './vacaciones.service.js';
import { DiasNoLaborablesController, SolicitudesController, VacacionesController } from './vacaciones.controller.js';

/**
 * Sprint 2: saldo de vacaciones, solicitudes (vacaciones, permisos,
 * licencias, capacitaciones), feriados y calendario. Exporta
 * VacacionesService para que el registro de funcionarios cargue el saldo
 * inicial en su misma transaccion.
 */
@Module({
  controllers: [VacacionesController, SolicitudesController, DiasNoLaborablesController],
  providers: [VacacionesService, SolicitudesService, DiasNoLaborablesService],
  exports: [VacacionesService],
})
export class VacacionesModule {}
