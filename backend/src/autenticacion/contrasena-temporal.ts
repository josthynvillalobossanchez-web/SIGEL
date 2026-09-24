import { randomInt } from 'node:crypto';

/**
 * Genera una contrasena temporal al azar que cumple la politica del sistema:
 * al menos una minuscula, una mayuscula, un numero y un caracter especial.
 *
 * La usan la creacion de cuentas y el comando de restablecimiento desde la
 * terminal. Vive en un solo lugar para que las dos generen igual.
 *
 * Se usa randomInt de node:crypto y no Math.random, que es predecible y no
 * sirve para nada relacionado con seguridad.
 *
 * Se quitan los caracteres que se confunden al leerlos o dictarlos (l, I, 1,
 * O, 0), porque esta contrasena la va a copiar a mano una persona.
 */
export function generarContrasenaTemporal(largo = 12): string {
  const grupos = [
    'abcdefghijkmnopqrstuvwxyz', // sin la ele minuscula
    'ABCDEFGHJKLMNPQRSTUVWXYZ', // sin I ni O
    '23456789', // sin 0 ni 1
    '.-_#@!$%+=',
  ];

  const todos = grupos.join('');

  // Uno de cada grupo, para garantizar que cumple la politica.
  const obligatorios = grupos.map((grupo) => grupo[randomInt(grupo.length)]);
  const resto = Array.from({ length: largo - grupos.length }, () => todos[randomInt(todos.length)]);
  const caracteres = [...obligatorios, ...resto];

  // Se mezclan para que los obligatorios no queden siempre al principio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join('');
}
