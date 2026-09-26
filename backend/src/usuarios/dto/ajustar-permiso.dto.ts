import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Permiso individual de una cuenta: una excepcion a lo que dan sus roles.
 *
 *   otorgado = true   concede el permiso aunque ningun rol lo de.
 *                     Ejemplo: que una Solicitante pueda ver la lista de
 *                     funcionarios mientras cubre a su jefatura.
 *   otorgado = false  lo quita aunque un rol si lo de.
 *                     Ejemplo: un Administrador que no debe dar de baja
 *                     documentos mientras dura una investigacion.
 *
 * Con fecha de vencimiento la excepcion deja de contar sola ese dia.
 */
export class AjustarPermisoDto {
  @IsBoolean({ message: 'Indique si el permiso se concede (true) o se quita (false).' })
  otorgado!: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento del permiso no es válida.' })
  fechaVencimiento?: string;

  /** Por que se hizo la excepcion. Queda en la cuenta y en la bitacora. */
  @IsOptional()
  @IsString({ message: 'La observación debe ser texto.' })
  @MaxLength(255, { message: 'La observación no puede pasar de 255 caracteres.' })
  observacion?: string;
}
