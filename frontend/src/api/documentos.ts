/*
 * Llamadas de la gestion documental: documentos del expediente, tipos de
 * documento y fotografia de perfil.
 * Tipos de backend/src/documentos/*.ts y backend/src/tipos-documento/*.ts.
 *
 * Los archivos viajan cifrados en el servidor; aqui solo se piden ya
 * descifrados por el backend (que revisa permisos y anota en la bitacora).
 * La ruta del archivo en el servidor nunca llega al navegador.
 */
import { pedirAlServidor, pedirArchivo } from './cliente';
import type { Pagina } from './usuarios';

export type Formato = 'pdf' | 'jpg' | 'png';

/* ------------------------------------------------------------------ */
/* Documentos del expediente                                           */
/* ------------------------------------------------------------------ */

export interface DocumentoDeLista {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: { id: string; nombre: string };
  nombreArchivo: string;
  formato: Formato;
  tamanoBytes: number;
  /** Fecha del documento (emision), "AAAA-MM-DD". */
  fechaDocumento: string | null;
  /** Cuando se subio (ISO). */
  fechaRegistro: string;
  generadoPorSistema: boolean;
  /** Quien lo subio; null si lo genero SINERGIA. */
  subidoPor: string | null;
  subidoPorElFuncionario: boolean;
  vigente: boolean;
  /** Datos de la baja: solo los ve quien puede restaurar (Recursos Humanos). */
  baja: { fecha: string | null; motivo: string | null; quien: string | null; porElFuncionario: boolean } | null;
  /** Lo que la persona puede hacer y, si no puede, por que (texto listo para el globo de ayuda). */
  acciones: {
    puedeEditar: boolean;
    motivoSinEditar: string | null;
    puedeDarDeBaja: boolean;
    motivoSinBaja: string | null;
    puedeRestaurar: boolean;
    motivoSinRestaurar: string | null;
  };
}

export type EstadoDeDocumentos = 'vigentes' | 'bajas' | 'todos';

export interface FiltroDeDocumentos {
  pagina: number;
  tamano?: number;
  busqueda?: string;
  tipoDocumentoId?: string;
  estado?: EstadoDeDocumentos;
}

/** GET /expedientes/:id/documentos (expediente.ver; el ajeno solo con expediente.verTodos). */
export function consultarDocumentos(funcionarioId: string, filtro: FiltroDeDocumentos) {
  return pedirAlServidor<Pagina<DocumentoDeLista>>('GET', `/expedientes/${encodeURIComponent(funcionarioId)}/documentos`, {
    parametros: { ...filtro, tamano: filtro.tamano ?? 10 },
  });
}

export interface DatosDeDocumentoNuevo {
  tipoDocumentoId: string;
  titulo: string;
  descripcion?: string;
  /** "AAAA-MM-DD". */
  fechaDocumento?: string;
}

/** POST /expedientes/:id/documentos (documentos.crear), multipart: el archivo va en el campo "archivo". */
export function subirDocumento(funcionarioId: string, datos: DatosDeDocumentoNuevo, archivo: File) {
  const formulario = new FormData();
  formulario.append('tipoDocumentoId', datos.tipoDocumentoId);
  formulario.append('titulo', datos.titulo);
  if (datos.descripcion) formulario.append('descripcion', datos.descripcion);
  if (datos.fechaDocumento) formulario.append('fechaDocumento', datos.fechaDocumento);
  formulario.append('archivo', archivo, archivo.name);
  return pedirAlServidor<DocumentoDeLista>('POST', `/expedientes/${encodeURIComponent(funcionarioId)}/documentos`, { cuerpo: formulario });
}

/** PATCH /documentos/:id. "" en descripcion o fechaDocumento la quita. El archivo nunca se reemplaza. */
export function editarDocumento(id: string, cambios: { titulo?: string; tipoDocumentoId?: string; descripcion?: string; fechaDocumento?: string }) {
  return pedirAlServidor<DocumentoDeLista>('PATCH', `/documentos/${encodeURIComponent(id)}`, { cuerpo: cambios });
}

