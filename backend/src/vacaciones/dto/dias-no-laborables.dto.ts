import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ConsultarDiasNoLaborablesDto {
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero.' })
  @Min(2000, { message: 'El año no es válido.' })
  @Max(2100, { message: 'El año no es válido.' })
  anio!: number;
}

export class CrearDiaNoLaborableDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  fecha!: string;

  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre!: string;

  /** true = feriado de ley que se repite cada año; false = asueto de ese año. */
  @IsOptional()
  @IsBoolean({ message: 'Indique si se repite cada año (sí o no).' })
  recurrenteAnual?: boolean;
}

export class EditarDiaNoLaborableDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'Indique si se repite cada año (sí o no).' })
  recurrenteAnual?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Indique si el día está activo (sí o no).' })
  activo?: boolean;
}

export class ProponerAnioDto {
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero.' })
  @Min(2000, { message: 'El año no es válido.' })
  @Max(2100, { message: 'El año no es válido.' })
  anio!: number;
}
