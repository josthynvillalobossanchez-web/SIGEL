/*
 * Reglas de los datos de un funcionario, las MISMAS del backend
 * (comun/validadores.ts, funcionarios.service.ts revisarFechas). Se usan en
 * "Registrar / Editar funcionario" y en "Mi cuenta" para avisar antes de
 * enviar; el backend las vuelve a revisar siempre.
 *
 * Si una regla cambia, se cambia AQUI y en el backend (nunca en la pantalla).
 * Cada funcion devuelve el problema en palabras, o null si esta bien.
 */
import { formatearFechaSola, hoyEnCostaRica, sumarAnios } from './fechas';

/** Edad minima para trabajar (Codigo de Trabajo de Costa Rica). */
export const EDAD_MINIMA = 15;
/** Formato basico de correo (el backend usa IsEmail). */
export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Telefono de Costa Rica (misma regla que el backend, comun/validadores.ts):
 * 8 digitos, el primero 2, 4, 5, 6, 7 u 8. Acepta espacios, guion,
 * parentesis y +506. Devuelve "8712-4408", o null si no es valido.
 */
export function normalizarTelefono(texto: string): string | null {
  let digitos = texto.replace(/[\s()-]/g, '');
  if (digitos.startsWith('+506')) digitos = digitos.slice(4);
  else if (digitos.length === 11 && digitos.startsWith('506')) digitos = digitos.slice(3);
  return /^[245678]\d{7}$/.test(digitos) ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : null;
}

export const MENSAJE_TELEFONO = 'El teléfono debe ser un número de Costa Rica de 8 dígitos (por ejemplo 8712-4408).';

/**
 * Revisa un nombre o apellido con las mismas reglas del backend
 * (comun/validadores.ts): largo, caracteres, palabras y sin 3 letras
 * iguales seguidas ("iii"). Devuelve el problema o null.
 */
export function problemaDeNombre(texto: string, campo: string, largoMaximo: number, palabrasMaximas: number): string | null {
  const limpio = texto.trim().replace(/\s{2,}/g, ' ');
  if (limpio.length < 2) return `${campo} debe tener al menos 2 letras.`;
  if (limpio.length > largoMaximo) return `${campo} no puede pasar de ${largoMaximo} caracteres.`;
  if (!/^[\p{L} .'-]+$/u.test(limpio)) return `${campo} solo puede tener letras, espacios, apóstrofos y guiones.`;
  if (/(\p{L})\1{2,}/iu.test(limpio)) return `${campo} tiene la misma letra repetida tres veces o más. Revise que esté bien escrito.`;
  if (limpio.split(' ').length > palabrasMaximas) return `${campo} no puede tener más de ${palabrasMaximas} palabras.`;
  return null;
}

/** Largos maximos de nombre y apellidos (iguales al backend). */
export const LARGO_NOMBRE = 50;
export const LARGO_APELLIDO = 40;

/* ------------------------------------------------------------------ */
/* Grupos de datos (lo que revisa cada formulario)                     */
/* ------------------------------------------------------------------ */

/** Nombre y apellidos. */
export function problemaDeNombres(d: { nombre: string; primerApellido: string; segundoApellido: string }): string | null {
  return (
    problemaDeNombre(d.nombre, 'El nombre', LARGO_NOMBRE, 5) ??
    problemaDeNombre(d.primerApellido, 'El primer apellido', LARGO_APELLIDO, 4) ??
    (d.segundoApellido.trim() ? problemaDeNombre(d.segundoApellido, 'El segundo apellido', LARGO_APELLIDO, 4) : null)
  );
}

/** Correos y telefono. El correo personal es obligatorio. */
export function problemaDeContacto(d: { correoPersonal: string; correoInstitucional: string; telefonoPersonal: string }): string | null {
  const personal = d.correoPersonal.trim();
  const institucional = d.correoInstitucional.trim();
  if (!personal) return 'El correo personal es obligatorio: es el canal de respaldo para los avisos.';
  if (!CORREO.test(personal)) return 'El correo personal no tiene un formato válido.';
  if (institucional && !CORREO.test(institucional)) return 'El correo institucional no tiene un formato válido.';
  if (d.telefonoPersonal.trim() && !normalizarTelefono(d.telefonoPersonal)) return MENSAJE_TELEFONO;
  return null;
}

/** Cedula al registrar (despues no se edita). */
export function problemaDeCedula(cedula: string): string | null {
  const limpia = cedula.replace(/\s+/g, '');
  if (!limpia) return 'Escriba la cédula.';
  if (!/^[0-9A-Za-z-]{5,20}$/.test(limpia)) return 'La cédula solo puede tener números, letras y guiones (entre 5 y 20).';
  return null;
}

/* ------------------------------------------------------------------ */
/* Fechas (AAAA-MM-DD)                                                 */
/* ------------------------------------------------------------------ */

/** Nacimiento mas reciente posible: hoy menos la edad minima. */
export function maximoDeNacimiento(hoy = hoyEnCostaRica()): string {
  return sumarAnios(hoy, -EDAD_MINIMA);
}

/** Ingreso mas temprano: cuando cumplio la edad minima, o 1950 si no hay nacimiento. */
export function minimoDeIngreso(nacimiento: string | null): string {
  return nacimiento ? sumarAnios(nacimiento, EDAD_MINIMA) : '1950-01-01';
}

/** Ingreso mas tarde: un anio hacia adelante (alguien que empieza el mes que viene). */
export function maximoDeIngreso(hoy = hoyEnCostaRica()): string {
  return sumarAnios(hoy, 1);
}

export function problemaDeNacimiento(nacimiento: string, hoy = hoyEnCostaRica()): string | null {
  if (!nacimiento) return null;
  return nacimiento > maximoDeNacimiento(hoy) || nacimiento < '1900-01-01' ? `La persona debe tener al menos ${EDAD_MINIMA} años.` : null;
}

export function problemaDeIngreso(ingreso: string, nacimiento: string | null, hoy = hoyEnCostaRica()): string | null {
  if (!ingreso) return null;
  const minimo = minimoDeIngreso(nacimiento);
  if (ingreso < minimo) {
    return nacimiento ? `No puede ser antes de que cumpliera ${EDAD_MINIMA} años (${formatearFechaSola(minimo)}).` : 'Debe ser desde 1950.';
  }
  return ingreso > maximoDeIngreso(hoy) ? 'No puede pasar de un año hacia adelante.' : null;
}
