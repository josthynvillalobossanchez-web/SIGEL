import { Module } from '@nestjs/common';
import { AlmacenamientoModule } from '../almacenamiento/almacenamiento.module.js';
import { ExpedientesModule } from '../expedientes/expedientes.module.js';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { DocumentosController, ExpedienteDocumentosController } from './documentos.controller.js';
import { DocumentosService } from './documentos.service.js';
import { FotosController } from './fotos.controller.js';
import { FotosService } from './fotos.service.js';

/**
 * Gestion documental (epica 3): documentos del expediente cifrados, y la
 * fotografia de perfil. Exporta DocumentosService para que los procesos de
 * los sprints 2 y 3 guarden sus PDF generados (registrarGenerado).
 */
@Module({
  imports: [AlmacenamientoModule, ExpedientesModule, FuncionariosModule],
  controllers: [ExpedienteDocumentosController, DocumentosController, FotosController],
  providers: [DocumentosService, FotosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
