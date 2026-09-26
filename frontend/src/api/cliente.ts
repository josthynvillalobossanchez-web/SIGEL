/*
 * Cliente HTTP de SIGEL: la UNICA puerta de salida hacia el backend.
 *
 * Todas las pantallas llaman al backend por medio de `pedirAlServidor`
 * (o de las funciones de api/*.ts que lo usan). Asi hay un solo lugar donde:
 *   - se manda la cookie de sesion (credentials: 'include');
 *   - se convierte cualquier error en un ErrorDeApi con `codigo` y `message`;
 *   - se avisa a la sesion cuando el backend responde 401 (sesion vencida).
 *
 * Formato de error del backend (lo arma FiltroDeExcepciones):
 *   { statusCode, codigo, message, detalles?, ruta }
 * La pantalla decide QUE hacer segun `codigo` (nunca comparar `message`,
 * que es texto para personas y puede cambiar de redaccion).
 */

/** Prefijo de todas las rutas del backend (main.ts usa setGlobalPrefix('api')). */
const PREFIJO_API = '/api';

/** Error que devuelve cualquier llamada al backend que no salio bien. */
export class ErrorDeApi extends Error {
  /** Codigo HTTP (0 si ni siquiera se pudo conectar). */
  readonly estado: number;
  /** Codigo estable para decidir en pantalla, p. ej. CREDENCIALES_INVALIDAS. */
  readonly codigo: string;
  /** Mensajes extra de validacion (uno por campo con problema), si los hay. */
  readonly detalles: string[];
  /**
   * Datos adicionales que algunos errores traen, p. ej. `segundosRestantes`
   * en CUENTA_BLOQUEADA_TEMPORALMENTE.
   */
  readonly extras: Record<string, unknown>;

  constructor(
    estado: number,
    codigo: string,
    mensaje: string,
    detalles: string[] = [],
    extras: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
    this.extras = extras;
  }
}

/** Opciones de una llamada. */
interface OpcionesDePedido {
  /** Cuerpo a enviar como JSON (solo POST/PUT/PATCH). */
  cuerpo?: unknown;
  /** Parametros de la URL (?pagina=1&busqueda=...). Se omiten los vacios. */
  parametros?: Record<string, string | number | boolean | undefined | null>;
  /**
   * true = un 401 NO significa "se vencio la sesion". Se usa en los
   * formularios de acceso (iniciar sesion, restablecer contrasena), donde
   * un 401 es parte normal del flujo y no debe sacar a nadie del sistema.
   */
  el401EsNormal?: boolean;
}

/* ------------------------------------------------------------------ */
/* Aviso de "sesion perdida"                                           */
/* ------------------------------------------------------------------ */

type OyenteDeSesionPerdida = () => void;
let oyenteDeSesionPerdida: OyenteDeSesionPerdida | null = null;

/**
 * El proveedor de sesion se registra aqui para enterarse cuando el backend
 * responde 401 (cookie vencida, cuenta desactivada mientras estaba adentro...).
 * Solo hay un oyente porque solo hay un proveedor de sesion en la aplicacion.
 */
export function alPerderLaSesion(oyente: OyenteDeSesionPerdida | null): void {
  oyenteDeSesionPerdida = oyente;
}

/* ------------------------------------------------------------------ */
/* Llamada principal                                                   */
/* ------------------------------------------------------------------ */

/**
 * Hace una llamada al backend y devuelve el JSON de la respuesta ya tipado.
 * Si el backend responde con error, lanza ErrorDeApi.
 *
 * @example
 *   const datos = await pedirAlServidor<MiTipo>('GET', '/usuarios', { parametros: { pagina: 1 } });
 */
export async function pedirAlServidor<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  opciones: OpcionesDePedido = {},
): Promise<T> {
  const url = PREFIJO_API + ruta + armarParametros(opciones.parametros);
  const tieneCuerpo = opciones.cuerpo !== undefined;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      // Manda y recibe la cookie de sesion (httpOnly: JavaScript no la puede leer).
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(tieneCuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: tieneCuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });
  } catch {
    // fetch solo falla asi cuando no hay red o el backend esta apagado.
    throw new ErrorDeApi(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
    );
  }

  // 204 = exito sin contenido.
  if (respuesta.status === 204) return undefined as T;

  const cuerpo = await leerJsonSinFallar(respuesta);

  if (respuesta.ok) return cuerpo as T;

  const error = convertirEnError(respuesta.status, cuerpo);
  if (error.estado === 401 && !opciones.el401EsNormal) oyenteDeSesionPerdida?.();
  throw error;
}

/* ------------------------------------------------------------------ */
/* Ayudantes internos                                                  */
/* ------------------------------------------------------------------ */

/** Convierte { pagina: 1, busqueda: '' } en "?pagina=1" (omite vacios). */
function armarParametros(parametros?: OpcionesDePedido['parametros']): string {
  if (!parametros) return '';
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    busqueda.set(clave, String(valor));
  }
  const texto = busqueda.toString();
  return texto ? `?${texto}` : '';
}

/** Lee el JSON de la respuesta; si no es JSON (p. ej. un error del proxy) devuelve null. */
async function leerJsonSinFallar(respuesta: Response): Promise<unknown> {
  const texto = await respuesta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Arma un ErrorDeApi a partir del cuerpo de error del backend. */
function convertirEnError(estado: number, cuerpo: unknown): ErrorDeApi {
  const datos = (cuerpo ?? {}) as Record<string, unknown>;

  const codigo = typeof datos.codigo === 'string' ? datos.codigo : codigoPorEstado(estado);
  const mensaje = typeof datos.message === 'string' ? datos.message : mensajePorEstado(estado);
  const detalles = Array.isArray(datos.detalles)
    ? datos.detalles.filter((d): d is string => typeof d === 'string')
    : [];

  // Todo lo que no es parte del formato fijo se guarda como "extras".
  const { statusCode: _e, codigo: _c, message: _m, detalles: _d, ruta: _r, ...extras } = datos;
  return new ErrorDeApi(estado, codigo, mensaje, detalles, extras);
}

/**
 * Codigo de respaldo cuando la respuesta no trae uno (no deberia pasar con
 * nuestro backend, pero si el proxy o el servidor web responden por su cuenta).
 */
function codigoPorEstado(estado: number): string {
  if (estado === 429) return 'DEMASIADAS_SOLICITUDES';
  if (estado === 502 || estado === 503 || estado === 504) return 'SERVIDOR_NO_DISPONIBLE';
  return 'ERROR_DESCONOCIDO';
}

function mensajePorEstado(estado: number): string {
  if (estado === 429) return 'Hizo demasiados intentos seguidos. Espere unos minutos e intente de nuevo.';
  if (estado >= 500) return 'El servidor no está disponible en este momento. Intente de nuevo en unos minutos.';
  return 'No se pudo completar la operación.';
}

/**
 * Texto listo para mostrar a partir de cualquier error atrapado en un catch.
 * Si el error trae detalles de validacion, los agrega.
 */
export function textoDelError(error: unknown): string {
  if (error instanceof ErrorDeApi) {
    return error.detalles.length ? `${error.message} ${error.detalles.join(' ')}` : error.message;
  }
  return 'Ocurrió un error inesperado. Si se repite, avise al Departamento de TI.';
}
