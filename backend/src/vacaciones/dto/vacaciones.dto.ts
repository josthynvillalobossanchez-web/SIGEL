import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Movimientos del saldo (solo paginacion). */
export class ConsultarMovimientosDto extends PaginacionDto {}

/**
 * Saldo inicial (si todavia no hay) o ajuste de RRHH. Solo dias completos.
 * El motivo es obligatorio: el ajuste queda en el historial del saldo y en
 * la bitacora.
 */
export class AjustarSaldoDto {
  @Type(() => Number)
  @IsInt({ message: 'Los días deben ser un número entero (no se manejan medios días).' })
  @Min(-365, { message: 'El ajuste no puede ser menor a -365 días.' })
  @Max(365, { message: 'El ajuste no puede ser mayor a 365 días.' })
  dias!: number;

  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto.' })
  @Length(5, 500, { message: 'Explique el motivo del ajuste (entre 5 y 500 caracteres).' })
  motivo!: string;
}
