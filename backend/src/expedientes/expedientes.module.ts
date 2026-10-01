import { Module } from '@nestjs/common';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { ExpedientesController } from './expedientes.controller.js';
import { ExpedientesService } from './expedientes.service.js';

/**
 * Expediente laboral: la ficha del funcionario con sus pestanas de
 * consulta y el historial laboral. Usa FuncionariosService para la ficha.
 * Los documentos viven en DocumentosModule, que usa ExpedientesService
 * (revisarAcceso) para aplicar la misma regla de acceso al expediente.
 */
@Module({
  imports: [FuncionariosModule],
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
