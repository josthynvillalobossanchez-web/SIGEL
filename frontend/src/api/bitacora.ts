/*
 * Bitacora de auditoria (Sprint 3, HU 46). Solo lectura y solo para quien
 * tiene "bitacora.ver" (el Super Administrador). No existe ninguna llamada
 * para editar ni borrar: la auditoria es inmutable.
 */
import { pedirAlServidor } from './cliente';
import type { Pagina } from './usuarios';

export type AccionDeBitacora = 'crear' | 'modificar' | 'eliminar' | 'aprobar' | 'rechazar' | 'cancelar' | 'consultar' | 'descargar';

export interface MovimientoDeBitacora {
  id: string;
  fechaHora: string;
  accion: AccionDeBitacora;
  entidad: string;
  registroAfectadoId: string;
  descripcion: string | null;
  direccionIp: string | null;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  usuario: { id: string; correo: string; funcionario: { nombre: string; primerApellido: string } | null } | null;
  funcionarioAfectado: { id: string; nombre: string; primerApellido: string; segundoApellido: string | null } | null;
}

export interface FiltrosDeBitacora {
  pagina?: number;
  tamano?: number;
  usuarioId?: string;
  accion?: string;
  entidad?: string;
  registroAfectadoId?: string;
  funcionarioAfectadoId?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
}

export const consultarBitacora = (filtros: FiltrosDeBitacora) =>
  pedirAlServidor<Pagina<MovimientoDeBitacora>>('GET', '/bitacora', { parametros: { ...filtros } });
export const consultarOpcionesDeBitacora = () =>
  pedirAlServidor<{ entidades: string[]; usuarios: { id: string; correo: string; nombre: string | null }[] }>('GET', '/bitacora/opciones');

/** Como se muestra cada accion. */
export const NOMBRE_DE_ACCION: Record<AccionDeBitacora, string> = {
  crear: 'Creó',
  modificar: 'Modificó',
  eliminar: 'Dio de baja',
  aprobar: 'Aprobó',
  rechazar: 'Rechazó',
  cancelar: 'Canceló',
  consultar: 'Consultó',
  descargar: 'Descargó',
};

/** Como se muestra cada entidad (la que no este aqui se muestra tal cual). */
export const NOMBRE_DE_ENTIDAD: Record<string, string> = {
  usuario: 'Cuenta de usuario',
  funcionario: 'Funcionario',
  expediente: 'Expediente',
  documento: 'Documento',
  tipoDocumento: 'Tipo de documento',
  rol: 'Rol',
  solicitud: 'Solicitud',
  movimientoVacaciones: 'Saldo de vacaciones',
  regimenVacaciones: 'Reglas de vacaciones',
  diaNoLaborable: 'Feriado',
  incapacidad: 'Incapacidad',
  capacitacion: 'Capacitación',
  horaExtra: 'Horas extra',
  departamento: 'Departamento',
  puesto: 'Puesto',
  profesion: 'Profesión',
  tipoIncapacidad: 'Tipo de incapacidad',
};
export const nombreDeEntidad = (e: string) => NOMBRE_DE_ENTIDAD[e] ?? e;
