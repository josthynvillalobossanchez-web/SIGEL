/*
 * Por que una accion sobre un funcionario no esta disponible, en palabras
 * (sale en el globo de ayuda y lo lee el lector de pantalla). null = si se puede.
 */
type TienePermisos = (...claves: string[]) => boolean;


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

/**
 * Abrir el expediente: el propio siempre (expediente.ver); el de otra persona,
 * solo Recursos Humanos (expediente.verTodos). Decision de Josthyn, 28/09.
 */
export function motivoParaExpediente(f: { esPropio: boolean }, tienePermisos: TienePermisos): string | null {
  if (f.esPropio) return tienePermisos('expediente.ver') ? null : 'su cuenta no tiene permiso para ver su expediente.';
  if (!tienePermisos('expediente.verTodos')) return 'solo Recursos Humanos puede abrir el expediente de otra persona (son documentos delicados).';
  return null;
}

export function motivoParaSalida(f: Afectado, tienePermisos: TienePermisos): string | null {
  if (!tienePermisos('funcionarios.editar')) return 'su cuenta no tiene permiso para registrar salidas ni reingresos.';
  if (f.esPropio) return 'no puede registrar su propia salida ni su propio reingreso.';
  if (f.tieneMasAcceso) return MOTIVO_MAS_ACCESO;
  return null;
}
