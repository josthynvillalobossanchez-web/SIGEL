/*
 * Pestanas del prototipo (clases "tabs" y "tab"), accesibles:
 *   - role="tablist" / "tab" / "tabpanel" con aria-selected y aria-controls.
 *   - Flechas izquierda/derecha, Inicio y Fin para moverse entre pestanas.
 *
 * Uso:
 *   const [pestana, setPestana] = useState('roles');
 *   <Pestanas etiqueta="Seguridad" actual={pestana} alCambiar={setPestana}
 *     opciones={[{ id: 'roles', texto: 'Roles', cuenta: 7 }, ...]} />
 *   <PanelDePestana id="roles" actual={pestana}>...</PanelDePestana>
 */
import { useId, useRef, type ReactNode } from 'react';

export interface OpcionDePestana {
  id: string;
  texto: string;
  /** Numero pequeno al lado del texto (opcional). */
  cuenta?: number;
}

interface PropiedadesDePestanas {
  opciones: OpcionDePestana[];
  actual: string;
  alCambiar: (id: string) => void;
  etiqueta: string;
  /** Prefijo de ids, para que las pestanas y sus paneles se enlacen. */
  prefijo?: string;
}

export function Pestanas({ opciones, actual, alCambiar, etiqueta, prefijo = 'pst' }: PropiedadesDePestanas) {
  const lista = useRef<HTMLDivElement>(null);

  function alTeclear(e: React.KeyboardEvent, indice: number) {
    let destino = -1;
    if (e.key === 'ArrowRight') destino = (indice + 1) % opciones.length;
    if (e.key === 'ArrowLeft') destino = (indice - 1 + opciones.length) % opciones.length;
    if (e.key === 'Home') destino = 0;
    if (e.key === 'End') destino = opciones.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    alCambiar(opciones[destino].id);
    lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[destino]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={etiqueta} ref={lista}>
      {opciones.map((opcion, i) => {
        const elegida = opcion.id === actual;
        return (
          <button
            key={opcion.id}
            id={`${prefijo}-tab-${opcion.id}`}
            type="button"
            role="tab"
            className="tab"
            aria-selected={elegida}
            aria-controls={`${prefijo}-panel-${opcion.id}`}
            tabIndex={elegida ? 0 : -1}
            onClick={() => alCambiar(opcion.id)}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            {opcion.texto}
            {opcion.cuenta !== undefined && <span className="cuenta">{opcion.cuenta}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PanelDePestana({
  id,
  actual,
  prefijo = 'pst',
  children,
}: {
  id: string;
  actual: string;
  prefijo?: string;
  children: ReactNode;
}) {
  if (id !== actual) return null;
  return (
    <div id={`${prefijo}-panel-${id}`} role="tabpanel" aria-labelledby={`${prefijo}-tab-${id}`} tabIndex={0}>
      {children}
    </div>
  );
}

/** Prefijo unico para cuando hay pestanas dentro de ventanas. */
export function usePrefijoDePestanas() {
  return useId().replace(/:/g, '');
}
