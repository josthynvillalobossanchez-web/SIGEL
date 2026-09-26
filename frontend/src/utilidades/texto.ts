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
