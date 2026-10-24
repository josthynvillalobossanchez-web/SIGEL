import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiProblem } from '../api/http';

export interface AsyncState<T> {
  data: T | undefined;
  error: ApiProblem | null;
  loading: boolean;
  reload: () => void;
}

/** Carga datos al montar y cuando cambian las dependencias; ignora respuestas obsoletas. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    fn()
      .then((d) => {
        if (id === latest.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (id === latest.current) setError(e instanceof ApiProblem ? e : new ApiProblem(0, 'ERROR', 'No se pudo cargar la información.'));
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

/** Mensaje legible de cualquier error capturado. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiProblem ? e.message : 'Ocurrió un error inesperado.';
}
