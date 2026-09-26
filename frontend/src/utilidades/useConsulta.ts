/*
 * Hook para pedir datos al servidor al abrir una pantalla o ventana.
 *
 * Reemplaza el patron que se repetia en casi todas las pantallas
 * (useState + useEffect + then/catch + textoDelError):
 *
 *   const { datos: cuenta, error, cargando, recargar } =
 *     useConsulta(() => consultarCuenta(id), [id]);
 *
 *   - "pedir" se vuelve a llamar cada vez que cambia algo de "dependencias"
 *     (igual que useEffect). Si "pedir" es null, no se pide nada (p. ej.
 *     cuando falta un permiso) y "cargando" queda en false.
 *   - Si llega una respuesta vieja (la persona cambio de filtro antes de que
 *     terminara la anterior), se descarta: nunca pisa a la mas nueva.
 *   - "recargar()" vuelve a pedir con lo mismo (despues de guardar algo).
 *   - "cambiarDatos" deja poner los datos a mano (p. ej. el servidor ya
 *     devolvio la version nueva al guardar y no hace falta volver a pedir).
 *   - "error" trae el mensaje listo para mostrar (textoDelError).
 */
import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from 'react';
import { textoDelError } from '../api/cliente';

export interface Consulta<T> {
  datos: T | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
  cambiarDatos: Dispatch<SetStateAction<T | null>>;
}

export function useConsulta<T>(pedir: (() => Promise<T>) | null, dependencias: DependencyList): Consulta<T> {
  const [datos, cambiarDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(pedir !== null);
  const [recarga, setRecarga] = useState(0);

  // La funcion mas reciente, sin tener que ponerla en las dependencias
  // (cambia en cada dibujo porque se escribe como flecha en la pantalla).
  const ultimaPedir = useRef(pedir);
  ultimaPedir.current = pedir;
  const hayQuePedir = pedir !== null;

  useEffect(() => {
    const funcion = ultimaPedir.current;
    if (!funcion) {
      setCargando(false);
      return;
    }
    let vigente = true;
    setCargando(true);
    setError(null);
    funcion()
      .then((respuesta) => vigente && cambiarDatos(respuesta))
      .catch((e: unknown) => vigente && setError(textoDelError(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [...dependencias, hayQuePedir, recarga]);

  const recargar = useCallback(() => setRecarga((n) => n + 1), []);

  return { datos, error, cargando, recargar, cambiarDatos };
}
