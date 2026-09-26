/*
 * Llamadas de "Mi cuenta" (/api/mi-cuenta). Todo es sobre la persona
 * conectada: el backend toma el id de la sesion, nunca de la pantalla.
 */
import { pedirAlServidor } from './cliente';
import type { EstadoDeCuenta } from './usuarios';
import type { TipoDeNombramiento } from './funcionarios';

export interface PerfilPropio {
  cuenta: {
    id: string;
    correo: string;
    estado: EstadoDeCuenta;
    ultimoAcceso: string | null;
    fechaCreacion: string;
    roles: string[];
  };
  /** null para la cuenta tecnica de Informatica. */
  funcionario: {
    cedula: string;
    nombre: string;
    primerApellido: string;
    segundoApellido: string | null;
    telefonoPersonal: string | null;
    correoPersonal: string;
    correoInstitucional: string | null;
    direccion: string | null;
    fechaIngreso: string;
    profesion: { id: string; nombre: string } | null;
    puesto: string | null;
    departamento: string | null;
    tieneFoto: boolean;
    // Datos laborales (solo lectura: los cambia Recursos Humanos).
    fechaNacimiento: string | null;
    numeroEmpleado: string | null;
    tipoNombramiento: TipoDeNombramiento;
    estado: 'activo' | 'inactivo';
    /** Nombre completo; null = tope de la jerarquia. */
    jefatura: string | null;
    regimenVacaciones: { nombre: string; descripcion: string | null };
  } | null;
  profesiones: { id: string; nombre: string }[];
  /** Tiene perfilPropio.editar. */
  puedeEditarDatos: boolean;
}

export interface DatosPersonales {
  telefonoPersonal?: string | null;
  correoPersonal?: string;
  correoInstitucional?: string | null;
  profesionId?: string | null;
  direccion?: string | null;
}

export function consultarMiCuenta() {
  return pedirAlServidor<PerfilPropio>('GET', '/mi-cuenta');
}

/** PATCH /mi-cuenta/datos-personales (perfilPropio.editar). Solo lo que cambio. */
export function actualizarMisDatos(datos: DatosPersonales) {
  return pedirAlServidor<PerfilPropio>('PATCH', '/mi-cuenta/datos-personales', { cuerpo: datos });
}
