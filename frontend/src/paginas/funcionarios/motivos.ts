/*
 * Por que una accion sobre un funcionario no esta disponible, en palabras
 * (sale en el globo de ayuda y lo lee el lector de pantalla). null = si se puede.
 */
type TienePermisos = (...claves: string[]) => boolean;

/** Mientras no exista la pantalla del expediente (siguiente parte de la epica 2). */
export const MOTIVO_EXPEDIENTE_PENDIENTE = 'el expediente laboral se agrega en la siguiente parte de la épica 2.';

export function motivoParaEditar(esPropio: boolean, tienePermisos: TienePermisos): string | null {
  if (!tienePermisos('funcionarios.editar')) return 'su cuenta no tiene permiso para editar funcionarios.';
  if (esPropio) return 'es su propio registro: sus datos personales se cambian en «Mi cuenta» y los laborales los cambia otra persona de Recursos Humanos.';
  return null;
}

export function motivoParaSalida(esPropio: boolean, tienePermisos: TienePermisos): string | null {
  if (!tienePermisos('funcionarios.editar')) return 'su cuenta no tiene permiso para registrar salidas ni reingresos.';
  if (esPropio) return 'no puede registrar su propia salida ni su propio reingreso.';
  return null;
}
