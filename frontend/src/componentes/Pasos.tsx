/*
 * Indicador de pasos del prototipo (clases "pasos" y "paso"): la persona
 * siempre sabe en que parte del formulario esta.
 *
 * - El paso actual lleva aria-current="step".
 * - Al CREAR (libre = false) los pasos se hacen en orden: los completados
 *   se marcan con check y se pueden tocar para volver; los que faltan no se
 *   pueden saltar (su ayuda lo explica).
 * - Al EDITAR (libre = true) todo ya tiene datos, asi que se puede ir a
 *   cualquier paso directamente.
 */
export interface Paso {
  titulo: string;
  sub: string;
}

interface PropiedadesDePasos {
  pasos: Paso[];
  /** Indice del paso actual (desde 0). */
  actual: number;
  /** Ir a otro paso (quien lo usa decide si se puede). */
  alElegir: (indice: number) => void;
  etiqueta: string;
  libre?: boolean;
  /** En una pagina (sin el margen que lleva dentro de una ventana). */
  enPagina?: boolean;
}

export function Pasos({ pasos, actual, alElegir, etiqueta, libre, enPagina }: PropiedadesDePasos) {
  return (
    <div className="pasos" style={enPagina ? undefined : { margin: '16px 0 0' }} role="group" aria-label={etiqueta}>
      {pasos.map((paso, i) => {
        const hecho = !libre && i < actual;
        const bloqueado = !libre && i > actual;
        const esActual = i === actual;
        return (
          <button
            key={paso.titulo}
            type="button"
            className="paso"
            aria-current={esActual ? 'step' : undefined}
            data-hecho={hecho ? 'si' : undefined}
            aria-disabled={bloqueado || undefined}
            aria-label={`Paso ${i + 1} de ${pasos.length}: ${paso.titulo}${hecho ? ' (completado)' : ''}${esActual ? ' (actual)' : ''}`}
            data-ayuda={
              bloqueado ? 'Complete primero el paso actual con "Siguiente".' : esActual ? undefined : `Ir a "${paso.titulo}"`
            }
            onClick={() => !bloqueado && !esActual && alElegir(i)}
          >
            <span className="n" aria-hidden="true">
              {hecho ? '✓' : i + 1}
            </span>
            <span>
              {paso.titulo}
              <span className="sub">{paso.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
