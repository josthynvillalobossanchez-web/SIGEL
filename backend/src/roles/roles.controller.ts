import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { CambiarEstadoRolDto } from './dto/cambiar-estado-rol.dto.js';
import { CrearRolDto } from './dto/crear-rol.dto.js';
import { EditarRolDto } from './dto/editar-rol.dto.js';
import { ReemplazarPermisosRolDto } from './dto/reemplazar-permisos-rol.dto.js';
import { RolesService, type RolResumido } from './roles.service.js';

/**
 * Roles del sistema.
 *
 * Consultar pide "usuarios.ver" (quien ve cuentas necesita saber que roles
 * existen para entenderlas y para asignarlos). Modificar pide "roles.editar".
 * Los roles de sistema no se modifican por aqui (ROL_DE_SISTEMA); ver
 * roles.service.ts para el porque.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /**
   * GET /api/roles
   * Todos los roles, primero los de sistema. Cada uno trae "asignable" para
   * quien consulta, y cuantas cuentas lo tienen vigente.
   */
  @RequierePermisos('usuarios.ver')
  @Get()
  consultar(@UsuarioActual() quienActua: UsuarioAutenticado): Promise<RolResumido[]> {
    return this.roles.consultar(quienActua);
  }

  /** GET /api/roles/:id  Detalle con la lista de permisos del rol. */
  @RequierePermisos('usuarios.ver')
  @Get(':id')
  consultarUno(
    @Param('id', uuidValido('rol')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<unknown> {
    return this.roles.consultarUno(id, quienActua);
  }

  /**
   * POST /api/roles
   * Ejemplo: { "nombre": "Encargado de planillas", "descripcion": "...",
   *            "permisoIds": ["...", "..."] }
   * Errores propios: ROL_DUPLICADO, PERMISO_REPETIDO, PERMISO_NO_ENCONTRADO,
   * PERMISO_INACTIVO, PERMISO_NO_ASIGNABLE.
   */
  @RequierePermisos('roles.editar')
  @Post()
  crear(
    @Body() datos: CrearRolDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.roles.crear(datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/roles/:id  (pagina "Editar rol")
   * Ejemplo: { "nombre": "Planillas", "descripcion": "Prepara la planilla quincenal",
   *            "permisoIds": ["...", "..."] }   (todo opcional; al menos uno)
   * Errores propios: ROL_DE_SISTEMA, ROL_CON_MAYOR_ACCESO, ROL_DUPLICADO,
   * ROL_SIN_CAMBIO, y si vienen permisos, ROL_PROPIO y los de la lista (ver POST).
   */
  @RequierePermisos('roles.editar')
  @Patch(':id')
  editar(
    @Param('id', uuidValido('rol')) id: string,
    @Body() datos: EditarRolDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.roles.editar(id, datos, quienActua, direccionIp);
  }

  /**
   * PUT /api/roles/:id/permisos
   * Reemplaza la lista COMPLETA de permisos. Afecta de inmediato a todas
   * las cuentas que tienen el rol.
   * Ejemplo: { "permisoIds": ["...", "..."] }
   * Errores propios: ROL_DE_SISTEMA, ROL_CON_MAYOR_ACCESO, ROL_PROPIO,
   * PERMISOS_SIN_CAMBIO, mas los de la lista de permisos (ver POST).
   */
  @RequierePermisos('roles.editar')
  @Put(':id/permisos')
  reemplazarPermisos(
    @Param('id', uuidValido('rol')) id: string,
    @Body() datos: ReemplazarPermisosRolDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.roles.reemplazarPermisos(id, datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/roles/:id/estado
   * Ejemplo: { "activo": false }
   * Errores propios: ROL_DE_SISTEMA, ROL_CON_MAYOR_ACCESO, ROL_PROPIO,
   * ESTADO_SIN_CAMBIO, ROL_EN_USO (trae "cantidadUsuarios").
   */
  @RequierePermisos('roles.editar')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', uuidValido('rol')) id: string,
    @Body() datos: CambiarEstadoRolDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.roles.cambiarEstado(id, datos, quienActua, direccionIp);
  }
}
