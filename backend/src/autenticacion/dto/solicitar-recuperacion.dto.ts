import { IsEmail, MaxLength } from 'class-validator';

/**
 * Datos para pedir un codigo de recuperacion de contrasena.
 *
 * Solo el correo. La respuesta es siempre la misma exista o no la cuenta,
 * para no confirmarle a nadie que direcciones estan registradas.
 */
export class SolicitarRecuperacionDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(150)
  correo!: string;
}
