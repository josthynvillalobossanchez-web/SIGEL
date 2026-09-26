/*
 * Elegir permisos por MODULO, sin tener que bajar aunque haya muchos.
 *
 *   +------------------+-------------------------------------------+
 *   | [Buscar permiso] |  Usuarios            Marcar todos - Quitar |
 *   | Usuarios    2/4  |  [x] usuarios.ver    Ver la lista...       |
 *   | Bitacora    0/1  |  [ ] usuarios.crear  Crear cuentas...      |
 *   | Catalogos   1/2  |  ...                                       |
 *   +------------------+-------------------------------------------+
 *
 * A la izquierda los modulos (con cuantos van marcados); a la derecha las
 * casillas del modulo elegido. El buscador encuentra cualquier permiso de
 * cualquier modulo. Lo usan "Crear/Editar rol", "Agregar excepcion" y, de
 * solo lectura, la ventana "Ver rol".
 *
 * Un permiso que no se puede tocar queda atenuado y su ayuda dice por que
 * (bloqueoDe). "Marcar todos" / "Quitar todos" solo tocan los que si se
 * pueden.
 *
 * Accesibilidad: los modulos son pestanas verticales (flechas arriba/abajo,
 * Inicio, Fin) y cada modulo es un grupo de casillas con su nombre.
 */
import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icono } from './Icono';
import { nombreDeModulo } from '../utilidades/texto';

export interface PermisoParaElegir {
  id: string;
  clave: string;
  descripcion: string | null;
}

export interface ModuloParaElegir {
  modulo: string;
  permisos: PermisoParaElegir[];
}

interface PropiedadesDelSelector {
  modulos: ModuloParaElegir[];
  marcados: Set<string>;
  /** Sin esto el selector es de solo lectura. */
  alCambiar?: (nuevos: Set<string>) => void;
  /** Por que este permiso no se puede marcar ni desmarcar (null = si se puede). */
  bloqueoDe?: (permiso: PermisoParaElegir) => string | null;
  /** Algo extra bajo la descripcion (p. ej. "Hoy lo tiene"). */
  detalleDe?: (permiso: PermisoParaElegir) => ReactNode;
  /** Nombre del conjunto, para el lector de pantalla. */
  etiqueta: string;
  /** Solo lectura: mostrar solo los permisos marcados (y sus modulos). */
  soloMarcados?: boolean;
}

