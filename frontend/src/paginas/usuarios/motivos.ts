/*
 * Por que una accion sobre una cuenta no esta disponible, en palabras.
 *
 * El backend ya dice si la cuenta se puede modificar (motivoNoModificable);
 * aqui se combina con los permisos de quien mira para cada accion. Estos
 * textos son los que salen en el globo de ayuda y los lee el lector de
 * pantalla. null = la accion si esta disponible.
 */
type MotivoDelBackend = 'CUENTA_PROPIA' | 'CUENTA_CON_MAYOR_ACCESO' | null;
export type AccionSobreCuenta = 'editar' | 'permisos' | 'estado';

const PERMISO_DE_ACCION: Record<AccionSobreCuenta, string> = {
  editar: 'usuarios.editar',
  permisos: 'usuarios.editar',
  estado: 'usuarios.cambiarEstado',
};

const SIN_PERMISO: Record<AccionSobreCuenta, string> = {
  editar: 'su cuenta no tiene permiso para editar usuarios.',
  permisos: 'su cuenta no tiene permiso para editar usuarios.',
  estado: 'su cuenta no tiene permiso para cambiar el estado de las cuentas.',
};

const PROPIA: Record<AccionSobreCuenta, string> = {
  editar: 'es su propia cuenta. Sus datos personales se cambian en "Mi cuenta"; sus roles los cambia otra persona.',
  permisos: 'es su propia cuenta: nadie cambia su propio acceso.',
  estado: 'no puede cambiar el estado de su propia cuenta.',
};

export function motivoDeBloqueo(
  accion: AccionSobreCuenta,
  motivoDelBackend: MotivoDelBackend,
  tienePermisos: (...claves: string[]) => boolean,
): string | null {
  if (!tienePermisos(PERMISO_DE_ACCION[accion])) return SIN_PERMISO[accion];
  if (motivoDelBackend === 'CUENTA_PROPIA') return PROPIA[accion];
  if (motivoDelBackend === 'CUENTA_CON_MAYOR_ACCESO') return 'esta cuenta tiene permisos que usted no tiene.';
  return null;
}
