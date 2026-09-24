/**
 * Como se calcula el acceso real de una cuenta.
 *
 * Lo usan el guard de sesion (para saber que puede hacer quien esta
 * conectado) y la gestion de usuarios (para aplicar la regla 3: no tocar a
 * quien tiene mas acceso que uno). Vive en un solo lugar para que los dos
 * calculen EXACTAMENTE igual; si se cambiara uno y no el otro, la regla de
 * reparto de acceso dejaria de ser confiable.
 */

/**
 * Filtro de Prisma para quedarse solo con las asignaciones vigentes: las que
 * no tienen fecha de vencimiento (permanentes) o cuya fecha todavia no llego.
 *
 * Se usa en el "where" de las relaciones "roles" y "permisos" del usuario:
 *
 *   roles: { where: soloVigentes(), select: { ... } }
 *
 * Es una funcion y no una constante porque la fecha de "ahora" tiene que
 * calcularse en cada consulta, no una sola vez al arrancar el servidor.
 */
export function soloVigentes() {
  return {
    OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gt: new Date() } }],
  };
}

/** Forma minima de una asignacion de rol, tal como la trae Prisma. */
interface AsignacionDeRol {
  rol: {
    nombre: string;
    activo: boolean;
    permisos: { permiso: { clave: string; activo: boolean } }[];
  };
}

/** Forma minima de un permiso individual, tal como lo trae Prisma. */
interface PermisoIndividual {
  otorgado: boolean;
  permiso: { clave: string; activo: boolean };
}

/**
 * Combina roles y permisos individuales en la lista final de permisos.
 *
 *   1. Se juntan los permisos de todos sus roles activos.
 *   2. Se agregan los permisos individuales concedidos (otorgado = true).
 *   3. Se quitan los permisos individuales revocados (otorgado = false).
 *
 * El permiso individual manda sobre el del rol, en los dos sentidos. Los
 * roles y permisos inactivos no cuentan.
 *
 * IMPORTANTE: las asignaciones que recibe ya deben venir filtradas con
 * soloVigentes(). Esta funcion no mira fechas.
 */
export function resolverAcceso(
  asignacionesDeRol: readonly AsignacionDeRol[],
  permisosIndividuales: readonly PermisoIndividual[],
): { roles: string[]; permisos: string[] } {
  const permisos = new Set<string>();
  const roles: string[] = [];

  for (const asignacion of asignacionesDeRol) {
    if (!asignacion.rol.activo) continue;
    roles.push(asignacion.rol.nombre);
    for (const delRol of asignacion.rol.permisos) {
      if (delRol.permiso.activo) permisos.add(delRol.permiso.clave);
    }
  }

  for (const individual of permisosIndividuales) {
    if (!individual.permiso.activo) continue;
    if (individual.otorgado) {
      permisos.add(individual.permiso.clave);
    } else {
      permisos.delete(individual.permiso.clave);
    }
  }

  return { roles, permisos: [...permisos].sort() };
}
