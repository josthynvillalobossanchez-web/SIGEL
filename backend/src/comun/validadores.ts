import { applyDecorators } from '@nestjs/common';
import { IsString, Length, Matches, ValidateBy } from 'class-validator';

/**
 * Reglas de nombres y telefonos de personas, compartidas por los
 * formularios de funcionarios y de "Mi cuenta".
 *
 * Criterio (27/09, pedido de Josthyn: "realista, ni muy estricto ni muy
 * suelto"):
 *   - Nombre: 2 a 50 caracteres y hasta 5 palabras ("Maria de los Angeles
 *     del Carmen" cabe). Apellidos: 2 a 40 y hasta 4 palabras ("de la
 *     Guardia" cabe). Las columnas de la base aguantan 80; el tope real lo
 *     pone esta validacion.
 *   - Solo letras (con tildes y n), espacios, apostrofo, guion y punto.
 *   - No mas de 2 letras iguales seguidas: en espanol nunca van 3 ("iii",
 *     "aaaa"), asi que eso es un dedo pegado al teclado, no un nombre.
 */

/** Letras (cualquier idioma), espacio, apostrofo, guion y punto. */
export const CARACTERES_DE_NOMBRE = /^[\p{L} .'-]+$/u;

/** true si hay 3 o mas letras iguales seguidas (sin importar mayusculas). */
export function tieneLetrasRepetidas(texto: string): boolean {
  return /(\p{L})\1{2,}/iu.test(texto);
}

/**
 * Decorador para nombre y apellidos.
 *   @NombreDePersona('El nombre', 50, 5) nombre!: string;
 */
export function NombreDePersona(campo: string, largoMaximo: number, palabrasMaximas: number) {
  return applyDecorators(
    IsString({ message: `${campo} debe ser texto.` }),
    Length(2, largoMaximo, { message: `${campo} debe tener entre 2 y ${largoMaximo} caracteres.` }),
    Matches(CARACTERES_DE_NOMBRE, { message: `${campo} solo puede tener letras, espacios, apóstrofos y guiones.` }),
    ValidateBy({
      name: 'sinLetrasRepetidas',
      validator: {
        validate: (valor: unknown) => typeof valor !== 'string' || !tieneLetrasRepetidas(valor),
        defaultMessage: () => `${campo} tiene la misma letra repetida tres veces o más. Revise que esté bien escrito.`,
      },
    }),
    ValidateBy({
      name: 'palabrasMaximas',
      validator: {
        validate: (valor: unknown) => typeof valor !== 'string' || valor.trim().split(/\s+/).length <= palabrasMaximas,
        defaultMessage: () => `${campo} no puede tener más de ${palabrasMaximas} palabras.`,
      },
    }),
  );
}

/**
 * Telefono de Costa Rica: 8 digitos. El primero indica el tipo de linea
 * segun el Plan Nacional de Numeracion (SUTEL): 2 y 4 fijos, 5 servicios
 * especiales e IP, 6, 7 y 8 moviles. Se acepta escrito con espacios, guion,
 * parentesis o con el codigo de pais (+506), y se guarda siempre como
 * "8712-4408".
 *
 * Devuelve el telefono normalizado, o el texto tal cual si no es valido
 * (para que el decorador Matches lo rechace con su mensaje).
 */
export function normalizarTelefono(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  let digitos = valor.replace(/[\s()-]/g, '');
  if (digitos.startsWith('+506')) digitos = digitos.slice(4);
  else if (digitos.length === 11 && digitos.startsWith('506')) digitos = digitos.slice(3);
  return /^[245678]\d{7}$/.test(digitos) ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : valor;
}

export const TELEFONO_DE_COSTA_RICA = /^[245678]\d{3}-\d{4}$/;
export const MENSAJE_TELEFONO = 'El teléfono debe ser un número de Costa Rica de 8 dígitos (por ejemplo 8712-4408).';
