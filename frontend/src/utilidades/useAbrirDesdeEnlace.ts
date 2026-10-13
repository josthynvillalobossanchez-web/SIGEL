/*
 * Abre la ventana de detalle que pide la direccion (?abrir=<id>), por
 * ejemplo cuando se llega desde una notificacion. Carga el registro, se lo
 * pasa a la pagina para que abra su ventana y quita "abrir" de la direccion
 * (asi, al cerrar la ventana y recargar, no se vuelve a abrir).
 * Si no se puede cargar (no existe o no tiene acceso), no abre nada.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

export function useAbrirDesdeEnlace<T>(cargar: (id: string) => Promise<T>, alAbrir: (registro: T) => void): void {
  const [parametros, setParametros] = useSearchParams();
  const id = parametros.get('abrir');
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    cargar(id)
      .then((registro) => vigente && alAbrir(registro))
      .catch(() => undefined)
      .finally(() => {
        if (!vigente) return;
        setParametros(
          (actuales) => {
            const nuevos = new URLSearchParams(actuales);
            nuevos.delete('abrir');
            return nuevos;
          },
          { replace: true },
        );
      });
    return () => {
      vigente = false;
    };
    // Solo cuando cambia el id pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
