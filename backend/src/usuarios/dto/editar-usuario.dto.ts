import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, MaxLength, ValidateNested } from 'class-validator';
import { RolAsignadoDto } from './crear-usuario.dto.js';

/**
 * Datos de la ventana "Editar usuario". Los dos son opcionales, pero debe
 * venir al menos uno (lo revisa el servicio).
 *
 *   correo  el correo de ingreso.
 *   roles   la lista COMPLETA de roles que debe quedar teniendo la cuenta,
 *           cada uno con su fecha de vencimiento opcional. Lo que no venga
 *           se le quita; lo nuevo se le asigna; lo que venga con otra fecha
 *           cambia de vigencia. Debe quedar al menos un rol permanente.
 *
 * Lo demas tiene su propio camino:
 *   - estado             PATCH /usuarios/:id/estado
 *   - permisos sueltos   PUT / DELETE /usuarios/:id/permisos/:permisoId
 *   - contrasena         la cambia solo su duenio (o TI con el script
 *                        contrasena:restablecer). Nadie la escribe por otro.
 *   - funcionario        no se cambia: la cuenta nace ligada a una persona y
 *                        muere ligada a ella (decision del 24/09/2026).
 */
export class EditarUsuarioDto {
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede pasar de 150 caracteres.' })
  correo?: string;

  @IsOptional()
  @IsArray({ message: 'Los roles deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'La cuenta debe tener al menos un rol.' })
  @ArrayMaxSize(10, { message: 'No se pueden asignar más de 10 roles a la vez.' })
  @ValidateNested({ each: true })
  @Type(() => RolAsignadoDto)
  roles?: RolAsignadoDto[];
}
