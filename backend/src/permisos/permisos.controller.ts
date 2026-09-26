import { Controller, Get } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { PermisosService, type ModuloDePermisos } from './permisos.service.js';

/**
 * Catalogo de permisos del sistema.
 *
 * Los permisos no se crean ni se borran desde aqui: los define el equipo de
 * desarrollo junto con la funcionalidad que protegen, y se cargan con la
 * semilla. Lo que si es administrable es a que roles se les asigna cada uno,
 * y eso vive en el modulo de roles.
 */
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisos: PermisosService) {}

  /**
   * GET /api/permisos
   *
   * Lista el catalogo completo de permisos activos, agrupado por modulo,
   * para la pantalla donde se arma cada rol y para la de permisos
   * individuales de una cuenta. Cada permiso trae "asignable": true si
   * quien consulta lo tiene (solo se da lo que se tiene), para que la
   * pantalla no ofrezca lo que despues el backend va a rechazar.
   *
   * Pide "usuarios.ver" (antes pedia "permisos.editar", que el rol
   * Administrador no tiene: RRHH no podia armar roles ni dar permisos
   * individuales). No expone nada nuevo: el detalle de cada rol
   * (GET /api/roles/:id) ya muestra sus permisos con ese mismo permiso.
   * "permisos.editar" queda reservado para cuando el catalogo se pueda
   * administrar desde la aplicacion.
   */
  @RequierePermisos('usuarios.ver')
  @Get()
  listarCatalogo(@UsuarioActual() quienActua: UsuarioAutenticado): Promise<ModuloDePermisos[]> {
    return this.permisos.listarCatalogo(quienActua);
  }
}
