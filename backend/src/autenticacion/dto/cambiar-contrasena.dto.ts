import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { EsContrasenaValida, LARGO_MAXIMO_CONTRASENA } from '../politica-contrasena.js';

/**
 * Datos para que una persona cambie su propia contrasena, ya dentro del
 * sistema.
 *
 * No lleva el identificador del usuario: se toma de la cookie de sesion. Si
 * viniera en el cuerpo, cualquiera podria cambiarle la contrasena a otro
 * escribiendo el identificador ajeno.
 */
export class CambiarContrasenaDto {
  /**
   * La contrasena que usa hoy. Se pide aunque ya tenga la sesion abierta,
   * porque si alguien deja la computadora sin bloquear, no deberia poder
   * cambiarle la contrasena y quedarse con la cuenta.
   */
  @IsString()
  @IsNotEmpty({ message: 'Debe indicar su contrasena actual.' })
  @MaxLength(LARGO_MAXIMO_CONTRASENA)
  contrasenaActual!: string;

  /** La nueva, que debe cumplir la politica del sistema. */
  @EsContrasenaValida()
  contrasenaNueva!: string;
}
