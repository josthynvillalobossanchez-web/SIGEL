import { IsBoolean } from 'class-validator';

/** Activar (true) o inactivar (false) un rol que no sea de sistema. */
export class CambiarEstadoRolDto {
  @IsBoolean({ message: 'Indique si el rol queda activo (true) o inactivo (false).' })
  activo!: boolean;
}
