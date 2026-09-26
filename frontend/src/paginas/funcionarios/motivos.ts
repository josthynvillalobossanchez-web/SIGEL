/*
 * Por que una accion sobre un funcionario no esta disponible, en palabras
 * (sale en el globo de ayuda y lo lee el lector de pantalla). null = si se puede.
 */
type TienePermisos = (...claves: string[]) => boolean;

/** Mientras no exista la pantalla del expediente (siguiente parte de la epica 2). */
export const MOTIVO_EXPEDIENTE_PENDIENTE = 'el expediente laboral se agrega en la siguiente parte de la épica 2.';

/** Lo que hace falta saber del funcionario para decidir. */
interface Afectado {
  esPropio: boolean;
  /** Su cuenta tiene permisos que quien mira no tiene ("para arriba no"). */
  tieneMasAcceso: boolean;
}

export const MOTIVO_MAS_ACCESO = 'su cuenta tiene permisos que usted no tiene. Lo debe hacer alguien con ese acceso.';

export function motivoParaEditar(f: Afectado, tienePermisos: TienePermisos): string | null {
  if (!tienePermisos('funcionarios.editar')) return 'su cuenta no tiene permiso para editar funcionarios.';
  if (f.esPropio) return 'es su propio registro: sus datos personales y laborales se cambian en «Mi cuenta».';
  if (f.tieneMasAcceso) return MOTIVO_MAS_ACCESO;
  return null;
}

export function motivoParaSalida(f: Afectado, tienePermisos: TienePermisos): string | null {
  if (!tienePermisos('funcionarios.editar')) return 'su cuenta no tiene permiso para registrar salidas ni reingresos.';
  if (f.esPropio) return 'no puede registrar su propia salida ni su propio reingreso.';
  if (f.tieneMasAcceso) return MOTIVO_MAS_ACCESO;
  return null;
}
