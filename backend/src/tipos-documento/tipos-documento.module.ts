import { Module } from '@nestjs/common';
import { TiposDocumentoController } from './tipos-documento.controller.js';
import { TiposDocumentoService } from './tipos-documento.service.js';

/** Catalogo de tipos de documento (Ficha 18) con los formatos que acepta cada uno. */
@Module({
  controllers: [TiposDocumentoController],
  providers: [TiposDocumentoService],
})
export class TiposDocumentoModule {}
