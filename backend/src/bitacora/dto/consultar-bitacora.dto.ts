import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';
import type { AccionDeBitacora } from '../bitacora.service.js';

/** Las mismas acciones que el servicio puede registrar. */
const ACCIONES: AccionDeBitacora[] = [
  'crear',
  'modificar',
  'eliminar',
  'aprobar',
  'rechazar',
  'cancelar',
  'consultar',
  'descargar',
];

/**
 * Filtros de la pantalla de auditoria. Todos opcionales: sin ninguno, se
 * devuelve la bitacora completa, siempre paginada.
 *
 * Hereda pagina y tamano de PaginacionDto.
 */
export class ConsultarBitacoraDto extends PaginacionDto {
  /** Quien hizo el movimiento. */
  @IsOptional()
  @IsUUID(undefined, { message: 'El usuario indicado no es valido.' })
  usuarioId?: string;

  /** Sobre que tabla o concepto: "usuario", "documento", "funcionario"... */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entidad?: string;

  /** Para seguir la historia completa de un registro concreto. */
  @IsOptional()
  @IsUUID(undefined, { message: 'El registro indicado no es valido.' })
  registroAfectadoId?: string;

  /** Todo lo que se hizo sobre el expediente de una persona. */
  @IsOptional()
  @IsUUID(undefined, { message: 'El funcionario indicado no es valido.' })
  funcionarioAfectadoId?: string;

  @IsOptional()
  @IsIn(ACCIONES, { message: 'La accion indicada no existe.' })
  accion?: AccionDeBitacora;

  /** Fecha inicial, en formato ISO (2026-09-01 o 2026-09-01T08:00:00Z). */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha inicial no es valida.' })
  desde?: string;

  /** Fecha final, inclusive. */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha final no es valida.' })
  hasta?: string;
}
