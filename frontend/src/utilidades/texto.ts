/*
 * Ayudantes pequenos para mostrar texto.
 */

/**
 * Iniciales para el circulo del usuario (arriba a la derecha).
 * Mientras la sesion no traiga el nombre del funcionario, se sacan del correo:
 * "ana.vargas@munipalmares.go.cr" -> "AV"; "informatica@..." -> "IN".
 */
export function inicialesDesdeCorreo(correo: string): string {
  const usuario = correo.split('@')[0] ?? '';
  const partes = usuario.split(/[._-]+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return usuario.slice(0, 2).toUpperCase() || '?';
}

/** Convierte segundos en "m:ss" (para cuentas regresivas). */
export function minutosYSegundos(totalSegundos: number): string {
  const s = Math.max(0, Math.ceil(totalSegundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Nombre completo de un funcionario; "Cuenta tecnica" si la cuenta no tiene funcionario. */
export function nombreCompleto(
  f: { nombre: string; primerApellido: string; segundoApellido: string | null } | null | undefined,
): string {
  if (!f) return 'Cuenta técnica';
  return [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');
}

/** Iniciales de un funcionario ("Ana Prueba" -> "AP"); "TI" para la cuenta tecnica. */
export function inicialesDeFuncionario(f: { nombre: string; primerApellido: string } | null | undefined): string {
  if (!f) return 'TI';
  return ((f.nombre[0] ?? '') + (f.primerApellido[0] ?? '')).toUpperCase();
}

/**
 * Nombre legible de cada modulo de permisos (la parte antes del punto en
 * "modulo.accion"). Si aparece un modulo nuevo que no esta aqui, se muestra
 * tal cual; conviene agregarlo.
 */
const NOMBRES_DE_MODULO: Record<string, string> = {
  funcionarios: 'Funcionarios',
  expediente: 'Expediente',
  documentos: 'Documentos',
  tiposDocumento: 'Tipos de documento',
  usuarios: 'Usuarios',
  roles: 'Roles',
  permisos: 'Permisos',
  catalogos: 'Catálogos',
  bitacora: 'Bitácora',
  perfilPropio: 'Perfil propio',
  solicitudes: 'Solicitudes',
};

export function nombreDeModulo(modulo: string): string {
  return NOMBRES_DE_MODULO[modulo] ?? modulo;
}

/**
 * Misma regla que el backend (funcionarios/cedula.ts): la cedula nacional
 * de 9 digitos se muestra "2-0678-0432"; otras identificaciones, en
 * mayusculas y sin espacios.
 */
export function normalizarCedula(texto: string): string {
  const limpia = texto.replace(/\s+/g, '').toUpperCase();
  const digitos = limpia.replace(/-/g, '');
  if (/^\d{9}$/.test(digitos) && /^[\d-]+$/.test(limpia)) return `${digitos[0]}-${digitos.slice(1, 5)}-${digitos.slice(5)}`;
  return limpia;
}

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
