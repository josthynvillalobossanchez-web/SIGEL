import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Quita espacios al inicio y al final (lo que no sea texto lo rechaza @IsString). */
const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * Crear un departamento, un puesto o una profesion.
 *
 * El largo maximo exacto depende del catalogo (120 o 150); aqui se pone el
 * mayor y el servicio revisa el de cada uno.
 */
export class CrearElementoDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 150, { message: 'El nombre debe tener entre 2 y 150 caracteres.' })
  nombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;
}

/**
 * Cambiar nombre y/o descripcion. Los dos son opcionales, pero debe venir
 * al menos uno (lo revisa el servicio). Para quitar la descripcion se manda "".
 */
export class EditarElementoDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 150, { message: 'El nombre debe tener entre 2 y 150 caracteres.' })
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;
}

/** Activar (true) o inactivar (false). */
export class CambiarEstadoElementoDto {
  @IsBoolean({ message: 'Indique si queda activo (true) o inactivo (false).' })
  activo!: boolean;
}
