import { Module } from '@nestjs/common';
import { MiCuentaController } from './mi-cuenta.controller.js';
import { MiCuentaService } from './mi-cuenta.service.js';

/** "Mi cuenta": lo que la persona conectada ve y cambia de si misma. */
@Module({
  controllers: [MiCuentaController],
  providers: [MiCuentaService],
})
export class MiCuentaModule {}
