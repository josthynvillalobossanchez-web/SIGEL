import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { CatalogosService, type CatalogosCompletos, type ElementoDeCatalogo } from './catalogos.service.js';
import { CambiarEstadoElementoDto, CrearElementoDto, EditarElementoDto } from './dto/elemento-de-catalogo.dto.js';
import { TipoDeCatalogoValido, type TipoDeCatalogo } from './tipos-de-catalogo.js';

/** "?soloActivos=true" -> true; cualquier otra cosa -> false. */
const soloActivos = (valor?: string): boolean => valor === 'true';

/**
 * Catalogos: departamentos, puestos y profesiones.
 *
 * Consultar solo pide sesion (los usan los formularios de funcionarios y
 * "Mi cuenta"). Crear, editar y activar/inactivar piden "catalogos.editar".
 * ":tipo" es departamentos, puestos o profesiones (otro valor: 404
 * CATALOGO_NO_EXISTE).
 */
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  /**
   * GET /api/catalogos  (?soloActivos=true)
   * Los tres catalogos de una vez: { departamentos, puestos, profesiones }.
   * Cada elemento trae cuantos funcionarios activos lo tienen.
   */
  @Get()
  consultarTodos(@Query('soloActivos') activos?: string): Promise<CatalogosCompletos> {
    return this.catalogos.consultarTodos(soloActivos(activos));
  }

  /** GET /api/catalogos/:tipo  (?soloActivos=true) */
  @Get(':tipo')
  consultar(
    @Param('tipo', TipoDeCatalogoValido) tipo: TipoDeCatalogo,
    @Query('soloActivos') activos?: string,
  ): Promise<ElementoDeCatalogo[]> {
    return this.catalogos.consultar(tipo, soloActivos(activos));
  }

  /**
   * POST /api/catalogos/:tipo
   * Ejemplo: { "nombre": "Recursos Humanos", "descripcion": "Gestion del personal" }
   * Errores propios: NOMBRE_DUPLICADO.
   */
  @RequierePermisos('catalogos.editar')
  @Post(':tipo')
  crear(
    @Param('tipo', TipoDeCatalogoValido) tipo: TipoDeCatalogo,
    @Body() datos: CrearElementoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<ElementoDeCatalogo> {
    return this.catalogos.crear(tipo, datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/catalogos/:tipo/:id
   * Nombre y/o descripcion ("" quita la descripcion).
   * Errores propios: ELEMENTO_NO_ENCONTRADO, NOMBRE_DUPLICADO, SIN_CAMBIOS.
   */
  @RequierePermisos('catalogos.editar')
  @Patch(':tipo/:id')
  editar(
    @Param('tipo', TipoDeCatalogoValido) tipo: TipoDeCatalogo,
    @Param('id', uuidValido('elemento')) id: string,
    @Body() datos: EditarElementoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<ElementoDeCatalogo> {
    return this.catalogos.editar(tipo, id, datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/catalogos/:tipo/:id/estado
   * Ejemplo: { "activo": false }. Se puede inactivar aunque haya
   * funcionarios que lo tengan: lo conservan, pero no se puede elegir para
   * funcionarios nuevos.
   * Errores propios: ELEMENTO_NO_ENCONTRADO, ESTADO_SIN_CAMBIO.
   */
  @RequierePermisos('catalogos.editar')
  @Patch(':tipo/:id/estado')
  cambiarEstado(
    @Param('tipo', TipoDeCatalogoValido) tipo: TipoDeCatalogo,
    @Param('id', uuidValido('elemento')) id: string,
    @Body() datos: CambiarEstadoElementoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<ElementoDeCatalogo> {
    return this.catalogos.cambiarEstado(tipo, id, datos.activo, quienActua, direccionIp);
  }
}
