import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * La lista COMPLETA de permisos que debe quedar teniendo el rol.
 * Lo que no venga en la lista se le quita; lo nuevo se le agrega.
 * (Mas simple y seguro que mandar "agregar" y "quitar" por separado.)
 */
export class ReemplazarPermisosRolDto {
  @IsArray({ message: 'Los permisos deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'El rol debe tener al menos un permiso.' })
  @ArrayMaxSize(100, { message: 'No se pueden indicar más de 100 permisos.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los permisos indicados no es válido.' })
  permisoIds!: string[];
}
