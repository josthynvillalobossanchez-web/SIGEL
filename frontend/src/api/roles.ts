/*
 * Llamadas a los modulos de roles (/api/roles) y permisos (/api/permisos).
 * Tipos de backend/src/roles/roles.service.ts y permisos/permisos.service.ts.
 */
import { pedirAlServidor } from './cliente';

/** Un rol en la lista (GET /roles). */
export interface RolResumido {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Rol creado por el seed: no se modifica desde la aplicacion. */
  esSistema: boolean;
  activo: boolean;
  cantidadPermisos: number;
  /** Cuentas que lo tienen vigente. */
  cantidadUsuarios: number;
  /** true si quien consulta lo puede asignar (tiene todos sus permisos). */
  asignable: boolean;
  /** Ids de sus permisos activos. */
  permisoIds: string[];
}

/** Un permiso tal como viene dentro del detalle de un rol. */
export interface PermisoDeRol {
  id: string;
  clave: string;
  modulo: string;
  descripcion: string | null;
  activo: boolean;
}

/** GET /roles/:id */
export interface DetalleDeRol {
  id: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  activo: boolean;
  cantidadUsuarios: number;
  asignable: boolean;
  /** false si es de sistema o si tiene permisos que quien consulta no tiene. */
  editable: boolean;
  permisos: PermisoDeRol[];
}

/** Catalogo de permisos agrupado (GET /permisos). */
export interface ModuloDePermisos {
  modulo: string;
  permisos: { id: string; clave: string; descripcion: string | null; asignable: boolean }[];
}

/* ------------------------------------------------------------------ */

export function consultarRoles() {
  return pedirAlServidor<RolResumido[]>('GET', '/roles');
}

export function consultarRol(id: string) {
  return pedirAlServidor<DetalleDeRol>('GET', `/roles/${encodeURIComponent(id)}`);
}

export function consultarCatalogoDePermisos() {
  return pedirAlServidor<ModuloDePermisos[]>('GET', '/permisos');
}

export function crearRol(datos: { nombre: string; descripcion?: string; permisoIds: string[] }) {
  return pedirAlServidor<DetalleDeRol>('POST', '/roles', { cuerpo: datos });
}

/**
 * Pagina "Editar rol": nombre, descripcion y/o la lista COMPLETA de
 * permisos, todo junto o nada. Para quitar la descripcion se manda "".
 */
export function editarRol(id: string, datos: { nombre?: string; descripcion?: string; permisoIds?: string[] }) {
  return pedirAlServidor<DetalleDeRol>('PATCH', `/roles/${encodeURIComponent(id)}`, { cuerpo: datos });
}

/** Reemplaza la lista COMPLETA de permisos del rol. */
export function reemplazarPermisosDeRol(id: string, permisoIds: string[]) {
  return pedirAlServidor<DetalleDeRol>('PUT', `/roles/${encodeURIComponent(id)}/permisos`, { cuerpo: { permisoIds } });
}

export function cambiarEstadoDeRol(id: string, activo: boolean) {
  return pedirAlServidor<DetalleDeRol>('PATCH', `/roles/${encodeURIComponent(id)}/estado`, { cuerpo: { activo } });
}
