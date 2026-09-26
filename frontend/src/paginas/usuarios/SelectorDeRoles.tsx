/*
 * Elegir los roles de una cuenta, cada uno "Permanente" o "Hasta el [fecha]"
 * (suplencias). Lo usan "Crear usuario", "Editar usuario" y "Registrar
 * funcionario" (paso "Cuenta de acceso").
 *
 * - No se marca un rol que quien actua no puede dar, ni se desmarca uno que
 *   no puede quitar (reglas 1 y 2): queda atenuado y dice por que.
 * - revisarRoles() revisa las reglas antes de avanzar: al menos un rol, al
 *   menos uno PERMANENTE, y fechas completas y dentro del rango.
 */
import type { RolResumido } from '../../api/roles';
import type { RolPedido } from '../../api/usuarios';
import { CampoFechaDeVencimiento } from '../../componentes/CampoFechaDeVencimiento';
import { problemaDeFechaDeVencimiento } from '../../utilidades/fechas';

/** Vigencia elegida para un rol marcado. */
export interface Vigencia {
  conFecha: boolean;
  /** "AAAA-MM-DD" (solo cuenta si conFecha). */
  fecha: string;
}
/** rolId -> vigencia. Un rol que no esta aqui, no se asigna. */
export type RolesMarcados = Record<string, Vigencia>;

/** Problema de los roles elegidos, o null si se puede seguir. */
export function revisarRoles(marcados: RolesMarcados, nombreDeRol: (id: string) => string): string | null {
  const lista = Object.entries(marcados);
  if (lista.length === 0) return 'Marque al menos un rol: una cuenta sin roles no puede hacer nada.';
  for (const [rolId, v] of lista) {
    if (!v.conFecha) continue;
    if (!v.fecha) return `Elija la fecha de vencimiento del rol "${nombreDeRol(rolId)}", o márquelo como permanente.`;
    const problema = problemaDeFechaDeVencimiento(v.fecha);
    if (problema) return `Rol "${nombreDeRol(rolId)}": ${problema}`;
  }
  if (!lista.some(([, v]) => !v.conFecha)) {
    return 'Deje al menos un rol permanente (sin fecha de vencimiento). Si todos vencen, llegaría el día en que la cuenta se queda sin acceso.';
  }
  return null;
}

/** Roles marcados -> lo que espera la API. */
export function aPedidos(marcados: RolesMarcados): RolPedido[] {
  return Object.entries(marcados).map(([rolId, v]) => ({ rolId, fechaVencimiento: v.conFecha ? v.fecha : undefined }));
}

export function SelectorDeRoles({
  roles,
  iniciales,
  marcados,
  alCambiar,
}: {
  /** null mientras cargan. */
  roles: RolResumido[] | null;
  /** Los que la cuenta ya tenia (al crear, vacio). */
  iniciales: RolesMarcados;
  marcados: RolesMarcados;
  alCambiar: (nuevos: RolesMarcados) => void;
}) {
  // Los activos, y los que la cuenta ya tiene (aunque esten inactivos, para
  // que se vean y se puedan quitar).
  const rolesVisibles = (roles ?? []).filter((r) => r.activo || r.id in iniciales);
  return (
    <fieldset className="grupo-opciones">
      <legend className="solo-lector">Roles de la cuenta</legend>
      {!roles && <p className="nota-modal">Cargando roles…</p>}
      <div className="rejilla-roles">
        {rolesVisibles.map((rol) => {
          const marcado = rol.id in marcados;
          const loTenia = rol.id in iniciales;
          // No se marca lo que no se puede dar, ni se desmarca lo que no se puede quitar.
          const bloqueo = !rol.asignable
            ? loTenia
              ? 'No puede quitar ni cambiar este rol: incluye permisos que usted no tiene o está inactivo.'
              : 'No puede asignar este rol: incluye permisos que usted no tiene.'
            : null;
          const vigencia = marcados[rol.id];
          return (
            <div className="fila-rol tarjeta-rol" key={rol.id} data-marcado={marcado ? 'si' : 'no'}>
              <label className="check" data-bloqueado={bloqueo ? 'si' : 'no'} data-ayuda={bloqueo ?? undefined}>
                <input
                  type="checkbox"
                  checked={marcado}
                  aria-disabled={bloqueo ? true : undefined}
                  onChange={() => {
                    if (bloqueo) return;
                    const copia = { ...marcados };
                    if (marcado) delete copia[rol.id];
                    else copia[rol.id] = iniciales[rol.id] ?? { conFecha: false, fecha: '' };
                    alCambiar(copia);
                  }}
                  aria-describedby={`desc-${rol.id}`}
                />
                <span className="txt">
                  <b>
                    {rol.nombre}
                    {!rol.activo && ' (inactivo)'}
                  </b>
                  <span id={`desc-${rol.id}`}>
                    {rol.descripcion ?? `${rol.cantidadPermisos} permisos`}
                    {bloqueo && <span className="solo-lector"> No disponible: {bloqueo}</span>}
                  </span>
                </span>
              </label>
              {marcado && (
                <fieldset className="vigencia-rol" disabled={Boolean(bloqueo)}>
                  <legend className="solo-lector">Vigencia del rol {rol.nombre}</legend>
                  <div className="opciones-en-linea">
                    <label className="opcion-chica">
                      <input
                        type="radio"
                        name={`vig-${rol.id}`}
                        checked={!vigencia.conFecha}
                        onChange={() => alCambiar({ ...marcados, [rol.id]: { ...vigencia, conFecha: false } })}
                      />
                      Permanente
                    </label>
                    <label className="opcion-chica">
                      <input
                        type="radio"
                        name={`vig-${rol.id}`}
                        checked={vigencia.conFecha}
                        onChange={() => alCambiar({ ...marcados, [rol.id]: { ...vigencia, conFecha: true } })}
                      />
                      Hasta el
                    </label>
                    {vigencia.conFecha && (
                      <CampoFechaDeVencimiento
                        compacto
                        id={`fecha-${rol.id}`}
                        etiqueta="Vence el"
                        deQue={`del rol ${rol.nombre}`}
                        valor={vigencia.fecha}
                        alCambiar={(fecha) => alCambiar({ ...marcados, [rol.id]: { ...vigencia, fecha } })}
                        ayuda="El rol deja de contar solo al terminar ese día."
                        desactivado={Boolean(bloqueo)}
                      />
                    )}
                  </div>
                </fieldset>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
