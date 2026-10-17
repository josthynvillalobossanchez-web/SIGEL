/*
 * Talent Pool (Sprint 3, HU 38-41).
 *   - Publico (sin sesion): datos del formulario y envio del registro.
 *   - Recursos Humanos: lista con filtros, perfil, curriculum, estados,
 *     habilidades, contratar y eliminar a pedido de la persona.
 */
import type { DatosDeFuncionario, DetalleDeFuncionario } from './funcionarios';
import { pedirAlServidor, pedirArchivo } from './cliente';
import type { CuentaCreada, Pagina, RolPedido } from './usuarios';

export type NivelEducativo = 'primaria' | 'secundaria' | 'tecnico' | 'universitaria' | 'posgrado' | 'curso';
export type CategoriaDeHabilidad = 'tecnica' | 'blanda' | 'idioma' | 'herramienta';
export type NivelDeHabilidad = 'basico' | 'intermedio' | 'avanzado';
export type EstadoDeCandidato = 'activo' | 'inactivo' | 'contratado' | 'descartado';

export const NOMBRE_DE_NIVEL: Record<NivelEducativo, string> = {
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  tecnico: 'Técnico',
  universitaria: 'Universitaria',
  posgrado: 'Posgrado',
  curso: 'Curso o capacitación',
};
export const NOMBRE_DE_CATEGORIA: Record<CategoriaDeHabilidad, string> = {
  tecnica: 'Técnicas',
  blanda: 'Personales',
  idioma: 'Idiomas',
  herramienta: 'Herramientas',
};
export const NOMBRE_DE_NIVEL_DE_HABILIDAD: Record<NivelDeHabilidad, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
export const NOMBRE_DE_ESTADO: Record<EstadoDeCandidato, string> = { activo: 'Activo', inactivo: 'Inactivo', contratado: 'Contratado', descartado: 'Descartado' };

export interface HabilidadDeCatalogo {
  id: string;
  nombre: string;
  categoria: CategoriaDeHabilidad;
  activo?: boolean;
}

/* ------------------------------------------------------------------ */
/* Publico                                                             */
/* ------------------------------------------------------------------ */

export interface FormularioPublico {
  consentimiento: { id: string; version: string; titulo: string; texto: string } | null;
  profesiones: { id: string; nombre: string }[];
  habilidades: HabilidadDeCatalogo[];
  niveles: { valor: NivelEducativo; texto: string }[];
}

export interface RegistroDeCandidato {
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correo: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  residencia: string | null;
  profesionId: string | null;
  profesionTexto: string | null;
  descripcion: string | null;
  formacion: { nivel: NivelEducativo; titulo: string; institucion: string; areaEstudio: string | null; anioFinalizacion: number | null; concluido: boolean }[];
  experiencia: { empresa: string; puesto: string; desde: string | null; hasta: string | null; esActual: boolean; descripcion: string }[];
  habilidades: { habilidadId: string; nivel: NivelDeHabilidad | null }[];
  /** "Otra": escritas por la persona; solo quedan en su perfil (17/10). */
  habilidadesPropias: { nombre: string; categoria: CategoriaDeHabilidad; nivel: NivelDeHabilidad | null }[];
  consentimientoId: string;
  aceptaConsentimiento: boolean;
  /** Campo trampa: siempre vacio. */
  sitioWeb: string;
}

export const consultarFormularioPublico = () => pedirAlServidor<FormularioPublico>('GET', '/talent-pool/publico/formulario', { el401EsNormal: true });

export function enviarRegistroPublico(datos: RegistroDeCandidato, curriculum: File | null) {
  const cuerpo = new FormData();
  cuerpo.append('datos', JSON.stringify(datos));
  if (curriculum) cuerpo.append('curriculum', curriculum);
  return pedirAlServidor<{ mensaje: string }>('POST', '/talent-pool/publico/registro', { cuerpo, el401EsNormal: true });
}

/* ------------------------------------------------------------------ */
/* Recursos Humanos                                                    */
/* ------------------------------------------------------------------ */

export interface CandidatoDeLista {
  id: string;
  cedula: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  profesion: string | null;
  profesionDigitada: boolean;
  nivelMaximo: NivelEducativo | null;
  aniosExperiencia: number;
  habilidades: string[];
  estado: EstadoDeCandidato;
  tieneCurriculum: boolean;
  fechaRegistro: string;
  fechaActualizacion: string;
  funcionarioId: string | null;
}

