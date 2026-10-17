import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { ConsultarNotificacionesDto } from './dto/consultar-notificaciones.dto.js';
import { NotificacionesService, type NotificacionDeLista } from './notificaciones.service.js';

/**
 * Notificaciones (HU 42 y 44). Cada quien ve y marca SOLO las suyas: el
 * destinatario sale de la sesion, nunca de un parametro.
 */
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  /** GET /api/notificaciones?estado=sinLeer|leidas|todas  Paginadas, las mas nuevas primero, con el total sin leer. */
  @RequierePermisos('notificaciones.ver')
  @Get()
  consultar(
    @Query() filtros: ConsultarNotificacionesDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<NotificacionDeLista> & { sinLeer: number }> {
    return this.notificaciones.consultar(filtros, quienActua);
  }

  /** GET /api/notificaciones/resumen  Para la campana: cuantas sin leer y las 6 mas recientes. */
  @RequierePermisos('notificaciones.ver')
  @Get('resumen')
  resumen(@UsuarioActual() quienActua: UsuarioAutenticado): Promise<{ sinLeer: number; recientes: NotificacionDeLista[] }> {
    return this.notificaciones.resumen(quienActua);
  }

  /** POST /api/notificaciones/leer-todas */
  @RequierePermisos('notificaciones.ver')
  @Post('leer-todas')
  @HttpCode(HttpStatus.OK)
  leerTodas(@UsuarioActual() quienActua: UsuarioAutenticado): Promise<{ marcadas: number }> {
    return this.notificaciones.marcarTodasLeidas(quienActua);
  }

  /** POST /api/notificaciones/:id/leida  (NOTIFICACION_NO_ENCONTRADA si no es suya) */
  @RequierePermisos('notificaciones.ver')
  @Post(':id/leida')
  @HttpCode(HttpStatus.OK)
  marcarLeida(@Param('id', uuidValido('notificación')) id: string, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<NotificacionDeLista> {
    return this.notificaciones.marcarLeida(id, quienActua);
  }
}
