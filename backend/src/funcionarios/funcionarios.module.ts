import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { FuncionariosController } from './funcionarios.controller.js';
import { FuncionariosService } from './funcionarios.service.js';

/**
 * Funcionarios. Usa UsuariosService para crear la cuenta en la misma
 * transaccion del registro ("crear tambien su cuenta").
 */
@Module({
  imports: [UsuariosModule],
  controllers: [FuncionariosController],
  providers: [FuncionariosService],
  exports: [FuncionariosService],
})
export class FuncionariosModule {}
