import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import { Publico, RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { cabeceraDeNombre } from '../documentos/documentos.controller.js';
import { RegistrarFuncionarioDto } from '../funcionarios/dto/datos-de-funcionario.dto.js';
import { CambiarCandidatoDto, ConsultarCandidatosDto, EditarHabilidadDto, EliminarCandidatoDto, EnvioPublicoDto, HabilidadDto } from './dto.js';
import { TalentPoolService } from './talent-pool.service.js';

/**
 * Formulario PUBLICO del Talent Pool (sin cuenta). Nunca devuelve datos de
 * personas: solo lo necesario para llenar el formulario.
 */
@Publico()
@Controller('talent-pool/publico')
export class TalentPoolPublicoController {
  constructor(private readonly talentPool: TalentPoolService) {}

  /** GET /api/talent-pool/publico/formulario  Consentimiento vigente, profesiones, habilidades y niveles. */
  @Get('formulario')
  formulario() {
    return this.talentPool.formulario();
  }

  /**
   * POST /api/talent-pool/publico/registro  (multipart: "datos" = JSON del formulario; "curriculum" = PDF opcional)
   * Si la cedula ya existe, REEMPLAZA el registro completo. La respuesta es la
   * misma en los dos casos. Limite estrecho por IP: es un formulario abierto.
   */
  @Post('registro')
  @HttpCode(HttpStatus.OK)
  // 5 envios cada 10 minutos por IP (TALENT_POOL_ENVIOS_POR_IP lo cambia; las pruebas lo suben).
  @Throttle({ default: { limit: () => Number(process.env.TALENT_POOL_ENVIOS_POR_IP ?? 5), ttl: 600_000 } })
  @UseInterceptors(FileInterceptor('curriculum', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 } }))
  registrar(@Body() cuerpo: EnvioPublicoDto, @UploadedFile() archivo: ArchivoSubido | undefined, @DireccionIp() direccionIp: string | undefined) {
    return this.talentPool.registrarPublico(cuerpo.datos, archivo, direccionIp);
  }
}

/** Talent Pool para Recursos Humanos: unico con acceso a los perfiles (Ficha 34). */
@Controller('talent-pool')
export class TalentPoolController {
  constructor(private readonly talentPool: TalentPoolService) {}

  /** GET /api/talent-pool/candidatos?busqueda&estado&profesionId&nivel&habilidades=a,b&aniosExperiencia&conCurriculum&orden&pagina&tamano */
  @RequierePermisos('talentPool.ver')
  @Get('candidatos')
  consultar(@Query() filtros: ConsultarCandidatosDto) {
    return this.talentPool.consultar(filtros);
  }

  @RequierePermisos('talentPool.ver')
  @Get('resumen')
  resumen() {
    return this.talentPool.resumen();
  }

  @RequierePermisos('talentPool.ver')
  @Get('opciones')
  opciones() {
    return this.talentPool.opciones();
  }

  @RequierePermisos('talentPool.ver')
  @Get('candidatos/:id')
  detalle(@Param('id', uuidValido('candidato')) id: string) {
    return this.talentPool.detalle(id);
  }

  /** GET /api/talent-pool/candidatos/:id/curriculum  El PDF, descifrado (queda en la bitacora). */
  @RequierePermisos('talentPool.ver')
  @Get('candidatos/:id/curriculum')
  async curriculum(
    @Param('id', uuidValido('candidato')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.talentPool.abrirCurriculum(id, quienActua, direccionIp);
    respuesta.set({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store' });
    return new StreamableFile(archivo.contenido, { type: archivo.mime, disposition: cabeceraDeNombre('inline', archivo.nombre), length: archivo.contenido.length });
  }

  /** PATCH /api/talent-pool/candidatos/:id  { estado?: activo|inactivo|descartado, notaInterna? } */
  @RequierePermisos('talentPool.ver', 'talentPool.administrar')
  @Patch('candidatos/:id')
  cambiar(
    @Param('id', uuidValido('candidato')) id: string,
    @Body() datos: CambiarCandidatoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ) {
    return this.talentPool.cambiar(id, datos, quienActua, direccionIp);
  }

  /** POST /api/talent-pool/candidatos/:id/eliminar  { motivo }  A pedido de la persona (Ley 8968). */
  @RequierePermisos('talentPool.ver', 'talentPool.administrar')
  @Post('candidatos/:id/eliminar')
  @HttpCode(HttpStatus.OK)
  eliminar(
    @Param('id', uuidValido('candidato')) id: string,
    @Body() datos: EliminarCandidatoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ) {
    return this.talentPool.eliminar(id, datos, quienActua, direccionIp);
  }

  /** GET /api/talent-pool/candidatos/:id/para-contratar  Datos personales para prellenar Registrar funcionario. */
  @RequierePermisos('talentPool.ver', 'talentPool.administrar', 'funcionarios.crear')
  @Get('candidatos/:id/para-contratar')
  paraContratar(@Param('id', uuidValido('candidato')) id: string) {
    return this.talentPool.datosParaContratar(id);
  }

  /**
   * POST /api/talent-pool/candidatos/:id/contratar  (cuerpo = el de Registrar funcionario)
   * Crea el funcionario (y la cuenta, si se pide), marca al candidato como
   * contratado y copia el curriculum al expediente. Errores propios:
   * CANDIDATO_YA_CONTRATADO, CEDULA_NO_COINCIDE y los de registrar un funcionario.
   */
  @RequierePermisos('talentPool.ver', 'talentPool.administrar', 'funcionarios.ver', 'funcionarios.crear')
  @Post('candidatos/:id/contratar')
  contratar(
    @Param('id', uuidValido('candidato')) id: string,
    @Body() datos: RegistrarFuncionarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ) {
    return this.talentPool.contratar(id, datos, quienActua, direccionIp);
  }

  /* --- Habilidades --- */
  @RequierePermisos('talentPool.ver')
  @Get('habilidades')
  habilidades() {
    return this.talentPool.habilidades();
  }

  @RequierePermisos('talentPool.ver', 'talentPool.administrar')
  @Post('habilidades')
  crearHabilidad(@Body() datos: HabilidadDto, @UsuarioActual() quienActua: UsuarioAutenticado, @DireccionIp() direccionIp: string | undefined) {
    return this.talentPool.crearHabilidad(datos, quienActua, direccionIp);
  }

  @RequierePermisos('talentPool.ver', 'talentPool.administrar')
  @Patch('habilidades/:id')
  editarHabilidad(
    @Param('id', uuidValido('habilidad')) id: string,
    @Body() datos: EditarHabilidadDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ) {
    return this.talentPool.editarHabilidad(id, datos, quienActua, direccionIp);
  }
}
