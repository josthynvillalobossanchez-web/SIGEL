import { Global, Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';

/**
 * Notificaciones dentro de SINERGIA (Sprint 3). Es GLOBAL: cualquier modulo
 * inyecta NotificacionesService sin importarlo (como Prisma o la bitacora),
 * porque casi todos los procesos avisan algo. Solo depende de Prisma, asi
 * que no crea dependencias circulares.
 */
@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
