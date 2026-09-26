/*
 * Llamadas de "Mi cuenta" (/api/mi-cuenta). Todo es sobre la persona
 * conectada: el backend toma el id de la sesion, nunca de la pantalla.
 * Tipos de backend/src/mi-cuenta/mi-cuenta.service.ts.
 */
import { pedirAlServidor } from './cliente';
import type { EstadoDeCuenta } from './usuarios';
import type { DatosDeFuncionario, DetalleDeFuncionario, OpcionesDeFormulario } from './funcionarios';

export interface PerfilPropio {
  cuenta: {
    id: string;
    correo: string;
    estado: EstadoDeCuenta;
    ultimoAcceso: string | null;
    fechaCreacion: string;
    roles: string[];
  };
  /** Ficha completa (la misma de Funcionarios); null para la cuenta tecnica de Informatica. */
  funcionario: (DetalleDeFuncionario & { tieneFoto: boolean }) | null;
  profesiones: { id: string; nombre: string }[];
  /** Tiene perfilPropio.editar: cambia sus datos personales (menos la cedula). */
  puedeEditarDatos: boolean;
  /** Tiene funcionarios.editar (Recursos Humanos): cambia tambien sus datos laborales. */
  puedeEditarLaborales: boolean;
  /** Listas del formulario laboral (solo si puedeEditarLaborales; sin la propia persona en jefaturas). */
  opcionesLaborales: OpcionesDeFormulario | null;
}

/** Lo que la persona cambia de si misma: todo lo personal menos la cedula. */
export type DatosPersonales = Partial<
  Pick<
    DatosDeFuncionario,
    | 'nombre'
    | 'primerApellido'
    | 'segundoApellido'
    | 'fechaNacimiento'
    | 'profesionId'
    | 'correoPersonal'
    | 'correoInstitucional'
    | 'telefonoPersonal'
    | 'direccion'
  >
>;

/** Lo laboral que Recursos Humanos cambia de si mismo. */
export type DatosLaborales = Partial<
  Pick<DatosDeFuncionario, 'puestoId' | 'departamentoId' | 'jefaturaId' | 'tipoNombramiento' | 'regimenVacacionesId' | 'fechaIngreso' | 'numeroEmpleado'>
>;

export function consultarMiCuenta() {
  return pedirAlServidor<PerfilPropio>('GET', '/mi-cuenta');
}

/** PATCH /mi-cuenta/datos-personales (perfilPropio.editar). Solo lo que cambio. */
export function actualizarMisDatos(datos: DatosPersonales) {
  return pedirAlServidor<PerfilPropio>('PATCH', '/mi-cuenta/datos-personales', { cuerpo: datos });
}

/** PATCH /mi-cuenta/datos-laborales (funcionarios.editar). Solo lo que cambio. */
export function actualizarMisDatosLaborales(datos: DatosLaborales) {
  return pedirAlServidor<PerfilPropio>('PATCH', '/mi-cuenta/datos-laborales', { cuerpo: datos });
}
