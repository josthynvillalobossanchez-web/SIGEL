import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { DiasNoLaborablesService, type DiaNoLaborable } from './dias-no-laborables.service.js';
import {
  ConsultarDiasNoLaborablesDto,
  CrearDiaNoLaborableDto,
  EditarDiaNoLaborableDto,
  ProponerAnioDto,
} from './dto/dias-no-laborables.dto.js';
import {
  ConsultarCalendarioDto,
  ConsultarSolicitudesDto,
  CrearSolicitudDto,
  RechazarSolicitudDto,
} from './dto/solicitudes.dto.js';
import { AjustarSaldoDto, ConsultarMovimientosDto } from './dto/vacaciones.dto.js';
import { SolicitudesService, type SolicitudDeLista } from './solicitudes.service.js';
import { VacacionesService, type ResumenDeSaldo } from './vacaciones.service.js';

/** Saldo de vacaciones. */
@Controller('vacaciones')
export class VacacionesController {
  constructor(private readonly vacaciones: VacacionesService) {}

  /** GET /api/vacaciones/mi-saldo: acumulado, utilizado, disponible y aviso de vencimiento. */
  @RequierePermisos('solicitudes.crear')
  @Get('mi-saldo')
  miSaldo(@UsuarioActual() quienActua: UsuarioAutenticado): Promise<ResumenDeSaldo> {
    if (!quienActua.funcionarioId) {
      throw new BadRequestException({
        codigo: 'SIN_FUNCIONARIO',
        message: 'Su cuenta no está asociada a un funcionario, así que no tiene saldo de vacaciones.',
      });
    }
    return this.vacaciones.resumen(quienActua.funcionarioId);
  }

