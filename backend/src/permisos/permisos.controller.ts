import { Controller, Get } from '@nestjs/common';
import { RequierePermisos } from '../autenticacion/decoradores.js';
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
   * para la pantalla donde se arma cada rol.
   *
   * Exige "permisos.editar" porque saber que controles existen en el sistema
   * ya es informacion de seguridad: solo la ve quien administra los roles.
   */
  @RequierePermisos('permisos.editar')
  @Get()
  listarCatalogo(): Promise<ModuloDePermisos[]> {
    return this.permisos.listarCatalogo();
  }
}
