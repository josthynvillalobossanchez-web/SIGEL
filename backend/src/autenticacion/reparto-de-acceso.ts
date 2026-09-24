/**
 * Regla de reparto de acceso: "solo se da lo que se tiene".
 *
 * Decidida el 24/09/2026. Quien puede repartir acceso (Recursos Humanos y el
 * Super Administrador, por tener "usuarios.editar") lo hace bajo cinco reglas:
 *
 *   1. Asignar un rol exige tener todos sus permisos. Conceder un permiso
 *      individual exige tenerlo.
 *   2. Quitar sigue el mismo criterio: solo se quita lo que uno tiene.
 *   3. No se toca a quien tiene mas acceso que uno.
 *   4. Nadie cambia su propio acceso.
 *   5. Al editar un rol, solo se le agregan permisos que uno tenga.
 *
 * Con esto Recursos Humanos puede asignar Administrador, Aprobador,
 * Solicitante o Consulta, pero no puede crear Super Administradores: ese rol
 * trae permisos que Recursos Humanos no tiene.
 *
 * IMPORTANTE: aqui no aparece ningun nombre de rol. La regla compara
 * permisos, asi que si manana se crea un rol nuevo se aplica sola, sin tocar
 * codigo. No escribir nunca "Super Administrador" en una condicion.
 */

/**
 * Devuelve los permisos de "requeridos" que quien actua NO tiene.
 * Lista vacia = puede otorgar (o quitar) eso.
 *
 *   permisosQueFaltan(['a', 'b'], ['a', 'c'])  ->  ['c']
 */
export function permisosQueFaltan(
  permisosDeQuienActua: readonly string[],
  requeridos: readonly string[],
): string[] {
  const disponibles = new Set(permisosDeQuienActua);
  return requeridos.filter((clave) => !disponibles.has(clave));
}
