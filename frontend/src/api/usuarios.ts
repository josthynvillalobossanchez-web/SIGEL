/*
 * Llamadas al modulo de usuarios del backend (/api/usuarios/...).
 * Los tipos reflejan lo que devuelve backend/src/usuarios/usuarios.service.ts.
 * Si el backend cambia la forma de una respuesta, cambiarla aqui tambien.
 */
import { pedirAlServidor } from './cliente';

export type EstadoDeCuenta = 'activo' | 'inactivo' | 'bloqueado';

/** Pagina de resultados (armarPagina en backend/src/comun/dto/paginacion.dto.ts). */
export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Datos minimos de la persona duena de una cuenta. */
export interface FuncionarioResumido {
  id: string;
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
}

/** Una fila de la lista de cuentas. */
export interface CuentaEnLista {
  id: string;
  correo: string;
  estado: EstadoDeCuenta;
  debeCambiarContrasena: boolean;
  /** Fecha ISO si esta en el bloqueo temporal de 3 minutos por intentos fallidos. */
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  fechaCreacion: string;
  /** null solo para la cuenta tecnica de Informatica. */
  funcionario: FuncionarioResumido | null;
  /** Solo los roles vigentes. */
  roles: { id: string; nombre: string }[];
  /** Por que quien consulta NO puede modificarla (null = si puede). */
  motivoNoModificable: 'CUENTA_PROPIA' | 'CUENTA_CON_MAYOR_ACCESO' | null;
}

/** Un rol dentro del detalle de una cuenta (vigente o vencido). */
export interface RolDeCuenta {
  id: string;
  nombre: string;
  descripcion: string | null;
  fechaAsignacion: string;
  fechaVencimiento: string | null;
  vigente: boolean;
}

/** Un permiso individual (excepcion) dentro del detalle de una cuenta. */
export interface PermisoIndividual {
  id: string;
  clave: string;
  modulo: string;
  descripcion: string | null;
  /** true = concedido aunque el rol no lo de; false = quitado aunque el rol lo de. */
  otorgado: boolean;
  observacion: string | null;
  fechaAsignacion: string;
  fechaVencimiento: string | null;
  vigente: boolean;
}

/** GET /usuarios/:id */
export interface DetalleDeCuenta {
  id: string;
  correo: string;
  estado: EstadoDeCuenta;
  debeCambiarContrasena: boolean;
  bloqueadoHasta: string | null;
  intentosFallidos: number;
  ultimoAcceso: string | null;
  fechaCreacion: string;
  fechaActualizacion: string | null;
  funcionario: (FuncionarioResumido & { correoInstitucional: string | null }) | null;
  roles: RolDeCuenta[];
  permisos: PermisoIndividual[];
  /** Lo que la cuenta puede hacer de verdad (roles + excepciones vigentes). */
  permisosEfectivos: string[];
  /** Si quien consulta puede cambiarle algo (reglas 3 y 4 de reparto de acceso). */
  puedoModificar: boolean;
  motivoNoModificable: 'CUENTA_PROPIA' | 'CUENTA_CON_MAYOR_ACCESO' | null;
}

export interface FiltrosDeCuentas {
  pagina?: number;
  tamano?: number;
  busqueda?: string;
  estado?: EstadoDeCuenta;
  rolId?: string;
}

/** Funcionario activo sin cuenta (para "Crear usuario"). */
export interface FuncionarioDisponible extends FuncionarioResumido {
  correoInstitucional: string | null;
}

/** Respuesta de POST /usuarios. La contrasena temporal viene UNA sola vez. */
export interface CuentaCreada {
  id: string;
  correo: string;
  funcionarioId: string;
  roles: { id: string; nombre: string; fechaVencimiento: string | null }[];
  contrasenaTemporal: string;
}

/** Un rol pedido al crear la cuenta o al asignarlo. Fecha "AAAA-MM-DD" o nada. */
export interface RolPedido {
  rolId: string;
  fechaVencimiento?: string;
}

/* ------------------------------------------------------------------ */

