/*
 * Politica de contrasenas, copia de backend/src/autenticacion/politica-contrasena.ts.
 *
 * El backend es quien manda (vuelve a revisar todo). Esta copia solo sirve
 * para mostrarle a la persona, mientras escribe, que requisitos ya cumple.
 * SI SE CAMBIA LA POLITICA EN EL BACKEND, CAMBIARLA TAMBIEN AQUI.
 *
 * Politica acordada el 24/09: minimo 8 caracteres (maximo 128), al menos una
 * minuscula, una mayuscula, un numero y un caracter especial. Se aceptan
 * letras con tilde y la n con virgulilla (por eso las expresiones usan \p{...}).
 */

export const LARGO_MINIMO = 8;
export const LARGO_MAXIMO = 128;

export interface RequisitoDeContrasena {
  /** Texto que se muestra en la lista de requisitos. */
  texto: string;
  /** Devuelve true si la contrasena ya cumple este requisito. */
  cumple: (contrasena: string) => boolean;
}

export const REQUISITOS_DE_CONTRASENA: RequisitoDeContrasena[] = [
  {
    texto: `Al menos ${LARGO_MINIMO} caracteres`,
    cumple: (c) => c.length >= LARGO_MINIMO && c.length <= LARGO_MAXIMO,
  },
  { texto: 'Una letra minúscula', cumple: (c) => /\p{Ll}/u.test(c) },
  { texto: 'Una letra mayúscula', cumple: (c) => /\p{Lu}/u.test(c) },
  { texto: 'Un número', cumple: (c) => /\p{Nd}/u.test(c) },
  { texto: 'Un carácter especial (por ejemplo ! # $ % * -)', cumple: (c) => /[^\p{L}\p{N}]/u.test(c) },
];

/** true si la contrasena cumple todos los requisitos. */
export function cumpleLaPolitica(contrasena: string): boolean {
  return REQUISITOS_DE_CONTRASENA.every((r) => r.cumple(contrasena));
}

/**
 * Revisa el formulario de "contrasena nueva + repetirla" antes de enviarlo.
 * Devuelve el texto del problema, o null si esta todo bien.
 */
export function revisarContrasenaNueva(nueva: string, repetida: string): string | null {
  if (!nueva) return 'Escriba la contraseña nueva.';
  if (nueva.length > LARGO_MAXIMO) return `La contraseña no puede tener más de ${LARGO_MAXIMO} caracteres.`;
  if (!cumpleLaPolitica(nueva)) return 'La contraseña nueva no cumple todos los requisitos de la lista.';
  if (nueva !== repetida) return 'Las dos contraseñas nuevas no coinciden.';
  return null;
}
