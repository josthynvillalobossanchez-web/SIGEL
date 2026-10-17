import { Module } from '@nestjs/common';
import { DiasNoLaborablesService } from './dias-no-laborables.service.js';
import { SolicitudesService } from './solicitudes.service.js';
import { VacacionesService } from './vacaciones.service.js';
import { AvisosPeriodicosService } from './avisos-periodicos.service.js';
import { ReglasDeVacacionesController } from './reglas-de-vacaciones.controller.js';
import { ReglasDeVacacionesService } from './reglas-de-vacaciones.service.js';
import { DiasNoLaborablesController, SolicitudesController, VacacionesController } from './vacaciones.controller.js';

/**
 * Sprint 2: saldo de vacaciones, solicitudes (vacaciones, permisos,
 * licencias, capacitaciones), feriados y calendario. Exporta
 * VacacionesService para que el registro de funcionarios cargue el saldo
 * inicial en su misma transaccion.
 */
@Module({
  controllers: [VacacionesController, SolicitudesController, DiasNoLaborablesController, ReglasDeVacacionesController],
  providers: [VacacionesService, SolicitudesService, DiasNoLaborablesService, ReglasDeVacacionesService, AvisosPeriodicosService],
  exports: [VacacionesService, SolicitudesService, DiasNoLaborablesService],
})
export class VacacionesModule {}
