/**
 * Cliente HTTP de ARCA. Desde el 23/10/2026 no maneja tokens: la sesion es la
 * del sistema (cookie httpOnly que el navegador manda solo, con
 * credentials: 'include'). Si el servidor responde 401, la sesion termino y se
 * vuelve al inicio de sesion del sistema.
 */
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export interface FieldError {
  field: string;
  message: string;
}

/** Error devuelto por la API (application/problem+json). */
export class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly fieldErrors: FieldError[] = [],
    readonly extras: Record<string, unknown> = {},
  ) {
    super(detail);
  }

  get remainingAttempts(): number | undefined {
    return typeof this.extras.remainingAttempts === 'number' ? this.extras.remainingAttempts : undefined;
  }

  fieldMessage(field: string): string | undefined {
    return this.fieldErrors.find((f) => f.field === field || f.field.endsWith(`.${field}`))?.message;
  }
}

type Listener = (event: 'expired') => void;

const listeners = new Set<Listener>();
export const onSessionExpired = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Respuesta binaria (PDF, Excel) o de texto (HTML). */
  as?: 'json' | 'blob' | 'text';
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function toProblem(res: Response): Promise<ApiProblem> {
  try {
    const { code, detail, fieldErrors, ...extras } = (await res.json()) as {
      code?: string;
      detail?: string;
      fieldErrors?: FieldError[];
      [k: string]: unknown;
    };
    for (const k of ['status', 'type', 'title']) delete extras[k];
    return new ApiProblem(res.status, code ?? 'ERROR', detail ?? 'Ocurrió un error inesperado.', fieldErrors ?? [], extras);
  } catch {
    return new ApiProblem(res.status, 'ERROR', 'No se pudo completar la operación.');
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: opts.as === 'blob' || opts.as === 'text' ? '*/*' : 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiProblem(0, 'NETWORK', 'No hay conexión con el servidor. Verifique la red e intente de nuevo.');
  }

  if (res.status === 401) listeners.forEach((l) => l('expired'));
  if (!res.ok) throw await toProblem(res);
  if (res.status === 204) return undefined as T;
  if (opts.as === 'blob') return (await res.blob()) as T;
  if (opts.as === 'text') return (await res.text()) as T;
  return (await res.json()) as T;
}

/** Descarga un archivo autenticado y lo guarda con el nombre indicado. */
export async function download(path: string, query: RequestOptions['query'], filename: string) {
  const blob = await request<Blob>(path, { query, as: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
