import { Module } from '@nestjs/common';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { ExpedientesController } from './expedientes.controller.js';
import { ExpedientesService } from './expedientes.service.js';

/**
 * Expediente laboral: la ficha del funcionario con sus pestanas de
 * consulta y el historial laboral. Usa FuncionariosService para la ficha.
 * Los documentos (y su carga) llegan con la gestion documental (epica 3).
 */
@Module({
  imports: [FuncionariosModule],
  controllers: [ExpedientesController],
  providers: [ExpedientesService],
})
export class ExpedientesModule {}
