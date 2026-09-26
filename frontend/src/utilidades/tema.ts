/*
 * Tema claro / oscuro. Funciona igual que en el prototipo:
 *   - Se guarda la eleccion en localStorage con la clave "sigel-tema".
 *   - Se aplica poniendo data-theme="light" | "dark" en <html>.
 *   - Si la persona nunca eligio, se usa el del sistema operativo.
 * index.html aplica el tema guardado antes de pintar (para que no parpadee).
 */
import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'sigel-tema';
type Tema = 'light' | 'dark';

function temaActual(): Tema {
  const elegido = document.documentElement.getAttribute('data-theme');
  if (elegido === 'light' || elegido === 'dark') return elegido;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Hook: devuelve si esta en oscuro y una funcion para alternar. */
export function useTema() {
  const [oscuro, setOscuro] = useState(() => temaActual() === 'dark');

  // Si la persona no eligio tema y cambia el del sistema, seguirlo.
  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!consulta) return;
    const alCambiar = () => setOscuro(temaActual() === 'dark');
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  const alternarTema = useCallback(() => {
    const nuevo: Tema = temaActual() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Navegador en modo privado o sin permiso: el tema dura solo esta visita.
    }
    setOscuro(nuevo === 'dark');
  }, []);

  return { oscuro, alternarTema };
}