/** POST /documentos/:id/baja (baja logica: el archivo se conserva). */
export function darDeBajaDocumento(id: string, motivo?: string) {
  return pedirAlServidor<{ id: string; vigente: boolean }>('POST', `/documentos/${encodeURIComponent(id)}/baja`, {
    cuerpo: motivo ? { motivo } : {},
  });
}

/** POST /documentos/:id/restauracion (documentos.restaurar). */
export function restaurarDocumento(id: string) {
  return pedirAlServidor<DocumentoDeLista>('POST', `/documentos/${encodeURIComponent(id)}/restauracion`, { cuerpo: {} });
}

/**
 * GET /documentos/:id/archivo (documentos.descargar). "ver" queda en la
 * bitacora como consulta y "descargar" como descarga.
 */
export function abrirArchivoDeDocumento(id: string, modo: 'ver' | 'descargar') {
  return pedirArchivo(`/documentos/${encodeURIComponent(id)}/archivo`, { modo });
}

/* ------------------------------------------------------------------ */
/* Tipos de documento                                                  */
/* ------------------------------------------------------------------ */

export interface TipoDeDocumento {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** Los crea SINERGIA (constancia, curriculum): solo se les cambia el nombre. */
  generadoPorSistema: boolean;
  formatos: Formato[];
  cantidadDocumentos: number;
}

/** GET /tipos-documento. paraSubir = solo los activos que una persona puede elegir al subir. */
export function consultarTiposDeDocumento(opciones: { soloActivos?: boolean; paraSubir?: boolean } = {}) {
  return pedirAlServidor<TipoDeDocumento[]>('GET', '/tipos-documento', {
    parametros: { soloActivos: opciones.soloActivos ? 'true' : undefined, paraSubir: opciones.paraSubir ? 'true' : undefined },
  });
}

/** POST /tipos-documento (tiposDocumento.editar). */
export function crearTipoDeDocumento(datos: { nombre: string; descripcion?: string; formatos: Formato[] }) {
  return pedirAlServidor<TipoDeDocumento>('POST', '/tipos-documento', { cuerpo: datos });
}

/** PATCH /tipos-documento/:id. "" en descripcion la quita. */
export function editarTipoDeDocumento(id: string, cambios: { nombre?: string; descripcion?: string; formatos?: Formato[] }) {
  return pedirAlServidor<TipoDeDocumento>('PATCH', `/tipos-documento/${encodeURIComponent(id)}`, { cuerpo: cambios });
}

/** PATCH /tipos-documento/:id/estado. */
export function cambiarEstadoDeTipoDeDocumento(id: string, activo: boolean) {
  return pedirAlServidor<TipoDeDocumento>('PATCH', `/tipos-documento/${encodeURIComponent(id)}/estado`, { cuerpo: { activo } });
}

/* ------------------------------------------------------------------ */
/* Fotografia de perfil                                                */
/* ------------------------------------------------------------------ */

/**
 * Direccion de la fotografia para un <img>. La version ("v") hace que el
 * navegador la vuelva a pedir despues de cambiarla (el backend la sirve
 * sin cache compartido).
 */
export function direccionDeFoto(funcionarioId: string, version: number): string {
  return `/api/funcionarios/${encodeURIComponent(funcionarioId)}/foto?v=${version}`;
}

/** PUT /funcionarios/:id/foto: JPG o PNG, maximo 5 MB. Ella misma (perfilPropio.editar) o Recursos Humanos. */
export function cambiarFoto(funcionarioId: string, archivo: File) {
  const formulario = new FormData();
  formulario.append('archivo', archivo, archivo.name);
  return pedirAlServidor<{ tieneFoto: true }>('PUT', `/funcionarios/${encodeURIComponent(funcionarioId)}/foto`, { cuerpo: formulario });
}

/** DELETE /funcionarios/:id/foto: vuelve a las iniciales (el archivo anterior queda guardado en el servidor). */
export function quitarFoto(funcionarioId: string) {
  return pedirAlServidor<{ tieneFoto: false }>('DELETE', `/funcionarios/${encodeURIComponent(funcionarioId)}/foto`);
}
