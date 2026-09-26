/*
 * Llamadas al modulo de catalogos (/api/catalogos): departamentos, puestos
 * y profesiones. Tipos de backend/src/catalogos/catalogos.service.ts.
 */
import { pedirAlServidor } from './cliente';

export type TipoDeCatalogo = 'departamentos' | 'puestos' | 'profesiones';

export interface ElementoDeCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** Funcionarios ACTIVOS que lo tienen asignado hoy. */
  cantidadFuncionarios: number;
}

export type CatalogosCompletos = Record<TipoDeCatalogo, ElementoDeCatalogo[]>;

/** GET /catalogos: los tres de una vez (solo pide sesion). */
export function consultarCatalogos(soloActivos = false) {
  return pedirAlServidor<CatalogosCompletos>('GET', '/catalogos', {
    parametros: soloActivos ? { soloActivos: 'true' } : {},
  });
}

/** POST /catalogos/:tipo (catalogos.editar). */
export function crearElemento(tipo: TipoDeCatalogo, datos: { nombre: string; descripcion?: string }) {
  return pedirAlServidor<ElementoDeCatalogo>('POST', `/catalogos/${tipo}`, { cuerpo: datos });
}

/** PATCH /catalogos/:tipo/:id (catalogos.editar). "" quita la descripcion. */
export function editarElemento(tipo: TipoDeCatalogo, id: string, datos: { nombre?: string; descripcion?: string }) {
  return pedirAlServidor<ElementoDeCatalogo>('PATCH', `/catalogos/${tipo}/${encodeURIComponent(id)}`, { cuerpo: datos });
}

/** PATCH /catalogos/:tipo/:id/estado (catalogos.editar). */
export function cambiarEstadoDeElemento(tipo: TipoDeCatalogo, id: string, activo: boolean) {
  return pedirAlServidor<ElementoDeCatalogo>('PATCH', `/catalogos/${tipo}/${encodeURIComponent(id)}/estado`, { cuerpo: { activo } });
}
