/*
 * Filtros y ventanas abiertas guardados en la URL (?estado=activo&ver=<id>).
 *
 * Por que un hook propio y no setSearchParams directo: el enrutador aplica
 * la navegacion "en diferido" (transicion de React). Si la persona cambia
 * dos filtros muy seguidos, el segundo cambio se calculaba sobre la URL
 * VIEJA y deshacia el primero (p. ej. tocar "Todos" y enseguida elegir un
 * departamento dejaba el filtro "Inactivos"). Aqui cada cambio parte del
 * ultimo que se pidio, aunque el enrutador todavia no lo haya dibujado.
 *
 * Uso:
 *   const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true, salvo: ['ver'] });
 *   cambiar({ estado: 'activo' });   // "" borra el parametro
 */
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

export function useParametrosEnUrl(opciones: { reiniciaPagina?: boolean; salvo?: string[] } = {}) {
  const [parametros, setParametros] = useSearchParams();
  const pendiente = useRef<URLSearchParams | null>(null);
  const { reiniciaPagina = false, salvo = [] } = opciones;
  const salvoTexto = salvo.join(',');

  // Cuando el enrutador ya dibujo la URL nueva, no hay nada pendiente.
  useEffect(() => {
    pendiente.current = null;
  }, [parametros]);

  const cambiar = useCallback(
    (cambios: Record<string, string>) => {
      const nuevos = new URLSearchParams(pendiente.current ?? parametros);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
      }
      // Cambiar un filtro vuelve a la pagina 1 (salvo abrir o cerrar una ventana).
      const excepciones = salvoTexto ? salvoTexto.split(',') : [];
      if (reiniciaPagina && !('pagina' in cambios) && !excepciones.some((c) => c in cambios)) nuevos.delete('pagina');
      pendiente.current = nuevos;
      setParametros(nuevos);
    },
    [parametros, setParametros, reiniciaPagina, salvoTexto],
  );

  return [parametros, cambiar] as const;
}
