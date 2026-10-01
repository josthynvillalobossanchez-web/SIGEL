import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { CambiarEstadoElementoDto } from '../catalogos/dto/elemento-de-catalogo.dto.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { CrearTipoDocumentoDto, EditarTipoDocumentoDto } from './dto/tipo-documento.dto.js';
import { TiposDocumentoService, type TipoDeDocumento } from './tipos-documento.service.js';

/**
 * Tipos de documento (Ficha 18). Consultar solo pide sesion; crear, editar y
 * activar/inactivar piden "tiposDocumento.editar".
 */
@Controller('tipos-documento')
export class TiposDocumentoController {
  constructor(private readonly tipos: TiposDocumentoService) {}

  /**
   * GET /api/tipos-documento  (?soloActivos=true  ?paraSubir=true)
   * "paraSubir" deja solo los que se pueden elegir al subir un documento
   * (activos y no generados por SINERGIA).
   */
  @Get()
  consultar(@Query('soloActivos') activos?: string, @Query('paraSubir') paraSubir?: string): Promise<TipoDeDocumento[]> {
    return this.tipos.consultar(activos === 'true', paraSubir === 'true');
  }

  /** POST /api/tipos-documento  { "nombre": "Título profesional", "formatos": ["jpg", "png"] } */
  @RequierePermisos('tiposDocumento.editar')
  @Post()
  crear(
    @Body() datos: CrearTipoDocumentoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<TipoDeDocumento> {
    return this.tipos.crear(datos, quienActua, direccionIp);
  }

  /** PATCH /api/tipos-documento/:id  Nombre, descripcion y/o formatos (en los de SINERGIA, solo el nombre). */
  @RequierePermisos('tiposDocumento.editar')
  @Patch(':id')
  editar(
    @Param('id', uuidValido('tipo de documento')) id: string,
    @Body() datos: EditarTipoDocumentoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<TipoDeDocumento> {
    return this.tipos.editar(id, datos, quienActua, direccionIp);
  }

  /** PATCH /api/tipos-documento/:id/estado  { "activo": false }  Los de SINERGIA no se inactivan. */
  @RequierePermisos('tiposDocumento.editar')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', uuidValido('tipo de documento')) id: string,
    @Body() datos: CambiarEstadoElementoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<TipoDeDocumento> {
    return this.tipos.cambiarEstado(id, datos.activo, quienActua, direccionIp);
  }
}
