import { Module } from '@nestjs/common';
import { FuncionariosModule } from '../funcionarios/funcionarios.module.js';
import { MiCuentaController } from './mi-cuenta.controller.js';
import { MiCuentaService } from './mi-cuenta.service.js';

/**
 * "Mi cuenta": lo que la persona conectada ve y cambia de si misma. Usa
 * FuncionariosService para leer y guardar sus datos con las mismas reglas.
 */
@Module({
  imports: [FuncionariosModule],
  controllers: [MiCuentaController],
  providers: [MiCuentaService],
})
export class MiCuentaModule {}