export function SelectorPorModulos({
  modulos,
  marcados,
  alCambiar,
  bloqueoDe,
  detalleDe,
  etiqueta,
  soloMarcados,
}: PropiedadesDelSelector) {
  const prefijo = useId().replace(/:/g, '');
  const soloLectura = !alCambiar;
  const lista = useRef<HTMLDivElement>(null);
  const [busqueda, setBusqueda] = useState('');

  // Modulos que se muestran (en solo lectura, solo los que tienen algo marcado).
  const visibles = useMemo(
    () =>
      soloMarcados
        ? modulos
            .map((m) => ({ ...m, permisos: m.permisos.filter((p) => marcados.has(p.id)) }))
            .filter((m) => m.permisos.length > 0)
        : modulos,
    [modulos, marcados, soloMarcados],
  );

  // Modulo con el que abre: el primero que ya tiene algo marcado; si no, el
  // primero donde se puede marcar algo; si no, el primero.
  const [elegido, setElegido] = useState<string | null>(
    () =>
      (
        visibles.find((m) => m.permisos.some((p) => marcados.has(p.id))) ??
        visibles.find((m) => m.permisos.some((p) => !bloqueoDe?.(p))) ??
        visibles[0]
      )?.modulo ?? null,
  );
  const moduloActual = visibles.find((m) => m.modulo === elegido) ?? visibles[0];

  const texto = busqueda.trim().toLowerCase();
  const encontrados = texto
    ? visibles.flatMap((m) =>
        m.permisos
          .filter((p) => p.clave.toLowerCase().includes(texto) || (p.descripcion ?? '').toLowerCase().includes(texto))
          .map((p) => ({ ...p, modulo: m.modulo })),
      )
    : null;

  if (visibles.length === 0) {
    return <p className="nota-modal">No hay permisos que mostrar.</p>;
  }

  const permisosDelPanel = encontrados ?? moduloActual.permisos.map((p) => ({ ...p, modulo: moduloActual.modulo }));
  const cambiables = permisosDelPanel.filter((p) => !bloqueoDe?.(p));

  function alternar(id: string) {
    const nuevos = new Set(marcados);
    if (nuevos.has(id)) nuevos.delete(id);
    else nuevos.add(id);
    alCambiar?.(nuevos);
  }

  function marcarTodos(marcar: boolean) {
    const nuevos = new Set(marcados);
    for (const p of cambiables) {
      if (marcar) nuevos.add(p.id);
      else nuevos.delete(p.id);
    }
    alCambiar?.(nuevos);
  }

  function alTeclear(e: React.KeyboardEvent, indice: number) {
    let destino = -1;
    if (e.key === 'ArrowDown') destino = (indice + 1) % visibles.length;
    if (e.key === 'ArrowUp') destino = (indice - 1 + visibles.length) % visibles.length;
    if (e.key === 'Home') destino = 0;
    if (e.key === 'End') destino = visibles.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    setElegido(visibles[destino].modulo);
    lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[destino]?.focus();
  }

  const tituloPanel = encontrados ? `Resultados de "${busqueda.trim()}"` : nombreDeModulo(moduloActual.modulo);
  const idPanel = `${prefijo}-panel`;

  return (
    <div className="selector-modulos" data-solo-lectura={soloLectura ? 'si' : 'no'}>
      <div className="sm-lateral">
        <div className="buscador sm-buscador">
          <Icono nombre="buscar" />
          <input
            type="search"
            placeholder="Buscar permiso"
            aria-label={`Buscar en ${etiqueta} por clave o descripción`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            maxLength={60}
          />
        </div>
        <div className="sm-modulos" role="tablist" aria-orientation="vertical" aria-label={`Módulos de ${etiqueta}`} ref={lista}>
          {visibles.map((modulo, i) => {
            const activo = !encontrados && modulo.modulo === moduloActual.modulo;
            const total = modulos.find((m) => m.modulo === modulo.modulo)?.permisos.length ?? modulo.permisos.length;
            const cuenta = modulo.permisos.filter((p) => marcados.has(p.id)).length;
            return (
              <button
                key={modulo.modulo}
                type="button"
                role="tab"
                id={`${prefijo}-tab-${modulo.modulo}`}
                aria-selected={activo}
                aria-controls={idPanel}
                tabIndex={activo || (encontrados && i === 0) ? 0 : -1}
                className="sm-modulo"
                data-con-marcados={cuenta > 0 ? 'si' : 'no'}
                onClick={() => {
                  setBusqueda('');
                  setElegido(modulo.modulo);
                }}
                onKeyDown={(e) => alTeclear(e, i)}
                aria-label={`${nombreDeModulo(modulo.modulo)}: ${cuenta} de ${total} marcados`}
              >
                <span>{nombreDeModulo(modulo.modulo)}</span>
                <span className="sm-cuenta" aria-hidden="true">
                  {cuenta}/{total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sm-panel" id={idPanel} role="tabpanel" aria-label={tituloPanel}>
        <div className="sm-cab">
          <h3>{tituloPanel}</h3>
          {!soloLectura && cambiables.length > 0 && (
            <div className="sm-todos">
              <button type="button" className="btn btn-texto btn-chico" onClick={() => marcarTodos(true)} data-ayuda={`Marcar todos los permisos que se pueden de "${tituloPanel}"`}>
                Marcar todos
              </button>
              <button type="button" className="btn btn-texto btn-chico" onClick={() => marcarTodos(false)} data-ayuda={`Quitar la marca a todos los de "${tituloPanel}"`}>
                Quitar todos
              </button>
            </div>
          )}
        </div>
        <fieldset className="sm-lista">
          <legend className="solo-lector">{tituloPanel}</legend>
          {permisosDelPanel.length === 0 && <p className="nota-modal">Ningún permiso coincide con la búsqueda.</p>}
          {permisosDelPanel.map((permiso) => {
            const bloqueo = soloLectura ? null : bloqueoDe?.(permiso) ?? null;
            const marcado = marcados.has(permiso.id);
            return (
              <label
                className="check"
                key={permiso.id}
                data-bloqueado={soloLectura || bloqueo ? 'si' : 'no'}
                data-marcado={marcado ? 'si' : 'no'}
                data-ayuda={bloqueo ?? permiso.descripcion ?? undefined}
              >
                {soloLectura ? (
                  <span className="check-lectura" aria-hidden="true" data-vacio={marcado ? undefined : 'si'}>
                    {marcado && <Icono nombre="check" tamano={15} grosor={3} />}
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => !bloqueo && alternar(permiso.id)}
                    aria-disabled={bloqueo ? true : undefined}
                    aria-describedby={`${prefijo}-d-${permiso.id}`}
                  />
                )}
                <span className="txt">
                  <b>
                    {permiso.clave}
                    {encontrados && <span className="sec-dato"> · {nombreDeModulo(permiso.modulo)}</span>}
                  </b>
                  <span id={`${prefijo}-d-${permiso.id}`}>
                    {permiso.descripcion ?? ''}
                    {bloqueo && <span className="solo-lector"> No disponible: {bloqueo}</span>}
                  </span>
                  {detalleDe?.(permiso)}
                </span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
