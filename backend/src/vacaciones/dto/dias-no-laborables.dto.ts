import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { REGLAS_DE_FERIADO, type ReglaDeFeriado } from '../feriados.js';

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** GET /dias-no-laborables/fechas?anio=2026 */
export class ConsultarFechasDto {
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero.' })
  @Min(2000, { message: 'El año no es válido.' })
  @Max(2100, { message: 'El año no es válido.' })
  anio!: number;
}

/**
 * Un feriado del catalogo. Segun la regla:
 *   fija  -> mes y dia (se repite cada anio)
 *   unica -> fecha AAAA-MM-DD (solo ese dia)
 *   juevesSanto / viernesSanto -> nada mas (se calcula con la Pascua)
 */
export class CrearDiaNoLaborableDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre!: string;

  @IsIn(REGLAS_DE_FERIADO, { message: 'Indique si se repite cada año, si es una sola vez o si es de Semana Santa.' })
  regla!: ReglaDeFeriado;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número del 1 al 12.' })
  @Min(1, { message: 'El mes debe ser un número del 1 al 12.' })
  @Max(12, { message: 'El mes debe ser un número del 1 al 12.' })
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día debe ser un número del 1 al 31.' })
  @Min(1, { message: 'El día debe ser un número del 1 al 31.' })
  @Max(31, { message: 'El día debe ser un número del 1 al 31.' })
  dia?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  fecha?: string;
}

export class EditarDiaNoLaborableDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsIn(REGLAS_DE_FERIADO, { message: 'Indique si se repite cada año, si es una sola vez o si es de Semana Santa.' })
  regla?: ReglaDeFeriado;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número del 1 al 12.' })
  @Min(1, { message: 'El mes debe ser un número del 1 al 12.' })
  @Max(12, { message: 'El mes debe ser un número del 1 al 12.' })
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El día debe ser un número del 1 al 31.' })
  @Min(1, { message: 'El día debe ser un número del 1 al 31.' })
  @Max(31, { message: 'El día debe ser un número del 1 al 31.' })
  dia?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  fecha?: string;

  @IsOptional()
  @IsBoolean({ message: 'Indique si el día está activo (sí o no).' })
  activo?: boolean;
}
