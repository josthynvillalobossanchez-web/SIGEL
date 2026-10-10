/*
 * true mientras la ventana es angosta (celular). Se usa para elegir CUAL
 * vista dibujar (p. ej. puntos en vez de barras en el calendario); los
 * ajustes de tamano normales van en CSS con @media.
 */
import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 719px)';

export function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const lista = window.matchMedia(CONSULTA);
    const alCambiar = () => setEsMovil(lista.matches);
    lista.addEventListener('change', alCambiar);
    return () => lista.removeEventListener('change', alCambiar);
  }, []);
  return esMovil;
}