/** GET /usuarios (usuarios.ver). */
export function consultarCuentas(filtros: FiltrosDeCuentas) {
  return pedirAlServidor<Pagina<CuentaEnLista>>('GET', '/usuarios', { parametros: { ...filtros } });
}

/** GET /usuarios/:id (usuarios.ver). */
export function consultarCuenta(id: string) {
  return pedirAlServidor<DetalleDeCuenta>('GET', `/usuarios/${encodeURIComponent(id)}`);
}

/** GET /usuarios/funcionarios-disponibles (usuarios.crear). */
export function buscarFuncionariosDisponibles(busqueda: string) {
  return pedirAlServidor<FuncionarioDisponible[]>('GET', '/usuarios/funcionarios-disponibles', {
    parametros: { busqueda },
  });
}

/** POST /usuarios (usuarios.crear). Sin "correo" usa el institucional. */
export function crearCuenta(datos: { funcionarioId: string; correo?: string; roles: RolPedido[] }) {
  return pedirAlServidor<CuentaCreada>('POST', '/usuarios', { cuerpo: datos });
}

/** PATCH /usuarios/:id/estado (usuarios.cambiarEstado). Motivo obligatorio salvo al activar. */
export function cambiarEstadoDeCuenta(id: string, estado: EstadoDeCuenta, motivo?: string) {
  return pedirAlServidor<unknown>('PATCH', `/usuarios/${encodeURIComponent(id)}/estado`, {
    cuerpo: motivo ? { estado, motivo } : { estado },
  });
}

/**
 * PATCH /usuarios/:id (usuarios.editar): ventana "Editar usuario".
 * "roles" es la lista COMPLETA que debe quedar (lo que no venga se quita).
 * Todo se guarda junto o nada.
 */
export function editarCuenta(id: string, datos: { correo?: string; roles?: RolPedido[] }) {
  return pedirAlServidor<DetalleDeCuenta>('PATCH', `/usuarios/${encodeURIComponent(id)}`, { cuerpo: datos });
}

/** POST /usuarios/:id/roles (usuarios.editar): asigna o cambia la vigencia. */
export function asignarRol(id: string, rol: RolPedido) {
  return pedirAlServidor<DetalleDeCuenta>('POST', `/usuarios/${encodeURIComponent(id)}/roles`, { cuerpo: rol });
}

/** DELETE /usuarios/:id/roles/:rolId (usuarios.editar). */
export function quitarRol(id: string, rolId: string) {
  return pedirAlServidor<DetalleDeCuenta>(
    'DELETE',
    `/usuarios/${encodeURIComponent(id)}/roles/${encodeURIComponent(rolId)}`,
  );
}

/** PUT /usuarios/:id/permisos/:permisoId (usuarios.editar). */
export function ajustarPermiso(
  id: string,
  permisoId: string,
  datos: { otorgado: boolean; fechaVencimiento?: string; observacion?: string },
) {
  return pedirAlServidor<DetalleDeCuenta>(
    'PUT',
    `/usuarios/${encodeURIComponent(id)}/permisos/${encodeURIComponent(permisoId)}`,
    { cuerpo: datos },
  );
}

/**
 * POST /usuarios/:id/permisos (usuarios.editar): pagina "Agregar excepcion".
 * Varios permisos a la vez, con el mismo efecto, fecha y motivo (obligatorio).
 */
export function ajustarVariosPermisos(
  id: string,
  datos: { permisoIds: string[]; otorgado: boolean; fechaVencimiento?: string; observacion: string },
) {
  return pedirAlServidor<DetalleDeCuenta>('POST', `/usuarios/${encodeURIComponent(id)}/permisos`, { cuerpo: datos });
}

/** DELETE /usuarios/:id/permisos/:permisoId (usuarios.editar). */
export function quitarPermisoIndividual(id: string, permisoId: string) {
  return pedirAlServidor<DetalleDeCuenta>(
    'DELETE',
    `/usuarios/${encodeURIComponent(id)}/permisos/${encodeURIComponent(permisoId)}`,
  );
}
