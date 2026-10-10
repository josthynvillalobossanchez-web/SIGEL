import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TAMANO_MAXIMO_DOCUMENTO, type ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { cabeceraDeNombre } from '../documentos/documentos.controller.js';
import type { ArchivoAbierto } from '../documentos/documentos.service.js';
import { CrearSolicitudDto } from '../vacaciones/dto/solicitudes.dto.js';
import type { SolicitudDeLista } from '../vacaciones/solicitudes.service.js';
import { CapacitacionesService, type CapacitacionDeLista } from './capacitaciones.service.js';
import { ConstanciasService } from './constancias.service.js';
import {
  AnularDto,
  ConsultarCapacitacionesDto,
  ConsultarHorasExtraDto,
  ConsultarIncapacidadesDto,
  RegistrarCapacitacionDto,
  RegistrarHoraExtraDto,
  RegistrarIncapacidadDto,
} from './dto.js';
import { HorasExtraService, type HoraExtraDeLista, type ResumenDeHorasExtra } from './horas-extra.service.js';
import { IncapacidadesService, type IncapacidadDeLista } from './incapacidades.service.js';
import { JustificantesService } from './justificantes.service.js';

const SUBIDA = (campo: string) => FileInterceptor(campo, { limits: { fileSize: TAMANO_MAXIMO_DOCUMENTO, files: 1, fields: 15 } });

