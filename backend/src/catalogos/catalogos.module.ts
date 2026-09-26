import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller.js';
import { CatalogosService } from './catalogos.service.js';

/**
 * Catalogos de la Municipalidad (departamentos, puestos, profesiones).
 * Exporta el servicio para que funcionarios pueda leer las listas.
 */
@Module({
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
