import { Module } from '@nestjs/common';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { VacacionesModule } from '../vacaciones/vacaciones.module.js';
import {
  CapacitacionesController,
  HorasExtraController,
  IncapacidadesController,
  SolicitudesConDocumentosController,
} from './ausencias.controller.js';
import { CapacitacionesService } from './capacitaciones.service.js';
import { ConstanciasService } from './constancias.service.js';
import { HorasExtraService } from './horas-extra.service.js';
import { IncapacidadesService } from './incapacidades.service.js';
import { JustificantesService } from './justificantes.service.js';

/**
 * Ausencias y tramites que necesitan la gestion documental (Sprint 2):
 * constancia de vacaciones en PDF, justificantes, incapacidades,
 * capacitaciones y el registro de horas extra.
 *
 * Va aparte del modulo de vacaciones porque usa DocumentosModule, que a su
 * vez depende (via funcionarios) del de vacaciones. La constancia la pide
 * SolicitudesService por el nombre "GENERADOR_DE_CONSTANCIAS" (ModuleRef),
 * asi no hay dependencia circular.
 */
@Module({
  imports: [VacacionesModule, DocumentosModule],
  controllers: [SolicitudesConDocumentosController, IncapacidadesController, CapacitacionesController, HorasExtraController],
  providers: [
    ConstanciasService,
    { provide: 'GENERADOR_DE_CONSTANCIAS', useExisting: ConstanciasService },
    JustificantesService,
    IncapacidadesService,
    CapacitacionesService,
    HorasExtraService,
  ],
})
export class AusenciasModule {}
