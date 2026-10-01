import { Controller, Delete, Get, Param, Put, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { TAMANO_MAXIMO_FOTO, type ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { FotosService } from './fotos.service.js';

/**
 * Fotografia de perfil de un funcionario. Los permisos por persona
 * (la propia, o RRHH la de cualquiera) los decide el servicio.
 */
@Controller('funcionarios/:funcionarioId/foto')
export class FotosController {
  constructor(private readonly fotos: FotosService) {}

  /**
   * GET /api/funcionarios/:funcionarioId/foto  La imagen descifrada (404 SIN_FOTOGRAFIA si no tiene).
   * Sin limite de peticiones por minuto: la lista de funcionarios pide una foto por fila
   * y toda la lista junta pasaria el limite general. El permiso se sigue revisando.
   */
  @SkipThrottle()
  @Get()
  async ver(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const foto = await this.fotos.ver(funcionarioId, quienActua);
    respuesta.set({
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-cache',
    });
    return new StreamableFile(foto.contenido, { type: foto.mime, length: foto.contenido.length });
  }

  /** PUT /api/funcionarios/:funcionarioId/foto  (multipart, campo "archivo": JPG o PNG hasta 5 MB) */
  @Put()
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_FOTO, files: 1, fields: 0 } }))
  cambiar(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ tieneFoto: true }> {
    return this.fotos.cambiar(funcionarioId, archivo, quienActua, direccionIp);
  }

  /** DELETE /api/funcionarios/:funcionarioId/foto  Quita la foto (el archivo no se borra del disco). */
  @Delete()
  quitar(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ tieneFoto: false }> {
    return this.fotos.quitar(funcionarioId, quienActua, direccionIp);
  }
}
