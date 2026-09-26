import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

/** Quita espacios al inicio y al final (y deja pasar lo que no sea texto, para que lo rechace @IsString). */
export const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * Datos para crear un rol nuevo (por ejemplo "Encargado de planillas").
 *
 * Los roles creados aqui NO son de sistema: se pueden renombrar, cambiarles
 * los permisos e inactivarlos. Los cinco roles de sistema los crea la
 * semilla y no se tocan desde la API.
 */
export class CrearRolDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre del rol debe ser texto.' })
  @Length(3, 60, { message: 'El nombre del rol debe tener entre 3 y 60 caracteres.' })
  nombre!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;

  /**
   * Identificadores de los permisos del rol (GET /api/permisos da el catalogo).
   * Al menos uno: un rol sin permisos no le sirve a nadie.
   */
  @IsArray({ message: 'Los permisos deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'El rol debe tener al menos un permiso.' })
  @ArrayMaxSize(100, { message: 'No se pueden indicar más de 100 permisos.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los permisos indicados no es válido.' })
  permisoIds!: string[];
}
