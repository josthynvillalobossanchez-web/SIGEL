import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Reglas que debe cumplir una contrasena nueva.
 *
 * Viven en un solo archivo a proposito: las usa el cambio de contrasena, la
 * recuperacion por correo y, mas adelante, la creacion de usuarios desde
 * Recursos Humanos. Si algun dia la Municipalidad pide otra politica, se
 * cambia aqui y queda cambiada en todo el sistema.
 *
 * Importante: estas reglas se aplican al CREAR o CAMBIAR la contrasena,
 * nunca al usarla para entrar. Validar el formato en el login solo le diria
 * a un atacante como son las contrasenas del sistema.
 *
 * Politica vigente: minimo 8 caracteres, con al menos una minuscula, una
 * mayuscula, un numero y un caracter especial.
 */
export const LARGO_MINIMO_CONTRASENA = 8;
export const LARGO_MAXIMO_CONTRASENA = 128;

/**
 * Las expresiones usan categorias Unicode en lugar de rangos como [a-z],
 * para que las letras con tilde y la enie cuenten como letras y no se tomen
 * por caracteres especiales.
 *
 *   \p{Ll}         una letra minuscula, incluida a con tilde o enie
 *   \p{Lu}         una letra mayuscula
 *   \p{Nd}         un digito
 *   [^\p{L}\p{N}]  cualquier cosa que no sea letra ni numero
 */
const TIENE_MINUSCULA = /\p{Ll}/u;
const TIENE_MAYUSCULA = /\p{Lu}/u;
const TIENE_NUMERO = /\p{Nd}/u;
const TIENE_ESPECIAL = /[^\p{L}\p{N}]/u;

/**
 * Agrupa todas las validaciones de contrasena en un solo decorador, para no
 * repetirlas en cada DTO y que no se desincronicen entre si.
 *
 *   export class MiDto {
 *     @EsContrasenaValida()
 *     contrasenaNueva!: string;
 *   }
 */
export function EsContrasenaValida(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(LARGO_MINIMO_CONTRASENA, {
      message: `La contrasena debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    }),
    MaxLength(LARGO_MAXIMO_CONTRASENA, {
      message: `La contrasena no puede pasar de ${LARGO_MAXIMO_CONTRASENA} caracteres.`,
    }),
    Matches(TIENE_MINUSCULA, { message: 'La contrasena debe incluir al menos una letra minuscula.' }),
    Matches(TIENE_MAYUSCULA, { message: 'La contrasena debe incluir al menos una letra mayuscula.' }),
    Matches(TIENE_NUMERO, { message: 'La contrasena debe incluir al menos un numero.' }),
    Matches(TIENE_ESPECIAL, {
      message: 'La contrasena debe incluir al menos un caracter especial, por ejemplo . - _ # @ !',
    }),
  );
}
