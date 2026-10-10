import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

const vacioEsNada = ({ value }: { value: unknown }): unknown => {
  const limpio = typeof value === 'string' ? value.trim() : value;
  return limpio === '' ? undefined : limpio;
};
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "documentos" agrupa documento agregado, dado de baja y restaurado. */
export const TIPOS_DE_HISTORIAL = ['ingreso', 'cambio', 'salida', 'reingreso', 'documentos'] as const;

/** GET /expedientes/:id/historial  (filtros del 10/10). */
export class ConsultarHistorialDto extends PaginacionDto {
  @IsOptional()
  @Transform(vacioEsNada)
  @IsIn(TIPOS_DE_HISTORIAL, { message: 'El tipo de movimiento no es válido.' })
  tipo?: (typeof TIPOS_DE_HISTORIAL)[number];

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "desde" debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  /** Texto libre: busca en el titulo, los cambios, el detalle y quien lo hizo. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 100)
  busqueda?: string;
}
