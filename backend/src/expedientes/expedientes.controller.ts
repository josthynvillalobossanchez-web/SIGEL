import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { PaginacionDto, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { ExpedientesService, type Expediente, type MovimientoDelHistorial } from './expedientes.service.js';

/**
 * Expediente laboral (pgExpediente del prototipo).
 *
 * Quien lo abre (decision de Josthyn, 28/09): cada persona el SUYO (permiso
 * expediente.ver, que tienen todos los roles) y solo Recursos Humanos el de
 * los demas (expediente.verTodos). Son documentos delicados: ni la jefatura
 * (Aprobador) ni Consulta abren expedientes ajenos.
 *
 * Abrir un expediente SI se anota en la bitacora (T-4), el propio tambien.
 * Pedir el historial no se anota aparte: es parte del expediente ya abierto.
 */
@Controller('expedientes')
export class ExpedientesController {
  constructor(private readonly expedientes: ExpedientesService) {}

  /** GET /api/expedientes/propio  El expediente de quien tiene la sesion ("Mi expediente"). */
  @RequierePermisos('expediente.ver')
  @Get('propio')
  abrirPropio(@UsuarioActual() quienActua: UsuarioAutenticado, @DireccionIp() direccionIp: string | undefined): Promise<Expediente> {
    return this.expedientes.abrir(this.expedientes.idPropio(quienActua), quienActua, direccionIp);
  }

  /** GET /api/expedientes/:funcionarioId  Expediente de un funcionario (el propio o, para RRHH, cualquiera). */
  @RequierePermisos('expediente.ver')
  @Get(':funcionarioId')
  abrir(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<Expediente> {
    return this.expedientes.abrir(funcionarioId, quienActua, direccionIp);
  }

  /**
   * GET /api/expedientes/:funcionarioId/historial?pagina=1&tamano=20
   * Historial laboral: linea de tiempo, lo mas reciente primero.
   */
  @RequierePermisos('expediente.ver')
  @Get(':funcionarioId/historial')
  historial(
    @Param('funcionarioId', uuidValido('funcionario')) funcionarioId: string,
    @Query() paginacion: PaginacionDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<MovimientoDelHistorial>> {
    return this.expedientes.historial(funcionarioId, paginacion, quienActua);
  }
}
