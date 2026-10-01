import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { TAMANO_MAXIMO_DOCUMENTO, type ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import {
  AbrirArchivoDto,
  ConsultarDocumentosDto,
  DarDeBajaDocumentoDto,
  EditarDocumentoDto,
  SubirDocumentoDto,
} from './dto/documentos.dto.js';
import { DocumentosService, type DocumentoDeLista } from './documentos.service.js';

/**
 * Documentos DENTRO de un expediente: listar y subir.
 *
 * El acceso al expediente (el propio, o cualquiera para Recursos Humanos) lo
 * revisa el servicio, igual que al abrir el expediente.
 */
@Controller('expedientes/:funcionarioId/documentos')
export class ExpedienteDocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  /**
   * GET /api/expedientes/:funcionarioId/documentos?pagina=1&tamano=20
   *     &tipoDocumentoId=...&busqueda=...&estado=vigentes|bajas|todos
   * Lista paginada, lo mas reciente primero. "estado" solo lo respeta para
   * quien puede restaurar (RRHH); los demas siempre ven los vigentes.
   */
  @RequierePermisos('expediente.ver')
  @Get()
  listar(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @Query() filtros: ConsultarDocumentosDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<PaginaDeResultados<DocumentoDeLista>> {
    return this.documentos.listar(funcionarioId, filtros, quienActua, direccionIp);
  }

  /**
   * POST /api/expedientes/:funcionarioId/documentos   (multipart/form-data)
   * Campos: archivo (el PDF, JPG o PNG), tipoDocumentoId, titulo,
   * descripcion y fechaDocumento (opcionales).
   * Errores propios: ARCHIVO_REQUERIDO, ARCHIVO_VACIO, ARCHIVO_DEMASIADO_GRANDE,
   * FORMATO_NO_PERMITIDO, FORMATO_NO_PERMITIDO_PARA_TIPO, MIME_NO_COINCIDE,
   * CONTENIDO_NO_COINCIDE, TIPO_DOCUMENTO_INVALIDO, TIPO_GENERADO_POR_SISTEMA,
   * TIPO_DOCUMENTO_INACTIVO, FECHA_NO_VALIDA, EXPEDIENTE_AJENO.
   */
  @RequierePermisos('documentos.crear')
  @Post()
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: TAMANO_MAXIMO_DOCUMENTO, files: 1, fields: 10 } }))
  subir(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() datos: SubirDocumentoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DocumentoDeLista> {
    return this.documentos.subir(funcionarioId, archivo, datos, quienActua, direccionIp);
  }
}

/**
 * Un documento en particular: abrir el archivo, editar, dar de baja y
 * restaurar. Editar y dar de baja no piden un permiso fijo en la ruta: el
 * servicio decide por documento (la persona, solo lo que subio ella; RRHH,
 * cualquiera).
 */
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  /**
   * GET /api/documentos/:id/archivo?modo=ver|descargar
   * Entrega el archivo descifrado. Siempre pasa por aqui (la carpeta de
   * archivos no es publica) y queda en la bitacora. Las cabeceras impiden
   * que el navegador lo interprete como pagina o lo ejecute.
   */
  @RequierePermisos('documentos.descargar')
  @Get(':id/archivo')
  async abrirArchivo(
    @Param('id', uuidValido('documento')) id: string,
    @Query() consulta: AbrirArchivoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.documentos.abrirArchivo(id, consulta.modo ?? 'descargar', quienActua, direccionIp);
    respuesta.set({
      // Nunca dejar que el navegador adivine el tipo ni que lo ejecute.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // Documentos de expediente: no se guardan copias en el navegador ni en proxys.
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(archivo.contenido, {
      type: archivo.mime,
      disposition: cabeceraDeNombre(archivo.modo === 'ver' ? 'inline' : 'attachment', archivo.nombre),
      length: archivo.contenido.length,
    });
  }

  /** PATCH /api/documentos/:id  Titulo, tipo, descripcion y/o fecha (el archivo no se reemplaza). */
  @Patch(':id')
  editar(
    @Param('id', uuidValido('documento')) id: string,
    @Body() datos: EditarDocumentoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DocumentoDeLista> {
    return this.documentos.editar(id, datos, quienActua, direccionIp);
  }

  /** POST /api/documentos/:id/baja  { "motivo": "archivo equivocado" }  Baja logica: no borra nada. */
  @Post(':id/baja')
  darDeBaja(
    @Param('id', uuidValido('documento')) id: string,
    @Body() datos: DarDeBajaDocumentoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DocumentoDeLista | { id: string; vigente: false }> {
    return this.documentos.darDeBaja(id, datos, quienActua, direccionIp);
  }

  /** POST /api/documentos/:id/restauracion  Solo Recursos Humanos. */
  @RequierePermisos('documentos.restaurar')
  @Post(':id/restauracion')
  restaurar(
    @Param('id', uuidValido('documento')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DocumentoDeLista> {
    return this.documentos.restaurar(id, quienActua, direccionIp);
  }
}

/** Content-Disposition seguro: nombre ASCII de respaldo y el real en UTF-8 (RFC 5987). */
export function cabeceraDeNombre(tipo: 'inline' | 'attachment', nombre: string): string {
  const respaldo = nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${tipo}; filename="${respaldo}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}
