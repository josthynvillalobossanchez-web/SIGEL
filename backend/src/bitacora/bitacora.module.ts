import { Global, Module } from '@nestjs/common';
import { BitacoraController } from './bitacora.controller.js';
import { BitacoraService } from './bitacora.service.js';

/**
 * Global porque practicamente todos los modulos del sistema van a anotar
 * movimientos: usuarios, roles, funcionarios, documentos, vacaciones. Se
 * declara una sola vez y queda disponible en todos, sin tener que importarlo
 * modulo por modulo.
 */
@Global()
@Module({
  controllers: [BitacoraController],
  providers: [BitacoraService],
  exports: [BitacoraService],
})
export class BitacoraModule {}
