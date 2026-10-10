import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Un tramo: desde cuantos anios cumplidos aplica, hasta cuantos (null = en adelante) y cuantos dias da. */
export class TramoDto {
  @IsInt({ message: 'Los años deben ser números enteros.' })
  @Min(0, { message: 'Los años no pueden ser negativos.' })
  @Max(60, { message: 'Los años no pueden pasar de 60.' })
  aniosMinimos!: number;

  @IsOptional()
  @IsInt({ message: 'Los años deben ser números enteros.' })
  @Min(0, { message: 'Los años no pueden ser negativos.' })
  @Max(60, { message: 'Los años no pueden pasar de 60.' })
  aniosMaximos?: number | null;

  @IsInt({ message: 'Los días por periodo son días completos (números enteros).' })
  @Min(1, { message: 'Cada tramo debe dar al menos 1 día.' })
  @Max(60, { message: 'Un tramo no puede dar más de 60 días por periodo.' })
  diasPorPeriodo!: number;
}

/** PUT /reglas-vacaciones/:regimenId */
export class GuardarRegimenDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @Length(0, 255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;

  @IsInt({ message: 'El tope de periodos debe ser un número entero.' })
  @Min(1, { message: 'El tope debe ser de al menos 1 periodo.' })
  @Max(5, { message: 'El tope no puede pasar de 5 periodos.' })
  periodosMaximosAcumulables!: number;

  @IsInt({ message: 'Los días de aviso deben ser un número entero.' })
  @Min(0, { message: 'Los días de aviso no pueden ser negativos.' })
  @Max(365, { message: 'El aviso no puede ser de más de 365 días.' })
  diasAvisoAntesDeVencer!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos un tramo.' })
  @ArrayMaxSize(10, { message: 'No puede haber más de 10 tramos.' })
  @ValidateNested({ each: true })
  @Type(() => TramoDto)
  tramos!: TramoDto[];
}
