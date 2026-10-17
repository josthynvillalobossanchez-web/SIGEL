import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { TalentPoolController, TalentPoolPublicoController } from './talent-pool.controller.js';
import { TalentPoolService } from './talent-pool.service.js';

/**
 * Talent Pool (Sprint 3, HU 38-41). Usa Funcionarios para contratar y
 * Documentos para copiar el curriculum al expediente. Ningun otro modulo
 * depende de este (la rama de las piscinas lo quita sin tocar nada mas).
 */
@Module({
  imports: [AlmacenamientoModule, DocumentosModule, FuncionariosModule],
  controllers: [TalentPoolPublicoController, TalentPoolController],
  providers: [TalentPoolService],
})
export class TalentPoolModule {}
