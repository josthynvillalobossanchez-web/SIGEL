/*
 * Por que no se puede hacer algo con un rol, en palabras (null = si se puede).
 * Lo usan la lista de roles, la ventana "Ver rol" y la pagina "Editar rol",
 * para que los tres digan exactamente lo mismo. El backend revisa todo otra vez.
 *
 *   edicion   cambiar nombre y descripcion.
 *   permisos  cambiar sus permisos (ademas: nadie cambia un rol que tiene).
 *   estado    activar/inactivar (ademas: no se inactiva si alguien lo tiene).
 */
import type { RolResumido } from '../../api/roles';

export interface BloqueosDeRol {
  edicion: (rol: RolResumido) => string | null;
  permisos: (rol: RolResumido) => string | null;
  estado: (rol: RolResumido) => string | null;
}

export function bloqueosDeRol(
  /** Ids de los permisos que tiene quien mira. */
  misPermisoIds: Set<string>,
  puedeAdministrar: boolean,
  /** Nombres de los roles vigentes de quien mira. */
  misRoles: string[],
): BloqueosDeRol {
  function edicion(rol: RolResumido): string | null {
    if (!puedeAdministrar) return 'su cuenta no tiene permiso para administrar roles.';
    if (rol.esSistema) return 'es un rol de sistema: lo define la instalación y no se modifica. Si necesita otra combinación, cree un rol nuevo.';
    if (!rol.permisoIds.every((id) => misPermisoIds.has(id))) return 'este rol incluye permisos que usted no tiene.';
    return null;
  }
  function permisos(rol: RolResumido): string | null {
    const base = edicion(rol);
    if (base) return base;
    if (misRoles.includes(rol.nombre)) return 'usted tiene este rol, y nadie cambia su propio acceso: debe hacerlo otra persona.';
    return null;
  }
  function estado(rol: RolResumido): string | null {
    const base = permisos(rol);
    if (base) return base;
    if (rol.activo && rol.cantidadUsuarios > 0) {
      return `${rol.cantidadUsuarios} cuenta${rol.cantidadUsuarios === 1 ? ' lo tiene' : 's lo tienen'} vigente: quíteselo primero a esas cuentas.`;
    }
    return null;
  }
  return { edicion, permisos, estado };
}
