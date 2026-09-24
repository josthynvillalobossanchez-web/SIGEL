import { Global, Module } from '@nestjs/common';
import { CorreoService } from './correo.service.js';

/**
 * Global porque varios modulos van a necesitar enviar correo: la
 * recuperacion de contrasena, los avisos de vacaciones, las notificaciones
 * del Talent Pool. Se declara una sola vez y queda disponible en todos.
 */
@Global()
@Module({
  providers: [CorreoService],
  exports: [CorreoService],
})
export class CorreoModule {}
