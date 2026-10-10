/*
 * Botones "Tarjetas / Lista" para que cada persona elija como ver las
 * solicitudes (decision 01/10: no quitar nada, que la persona elija).
 * La eleccion se recuerda en este navegador (usePreferencia).
 */
import { Icono } from '../../componentes/Icono';

export type FormaDeLista = 'tarjetas' | 'compacta';
export const FORMAS: readonly FormaDeLista[] = ['tarjetas', 'compacta'];

export function ElegirForma({ forma, alCambiar }: { forma: FormaDeLista; alCambiar: (f: FormaDeLista) => void }) {
  return (
    <div className="segmentado segmentado-chico segmentado-iconos" role="group" aria-label="Cómo ver las solicitudes">
      <button type="button" aria-pressed={forma === 'tarjetas'} onClick={() => alCambiar('tarjetas')} aria-label="Ver en tarjetas" data-ayuda="Ver en tarjetas (más detalle)">
        <Icono nombre="tarjetas" tamano={16} /> <span className="solo-ancho">Tarjetas</span>
      </button>
      <button type="button" aria-pressed={forma === 'compacta'} onClick={() => alCambiar('compacta')} aria-label="Ver en lista compacta" data-ayuda="Ver en lista compacta (una fila por solicitud, más ligera)">
        <Icono nombre="lista" tamano={16} /> <span className="solo-ancho">Lista</span>
      </button>
    </div>
  );
}

/**
 * Por cada solicitud, cuantas OTRAS personas tienen dias que coinciden
 * (pendientes o aprobadas). Sirve para marcar los choques en la bandeja.
 */
export function avisosDeChoque(
  propias: { id: string; fechaInicio: string; fechaFin: string; funcionario: { id: string } }[],
  todas: { id: string; fechaInicio: string; fechaFin: string; estado: string; funcionario: { id: string } }[],
): Record<string, string> {
  const avisos: Record<string, string> = {};
  for (const s of propias) {
    const personas = new Set(
      todas
        .filter((o) => o.id !== s.id && o.funcionario.id !== s.funcionario.id && (o.estado === 'pendiente' || o.estado === 'aprobada') && o.fechaInicio <= s.fechaFin && o.fechaFin >= s.fechaInicio)
        .map((o) => o.funcionario.id),
    );
    if (personas.size) avisos[s.id] = personas.size === 1 ? 'Coincide con 1 persona' : `Coincide con ${personas.size} personas`;
  }
  return avisos;
}