  /** GET /api/vacaciones/saldo/:funcionarioId  (la persona, su jefatura inmediata o RRHH). Error: SALDO_AJENO. */
  @RequierePermisos('solicitudes.crear')
  @Get('saldo/:funcionarioId')
  async saldo(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<ResumenDeSaldo> {
    await this.vacaciones.exigirAccesoAlSaldo(funcionarioId, quienActua);
    return this.vacaciones.resumen(funcionarioId);
  }

  /** GET /api/vacaciones/saldo/:funcionarioId/movimientos?pagina=1&tamano=20 */
  @RequierePermisos('solicitudes.crear')
  @Get('saldo/:funcionarioId/movimientos')
  async movimientos(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @Query() filtros: ConsultarMovimientosDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<unknown>> {
    await this.vacaciones.exigirAccesoAlSaldo(funcionarioId, quienActua);
    return this.vacaciones.movimientos(funcionarioId, filtros);
  }

  /**
   * POST /api/vacaciones/saldo/:funcionarioId/ajuste   { dias, motivo }
   * Carga el saldo inicial si todavia no existe; si existe, registra un
   * ajuste (+/-) con motivo. Solo RRHH (funcionarios.editar).
   * Errores: SALDO_NEGATIVO, SALDO_INICIAL_NEGATIVO.
   */
  @RequierePermisos('funcionarios.editar')
  @Post('saldo/:funcionarioId/ajuste')
  @HttpCode(HttpStatus.OK)
  ajustar(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @Body() datos: AjustarSaldoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<ResumenDeSaldo> {
    return this.vacaciones.ajustar(funcionarioId, datos, quienActua, direccionIp);
  }
}

/** Solicitudes de vacaciones, permisos, licencias y capacitaciones, y el calendario. */
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  /** GET /api/solicitudes/tipos: los tramites que se pueden pedir. */
  @RequierePermisos('solicitudes.crear')
  @Get('tipos')
  tipos(): Promise<unknown[]> {
    return this.solicitudes.tipos();
  }

  /** GET /api/solicitudes/mias?estado=&tipoSolicitudId=&desde=&hasta=&pagina=&tamano= */
  @RequierePermisos('solicitudes.crear')
  @Get('mias')
  mias(@Query() filtros: ConsultarSolicitudesDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<SolicitudDeLista>> {
    return this.solicitudes.mias(filtros, quienActua);
  }

  /** GET /api/solicitudes/bandeja: lo que le toca resolver a la jefatura (por omision, pendientes). */
  @RequierePermisos('solicitudes.aprobar')
  @Get('bandeja')
  bandeja(@Query() filtros: ConsultarSolicitudesDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<SolicitudDeLista>> {
    return this.solicitudes.bandeja(filtros, quienActua);
  }

  /** GET /api/solicitudes/todas: todas las del personal (RRHH). */
  @RequierePermisos('solicitudes.administrar')
  @Get('todas')
  todas(@Query() filtros: ConsultarSolicitudesDto): Promise<PaginaDeResultados<SolicitudDeLista>> {
    return this.solicitudes.todas(filtros);
  }

  /**
   * GET /api/solicitudes/calendario?desde=&hasta=&alcance=propio|equipo|todos[&departamentoId=]
   * Eventos (pendientes, aprobadas, rechazadas) y feriados del rango.
   * Error: CALENDARIO_NO_PERMITIDO, RANGO_NO_VALIDO.
   */
  @RequierePermisos('solicitudes.crear')
  @Get('calendario')
  calendario(@Query() filtros: ConsultarCalendarioDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<unknown> {
    return this.solicitudes.calendario(filtros, quienActua);
  }

  /** POST /api/solicitudes/calcular: vista previa (dias habiles, desglose, saldo). No guarda nada. */
  @RequierePermisos('solicitudes.crear')
  @Post('calcular')
  @HttpCode(HttpStatus.OK)
  calcular(@Body() datos: CrearSolicitudDto, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<unknown> {
    return this.solicitudes.calcular(datos, quienActua);
  }

  /**
   * POST /api/solicitudes   { tipoSolicitudId, fechaInicio, fechaFin, motivo?, funcionarioId?, justificanteDocumentoId? }
   * Errores: TIPO_SOLICITUD_INVALIDO, SOLICITUD_AJENA, SIN_FUNCIONARIO, FUNCIONARIO_NO_ENCONTRADO,
   * FUNCIONARIO_INACTIVO, JEFATURA_SIN_CUENTA, FECHA_NO_VALIDA, RANGO_NO_VALIDO, FECHA_PASADA,
   * SIN_DIAS_HABILES, SOLICITUD_TRASLAPADA, SALDO_NO_CARGADO, SALDO_INSUFICIENTE,
   * JUSTIFICANTE_INVALIDO, JUSTIFICANTE_REQUERIDO.
   */
  @RequierePermisos('solicitudes.crear')
  @Post()
  crear(
    @Body() datos: CrearSolicitudDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<SolicitudDeLista> {
    return this.solicitudes.crear(datos, quienActua, direccionIp);
  }

  /** GET /api/solicitudes/:id. La jefatura que la abre la marca como leida. Error: SOLICITUD_AJENA. */
  @RequierePermisos('solicitudes.crear')
  @Get(':id')
  detalle(@Param('id', uuidValido('solicitud')) id: string, @UsuarioActual() quienActua: UsuarioAutenticado): Promise<SolicitudDeLista> {
    return this.solicitudes.detalle(id, quienActua);
  }

  /** POST /api/solicitudes/:id/aprobar. Errores: SOLICITUD_AJENA, SOLICITUD_YA_RESUELTA, SALDO_INSUFICIENTE. */
  @RequierePermisos('solicitudes.aprobar')
  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  aprobar(
    @Param('id', uuidValido('solicitud')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<SolicitudDeLista> {
    return this.solicitudes.aprobar(id, quienActua, direccionIp);
  }

  /** POST /api/solicitudes/:id/rechazar   { motivo }. El motivo es obligatorio. */
  @RequierePermisos('solicitudes.aprobar')
  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  rechazar(
    @Param('id', uuidValido('solicitud')) id: string,
    @Body() datos: RechazarSolicitudDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<SolicitudDeLista> {
    return this.solicitudes.rechazar(id, datos, quienActua, direccionIp);
  }

  /** POST /api/solicitudes/:id/cancelar. Solo quien la hizo y solo si la jefatura no la ha abierto. */
  @RequierePermisos('solicitudes.crear')
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @Param('id', uuidValido('solicitud')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<SolicitudDeLista> {
    return this.solicitudes.cancelar(id, quienActua, direccionIp);
  }
}

/** Feriados y asuetos. Leer: cualquiera con solicitudes. Escribir: RRHH (catalogos.editar). */
@Controller('dias-no-laborables')
export class DiasNoLaborablesController {
  constructor(private readonly dias: DiasNoLaborablesService) {}

  /** GET /api/dias-no-laborables?anio=2026 */
  @RequierePermisos('solicitudes.crear')
  @Get()
  listar(@Query() filtros: ConsultarDiasNoLaborablesDto): Promise<DiaNoLaborable[]> {
    return this.dias.listar(filtros.anio);
  }

  /** POST /api/dias-no-laborables   { fecha, nombre, recurrenteAnual? }. Error: FECHA_YA_REGISTRADA. */
  @RequierePermisos('catalogos.editar')
  @Post()
  crear(
    @Body() datos: CrearDiaNoLaborableDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DiaNoLaborable> {
    return this.dias.crear(datos, quienActua, direccionIp);
  }

  /** POST /api/dias-no-laborables/proponer   { anio }: copia los recurrentes del anio anterior. */
  @RequierePermisos('catalogos.editar')
  @Post('proponer')
  @HttpCode(HttpStatus.OK)
  proponer(
    @Body() datos: ProponerAnioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DiaNoLaborable[]> {
    return this.dias.proponerAnio(datos.anio, quienActua, direccionIp);
  }

  /** PATCH /api/dias-no-laborables/:id   { nombre?, recurrenteAnual?, activo? } */
  @RequierePermisos('catalogos.editar')
  @Patch(':id')
  editar(
    @Param('id', uuidValido('día no laborable')) id: string,
    @Body() datos: EditarDiaNoLaborableDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DiaNoLaborable> {
    return this.dias.editar(id, datos, quienActua, direccionIp);
  }

  /** DELETE /api/dias-no-laborables/:id */
  @RequierePermisos('catalogos.editar')
  @Delete(':id')
  eliminar(
    @Param('id', uuidValido('día no laborable')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ mensaje: string }> {
    return this.dias.eliminar(id, quienActua, direccionIp);
  }
}
