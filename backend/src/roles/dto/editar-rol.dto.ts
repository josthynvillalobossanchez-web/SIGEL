import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { recortar } from './crear-rol.dto.js';

/**
 * Pagina "Editar rol": nombre, descripcion y/o la lista COMPLETA de permisos
 * de un rol que no sea de sistema. Todo es opcional, pero debe venir al
 * menos una cosa (lo revisa el servicio). Se guarda todo junto o nada.
 * Para quitar la descripcion se envia "descripcion": "".
 */
export class EditarRolDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre del rol debe ser texto.' })
  @Length(3, 60, { message: 'El nombre del rol debe tener entre 3 y 60 caracteres.' })
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string;

  /** Lista COMPLETA de permisos que debe quedar (lo que no venga se quita). */
  @IsOptional()
  @IsArray({ message: 'Los permisos deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'El rol debe tener al menos un permiso.' })
  @ArrayMaxSize(100, { message: 'No se pueden indicar más de 100 permisos.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los permisos indicados no es válido.' })
  permisoIds?: string[];
}
