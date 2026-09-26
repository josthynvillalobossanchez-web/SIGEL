/*
 * Llamadas al modulo de funcionarios (/api/funcionarios).
 * Tipos de backend/src/funcionarios/funcionarios.service.ts.
 *
 * Las fechas de calendario (nacimiento, ingreso, salida) van y vienen como
 * "AAAA-MM-DD", sin hora: se muestran con formatearFechaSola().
 */
import { pedirAlServidor } from './cliente';
import type { CuentaCreada, Pagina, RolPedido } from './usuarios';

export type TipoDeNombramiento = 'propiedad' | 'interino' | 'contratacionServicios';
export type EstadoDeFuncionario = 'activo' | 'inactivo';

export interface Referencia {
  id: string;
  nombre: string;
}

/** Una fila de la lista. */
export interface FuncionarioEnLista {
  id: string;
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoInstitucional: string | null;
  correoPersonal: string;
  puesto: Referencia | null;
  departamento: Referencia | null;
  estado: EstadoDeFuncionario;
  tieneCuenta: boolean;
  /** Es el funcionario de quien mira: no se edita a si mismo aqui. */
  esPropio: boolean;
  /** Su cuenta tiene permisos que quien mira no tiene: no se le edita, ni salida ni reingreso. */
  tieneMasAcceso: boolean;
}

/** GET /funcionarios/:id */
export interface DetalleDeFuncionario extends FuncionarioEnLista {
  fechaNacimiento: string | null;
  profesion: Referencia | null;
  telefonoPersonal: string | null;
  direccion: string | null;
  jefatura: Referencia | null;
  tipoNombramiento: TipoDeNombramiento;
  regimenVacaciones: Referencia & { descripcion: string | null };
  fechaIngreso: string;
  fechaSalida: string | null;
  motivoSalida: string | null;
  numeroEmpleado: string | null;
  cantidadACargo: number;
  cuenta: { id: string; correo: string; estado: 'activo' | 'inactivo' | 'bloqueado' } | null;
  fechaRegistro: string;
}

/** GET /funcionarios/opciones: listas ACTIVAS para los formularios. */
export interface OpcionesDeFormulario {
  departamentos: Referencia[];
  puestos: Referencia[];
  profesiones: Referencia[];
  regimenes: (Referencia & { descripcion: string | null })[];
  jefaturas: (Referencia & { puesto: string | null })[];
  tiposNombramiento: { valor: TipoDeNombramiento; texto: string }[];
}

/** Lo que se manda al registrar (y, todo opcional, al editar). */
export interface DatosDeFuncionario {
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  fechaNacimiento: string | null;
  profesionId: string | null;
  correoPersonal: string;
  correoInstitucional: string | null;
  telefonoPersonal: string | null;
  direccion: string | null;
  puestoId: string;
  departamentoId: string;
  jefaturaId: string | null;
  tipoNombramiento: TipoDeNombramiento;
  regimenVacacionesId: string;
  fechaIngreso: string;
  numeroEmpleado: string | null;
}

export interface FiltrosDeFuncionarios {
  pagina?: number;
  tamano?: number;
  busqueda?: string;
  estado?: EstadoDeFuncionario;
  departamentoId?: string;
}

/* ------------------------------------------------------------------ */

export function consultarFuncionarios(filtros: FiltrosDeFuncionarios) {
  return pedirAlServidor<Pagina<FuncionarioEnLista>>('GET', '/funcionarios', { parametros: { ...filtros } });
}

export function consultarFuncionario(id: string) {
  return pedirAlServidor<DetalleDeFuncionario>('GET', `/funcionarios/${encodeURIComponent(id)}`);
}

export function consultarOpcionesDeFuncionario() {
  return pedirAlServidor<OpcionesDeFormulario>('GET', '/funcionarios/opciones');
}

/** POST /funcionarios. Con "cuenta" crea tambien su cuenta (contrasena temporal UNA vez). */
export function registrarFuncionario(datos: DatosDeFuncionario & { cuenta?: { roles: RolPedido[] } }) {
  return pedirAlServidor<{ funcionario: DetalleDeFuncionario; cuenta: CuentaCreada | null }>('POST', '/funcionarios', { cuerpo: datos });
}

/** PATCH /funcionarios/:id: solo lo que cambia. */
export function editarFuncionario(id: string, cambios: Partial<Omit<DatosDeFuncionario, 'cedula'>>) {
  return pedirAlServidor<DetalleDeFuncionario>('PATCH', `/funcionarios/${encodeURIComponent(id)}`, { cuerpo: cambios });
}

export function registrarSalida(id: string, datos: { fechaSalida: string; motivoSalida: string }) {
  return pedirAlServidor<DetalleDeFuncionario>('POST', `/funcionarios/${encodeURIComponent(id)}/salida`, { cuerpo: datos });
}

export function registrarReingreso(id: string, fechaIngreso: string) {
  return pedirAlServidor<DetalleDeFuncionario>('POST', `/funcionarios/${encodeURIComponent(id)}/reingreso`, { cuerpo: { fechaIngreso } });
}

/** Como se nombra cada tipo de nombramiento (igual que el backend). */
export const NOMBRES_DE_NOMBRAMIENTO: Record<TipoDeNombramiento, string> = {
  propiedad: 'En propiedad',
  interino: 'Interino',
  contratacionServicios: 'Contratación por servicios',
};

/** "general" -> "General" (los regimenes vienen en minuscula desde la semilla). */
export function nombreDeRegimen(nombre: string): string {
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
