/*
 * Buscador que no consulta con cada tecla: espera a que la persona deje de
 * escribir (450 ms) y recien ahi pasa el texto a la URL (?busqueda=...),
 * de donde lo toma la lista para consultar.
 *
 *   const [texto, setTexto] = useBusquedaDiferida(busquedaEnUrl, (b) => cambiar({ busqueda: b }));
 *   <input value={texto} onChange={(e) => setTexto(e.target.value)} />
 */
import { useEffect, useRef, useState } from 'react';

const ESPERA_MS = 450;

export function useBusquedaDiferida(busquedaEnUrl: string, alBuscar: (texto: string) => void) {
  const [texto, setTexto] = useState(busquedaEnUrl);
  const ultimoAlBuscar = useRef(alBuscar);
  ultimoAlBuscar.current = alBuscar;

  useEffect(() => {
    if (texto.trim() === busquedaEnUrl) return;
    const espera = window.setTimeout(() => ultimoAlBuscar.current(texto.trim()), ESPERA_MS);
    return () => window.clearTimeout(espera);
  }, [texto, busquedaEnUrl]);

  return [texto, setTexto] as const;
}
