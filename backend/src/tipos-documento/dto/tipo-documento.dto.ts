import { Transform } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

const MENSAJE_FORMATOS = 'Elija al menos un formato (pdf, jpg o png), sin repetir.';

/** Crear un tipo de documento manual. Los que genera SINERGIA nacen con el proceso que los produce. */
export class CrearTipoDocumentoDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;

  /** Formatos que acepta: subconjunto de pdf, jpg y png. */
  @IsArray({ message: MENSAJE_FORMATOS })
  @ArrayNotEmpty({ message: MENSAJE_FORMATOS })
  @ArrayUnique(undefined, { message: MENSAJE_FORMATOS })
  @IsIn(['pdf', 'jpg', 'png'], { each: true, message: MENSAJE_FORMATOS })
  formatos!: ('pdf' | 'jpg' | 'png')[];
}

/** Editar nombre, descripcion y/o formatos. En un tipo de SINERGIA solo se puede cambiar el nombre. */
export class EditarTipoDocumentoDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;

  @IsOptional()
  @IsArray({ message: MENSAJE_FORMATOS })
  @ArrayNotEmpty({ message: MENSAJE_FORMATOS })
  @ArrayUnique(undefined, { message: MENSAJE_FORMATOS })
  @IsIn(['pdf', 'jpg', 'png'], { each: true, message: MENSAJE_FORMATOS })
  formatos?: ('pdf' | 'jpg' | 'png')[];
}