export interface DetalleDeCandidato extends CandidatoDeLista {
  nombreSolo: string;
  primerApellido: string;
  segundoApellido: string | null;
  fechaNacimiento: string | null;
  residencia: string | null;
  descripcion: string | null;
  curriculum: { nombre: string | null; tamanoBytes: number | null } | null;
  vecesEnviado: number;
  notaInterna: string | null;
  cambioDeEstado: { fecha: string; por: string | null } | null;
  consentimiento: { version: string; fecha: string };
  funcionario: { id: string; nombre: string } | null;
  formacion: { id: string; nivel: NivelEducativo; titulo: string | null; institucion: string | null; areaEstudio: string | null; anioFinalizacion: number | null; concluido: boolean }[];
  experiencia: { id: string; empresa: string; puesto: string; fechaInicio: string | null; fechaFin: string | null; esActual: boolean; descripcion: string | null }[];
  /** propia = la escribio el candidato ("Otra"): no esta en el catalogo. */
  habilidadesDetalle: { id: string; nombre: string; categoria: CategoriaDeHabilidad; nivel: NivelDeHabilidad | null; propia: boolean }[];
}

export interface FiltrosDeCandidatos {
  busqueda?: string;
  estado?: EstadoDeCandidato | 'todos';
  profesionId?: string;
  nivel?: NivelEducativo;
  habilidades?: string;
  aniosExperiencia?: number;
  conCurriculum?: 'si' | 'no';
  orden?: 'recientes' | 'nombre';
  pagina?: number;
  tamano?: number;
}

export interface OpcionesDeTalentPool {
  profesiones: { id: string; nombre: string; activo: boolean }[];
  habilidades: HabilidadDeCatalogo[];
  niveles: { valor: NivelEducativo; texto: string }[];
}

export const consultarCandidatos = (filtros: FiltrosDeCandidatos) =>
  pedirAlServidor<Pagina<CandidatoDeLista>>('GET', '/talent-pool/candidatos', { parametros: { ...filtros } });
export const consultarResumenDeCandidatos = () => pedirAlServidor<Record<EstadoDeCandidato, number>>('GET', '/talent-pool/resumen');
export const consultarOpcionesDeTalentPool = () => pedirAlServidor<OpcionesDeTalentPool>('GET', '/talent-pool/opciones');
export const consultarCandidato = (id: string) => pedirAlServidor<DetalleDeCandidato>('GET', `/talent-pool/candidatos/${encodeURIComponent(id)}`);
export const traerCurriculum = (id: string) => pedirArchivo(`/talent-pool/candidatos/${encodeURIComponent(id)}/curriculum`);
export const cambiarCandidato = (id: string, cambios: { estado?: 'activo' | 'inactivo' | 'descartado'; notaInterna?: string | null }) =>
  pedirAlServidor<DetalleDeCandidato>('PATCH', `/talent-pool/candidatos/${encodeURIComponent(id)}`, { cuerpo: cambios });
export const eliminarCandidato = (id: string, motivo: string) =>
  pedirAlServidor<{ eliminado: true }>('POST', `/talent-pool/candidatos/${encodeURIComponent(id)}/eliminar`, { cuerpo: { motivo } });

export interface DatosParaContratar {
  id: string;
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoPersonal: string;
  telefonoPersonal: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  profesionId: string | null;
  tieneCurriculum: boolean;
}
export const consultarParaContratar = (id: string) => pedirAlServidor<DatosParaContratar>('GET', `/talent-pool/candidatos/${encodeURIComponent(id)}/para-contratar`);
export const contratarCandidato = (id: string, datos: DatosDeFuncionario & { cuenta?: { roles: RolPedido[] } }) =>
  pedirAlServidor<{ funcionario: DetalleDeFuncionario; cuenta: CuentaCreada | null; curriculumCopiado: boolean | null }>(
    'POST',
    `/talent-pool/candidatos/${encodeURIComponent(id)}/contratar`,
    { cuerpo: datos },
  );

export interface HabilidadAdministrable extends HabilidadDeCatalogo {
  descripcion: string | null;
  activo: boolean;
  candidatos: number;
}
export const consultarHabilidades = () => pedirAlServidor<HabilidadAdministrable[]>('GET', '/talent-pool/habilidades');
export const crearHabilidad = (datos: { nombre: string; categoria: CategoriaDeHabilidad }) => pedirAlServidor<{ id: string }>('POST', '/talent-pool/habilidades', { cuerpo: datos });
export const editarHabilidad = (id: string, cambios: Partial<{ nombre: string; categoria: CategoriaDeHabilidad; activo: boolean }>) =>
  pedirAlServidor<{ id: string }>('PATCH', `/talent-pool/habilidades/${encodeURIComponent(id)}`, { cuerpo: cambios });