/** Entrega un archivo con las mismas cabeceras seguras que la gestion documental. */
function entregar(archivo: ArchivoAbierto, respuesta: Response): StreamableFile {
  respuesta.set({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store' });
  return new StreamableFile(archivo.contenido, { type: archivo.mime, disposition: cabeceraDeNombre('inline', archivo.nombre), length: archivo.contenido.length });
}

/** Lo que las solicitudes necesitan de la gestion documental: justificante y constancia. */
@Controller('solicitudes')
export class SolicitudesConDocumentosController {
  constructor(
    private readonly justificantes: JustificantesService,
    private readonly constancias: ConstanciasService,
  ) {}

  /**
   * POST /api/solicitudes/con-justificante  (multipart: campo "justificante" + los de una solicitud)
   * Para los tipos que piden justificante (licencias). Mismos errores que POST /solicitudes,
   * mas los del archivo (ARCHIVO_REQUERIDO, FORMATO_NO_PERMITIDO_PARA_TIPO...).
   */
  @RequierePermisos('solicitudes.crear')
  @Post('con-justificante')
  @UseInterceptors(SUBIDA('justificante'))
  crearConJustificante(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() datos: CrearSolicitudDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<SolicitudDeLista> {
    return this.justificantes.crearConJustificante(datos, archivo, quienActua, direccionIp);
  }

  /** GET /api/solicitudes/:id/justificante  Lo ve quien ve la solicitud (la jefatura incluida). */
  @RequierePermisos('solicitudes.crear')
  @Get(':id/justificante')
  async justificante(
    @Param('id', uuidValido('solicitud')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    return entregar(await this.justificantes.abrir(id, quienActua, direccionIp), respuesta);
  }

  /** POST /api/solicitudes/:id/constancia  Reintenta la constancia que fallo (RRHH o quien aprobo). */
  @RequierePermisos('solicitudes.crear')
  @Post(':id/constancia')
  @HttpCode(HttpStatus.OK)
  reintentarConstancia(@Param('id', uuidValido('solicitud')) id: string, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<{ generada: boolean }> {
    return this.constancias.reintentar(id, quienActua);
  }
}

/** Incapacidades: sin aprobacion; la boleta es obligatoria. */
@Controller('incapacidades')
export class IncapacidadesController {
  constructor(private readonly incapacidades: IncapacidadesService) {}

  @RequierePermisos('solicitudes.crear')
  @Get('tipos')
  tipos() {
    return this.incapacidades.tipos();
  }

  @RequierePermisos('solicitudes.crear')
  @Get('mias')
  mias(@Query() filtros: ConsultarIncapacidadesDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<IncapacidadDeLista>> {
    return this.incapacidades.mias(filtros, quienActua);
  }

  /** GET /api/incapacidades  Todas (RRHH), con filtros. */
  @RequierePermisos('solicitudes.administrar')
  @Get()
  todas(@Query() filtros: ConsultarIncapacidadesDto): Promise<PaginaDeResultados<IncapacidadDeLista>> {
    return this.incapacidades.todas(filtros);
  }

  @RequierePermisos('solicitudes.crear')
  @Get(':id')
  detalle(@Param('id', uuidValido('incapacidad')) id: string, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<IncapacidadDeLista> {
    return this.incapacidades.detalle(id, quienActua);
  }

  /**
   * POST /api/incapacidades  (multipart: campo "boleta" + datos)
   * La persona registra la suya; RRHH, la de cualquiera. Devuelve avisos si
   * coincide con vacaciones o permisos (no se bloquea).
   * Errores: INCAPACIDAD_AJENA, TIPO_INCAPACIDAD_INVALIDO, RANGO_NO_VALIDO,
   * INCAPACIDAD_TRASLAPADA, FUNCIONARIO_INACTIVO y los del archivo.
   */
  @RequierePermisos('solicitudes.crear')
  @Post()
  @UseInterceptors(SUBIDA('boleta'))
  registrar(
    @UploadedFile() boleta: ArchivoSubido | undefined,
    @Body() datos: RegistrarIncapacidadDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ incapacidad: IncapacidadDeLista; avisos: string[] }> {
    return this.incapacidades.registrar(datos, boleta, quienActua, direccionIp);
  }

  /** POST /api/incapacidades/:id/anular  { motivo }  (RRHH) */
  @RequierePermisos('solicitudes.administrar')
  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  anular(
    @Param('id', uuidValido('incapacidad')) id: string,
    @Body() datos: AnularDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<IncapacidadDeLista> {
    return this.incapacidades.anular(id, datos, quienActua, direccionIp);
  }
}

/** Capacitaciones del expediente (autoservicio y RRHH). */
@Controller('capacitaciones')
export class CapacitacionesController {
  constructor(private readonly capacitaciones: CapacitacionesService) {}

  /** GET /api/capacitaciones?funcionarioId=  La propia persona o RRHH. */
  @RequierePermisos('expediente.ver')
  @Get()
  listar(@Query() filtros: ConsultarCapacitacionesDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<CapacitacionDeLista[]> {
    return this.capacitaciones.listar(filtros.funcionarioId, quienActua);
  }

  /** POST /api/capacitaciones  (multipart; "certificado" opcional). Si choca con el horario crea la solicitud. */
  @RequierePermisos('solicitudes.crear')
  @Post()
  @UseInterceptors(SUBIDA('certificado'))
  registrar(
    @UploadedFile() certificado: ArchivoSubido | undefined,
    @Body() datos: RegistrarCapacitacionDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<CapacitacionDeLista> {
    return this.capacitaciones.registrar(datos, certificado, quienActua, direccionIp);
  }

  @RequierePermisos('solicitudes.crear')
  @Post(':id/certificado')
  @UseInterceptors(SUBIDA('certificado'))
  certificado(
    @Param('id', uuidValido('capacitación')) id: string,
    @UploadedFile() certificado: ArchivoSubido | undefined,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<CapacitacionDeLista> {
    return this.capacitaciones.adjuntarCertificado(id, certificado, quienActua, direccionIp);
  }

  @RequierePermisos('solicitudes.crear')
  @Post(':id/baja')
  @HttpCode(HttpStatus.OK)
  baja(
    @Param('id', uuidValido('capacitación')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ mensaje: string }> {
    return this.capacitaciones.darDeBaja(id, quienActua, direccionIp);
  }
}

/** Horas extra: solo RRHH (horasExtra.registrar). */
@Controller('horas-extra')
export class HorasExtraController {
  constructor(private readonly horas: HorasExtraService) {}

  /** GET /api/horas-extra?mes=2026-10&funcionarioId=&departamentoId=&busqueda=&pagina=  Registros y totales del mes. */
  @RequierePermisos('horasExtra.registrar')
  @Get()
  consultar(@Query() filtros: ConsultarHorasExtraDto): Promise<ResumenDeHorasExtra> {
    return this.horas.consultar(filtros);
  }

  /** POST /api/horas-extra  { funcionarioId, fecha, horaInicio, horaFin, motivo? } */
  @RequierePermisos('horasExtra.registrar')
  @Post()
  registrar(@Body() datos: RegistrarHoraExtraDto, @UsuarioActual() quienActua: UsuarioAutenticado, @DireccionIp() direccionIp: string | undefined): Promise<HoraExtraDeLista> {
    return this.horas.registrar(datos, quienActua, direccionIp);
  }

  @RequierePermisos('horasExtra.registrar')
  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  anular(
    @Param('id', uuidValido('registro de horas extra')) id: string,
    @Body() datos: AnularDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<HoraExtraDeLista> {
    return this.horas.anular(id, datos, quienActua, direccionIp);
  }
}
