/*
 * Boton luna/sol para cambiar entre tema claro y oscuro.
 * La clase cambia segun donde se use: en el acceso es "btn-icono-claro
 * btn-tema-acceso"; en la barra superior es "tb-btn".
 */
import { useTema } from '../utilidades/tema';
import { Icono } from './Icono';

export function BotonTema({ clase }: { clase: string }) {
  const { oscuro, alternarTema } = useTema();
  const texto = oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  return (
    <button type="button" className={clase} onClick={alternarTema} aria-label={texto} data-ayuda={texto}>
      <Icono nombre={oscuro ? 'sol' : 'luna'} />
    </button>
  );
}
