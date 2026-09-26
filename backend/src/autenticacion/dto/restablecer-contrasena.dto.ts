import { IsEmail, Length, MaxLength } from 'class-validator';
import { EsContrasenaValida } from '../politica-contrasena.js';

/**
 * Datos para restablecer la contrasena con el codigo que llego al correo.
 *
 * Corresponde al paso 2 de la pantalla "Recuperar contrasena" del prototipo:
 * codigo de 6 digitos y contrasena nueva.
 */
export class RestablecerContrasenaDto {
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede pasar de 150 caracteres.' })
  correo!: string;

  /** Exactamente 6 caracteres, como lo muestra la pantalla del prototipo. */
  @Length(6, 6, { message: 'El código debe tener 6 dígitos.' })
  codigo!: string;

  @EsContrasenaValida()
  contrasenaNueva!: string;
}
