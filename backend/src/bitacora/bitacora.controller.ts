import { Controller, Get, Query } from '@nestjs/common';
import { RequierePermisos } from '../autenticacion/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { BitacoraService } from './bitacora.service.js';
import { ConsultarBitacoraDto } from './dto/consultar-bitacora.dto.js';

/**
 * Consulta de la bitacora de auditoria.
 *
 * Aqui SOLO se lee. La bitacora se escribe desde los demas modulos cuando
 * ocurre la operacion que se esta auditando; no existe ni existira un
 * endpoint para crear, editar o borrar movimientos. Un registro de auditoria
 * que se puede modificar no sirve como evidencia.
 */
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  /**
   * GET /api/bitacora
   *
   * Lista los movimientos, del mas reciente al mas viejo, con filtros
   * opcionales por usuario, entidad, registro, funcionario, accion y rango
   * de fechas. Siempre paginado.
   *
   * Ejemplos:
   *   /api/bitacora?pagina=1&tamano=20
   *   /api/bitacora?entidad=documento&accion=descargar
   *   /api/bitacora?funcionarioAfectadoId=...&desde=2026-09-01
   *
   * Exige "bitacora.ver", que por decision de la Municipalidad tiene
   * unicamente el Super Administrador.
   */
  @RequierePermisos('bitacora.ver')
  @Get()
  consultar(@Query() filtros: ConsultarBitacoraDto): Promise<PaginaDeResultados<unknown>> {
    return this.bitacora.consultar(filtros);
  }
}
