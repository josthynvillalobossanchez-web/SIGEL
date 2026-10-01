import {
  BadRequestException,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

/*
 * Validacion de los archivos que se suben (HU-24, Ficha 19).
 *
 * Reglas (Especificacion, secciones 21 y 22): solo PDF, JPG y PNG, maximo 25
 * MB, y el backend revisa extension, tipo MIME, tamano Y el contenido real.
 * Nunca se confia en lo que dice el navegador: un ".exe" renombrado a ".pdf"
 * trae otra firma en sus primeros bytes y se rechaza aqui.
 *
 * Cada tipo de documento elige cuales de los tres formatos acepta (por
 * ejemplo "Titulo profesional": jpg y png).
 */

/** Tamano maximo de un documento: 25 MB. */
export const TAMANO_MAXIMO_DOCUMENTO = 25 * 1024 * 1024;
/** Tamano maximo de una fotografia de perfil: 5 MB (decision de Josthyn, 30/09). */
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

export type Formato = 'pdf' | 'jpg' | 'png';

export const FORMATOS: Record<Formato, { etiqueta: string; mime: string; extensiones: string[] }> = {
  pdf: { etiqueta: 'PDF', mime: 'application/pdf', extensiones: ['pdf'] },
  jpg: { etiqueta: 'JPG', mime: 'image/jpeg', extensiones: ['jpg', 'jpeg'] },
  png: { etiqueta: 'PNG', mime: 'image/png', extensiones: ['png'] },
};

/** Orden fijo en que se muestran y se guardan. */
export const TODOS_LOS_FORMATOS: Formato[] = ['pdf', 'jpg', 'png'];

/** Lo que llega de la carga (la parte de multer que se usa). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Resultado de una validacion correcta. */
export interface ArchivoValidado {
  formato: Formato;
  mime: string;
  /** Nombre original limpio, solo informativo. */
  nombreOriginal: string;
}

/** "jpg,png" -> ['jpg', 'png'] (ignora lo que no sea un formato conocido). */
export function leerFormatos(texto: string): Formato[] {
  const pedidos = new Set(texto.split(',').map((f) => f.trim().toLowerCase()));
  return TODOS_LOS_FORMATOS.filter((f) => pedidos.has(f));
}

/** ['png', 'jpg'] -> "jpg,png" (en el orden fijo, sin repetidos). */
export function guardarFormatos(formatos: Formato[]): string {
  return TODOS_LOS_FORMATOS.filter((f) => formatos.includes(f)).join(',');
}

/** "JPG y PNG" / "PDF, JPG y PNG" para los mensajes. */
export function describirFormatos(formatos: Formato[]): string {
  const etiquetas = formatos.map((f) => FORMATOS[f].etiqueta);
  return etiquetas.length <= 1 ? etiquetas.join('') : `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}

/** Que formato dice ser el contenido, segun sus primeros bytes (la "firma" del archivo). */
export function detectarFormato(bytes: Buffer): Formato | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

/**
 * Nombre original limpio para mostrarlo: sin rutas, sin caracteres de
 * control, hasta 255 caracteres. Multer entrega el nombre como si fuera
 * latin1; si trae tildes o enies se corrige a UTF-8.
 */
export function limpiarNombreOriginal(nombre: string): string {
  let texto = nombre;
  if (/[ÂÃ]/.test(texto)) {
    const reparado = Buffer.from(texto, 'latin1').toString('utf8');
    if (!reparado.includes('�')) texto = reparado;
  }
  // eslint-disable-next-line no-control-regex
  texto = texto.replace(/[\u0000-\u001f\u007f]/g, '').split(/[\\/]/).pop()!.trim();
  if (texto.length > 255) {
    const punto = texto.lastIndexOf('.');
    const extension = punto > 0 ? texto.slice(punto) : '';
    texto = texto.slice(0, 255 - extension.length) + extension;
  }
  return texto || 'archivo';
}

/**
 * Valida un archivo contra los formatos permitidos y el tamano maximo.
 * Orden: existe y no esta vacio, tamano, formato por extension, que el tipo
 * lo acepte, MIME declarado y firma real del contenido.
 *
 * "queEs" sirve para el mensaje ("el tipo Titulo profesional", "la fotografia").
 */
export function validarArchivo(
  archivo: ArchivoSubido | undefined,
  permitidos: Formato[],
  tamanoMaximo: number,
  queEs: string,
): ArchivoValidado {
  if (!archivo) {
    throw new BadRequestException({ codigo: 'ARCHIVO_REQUERIDO', message: 'Adjunte el archivo.' });
  }
  if (archivo.size === 0 || archivo.buffer.length === 0) {
    throw new BadRequestException({ codigo: 'ARCHIVO_VACIO', message: 'El archivo está vacío.' });
  }
  if (archivo.buffer.length > tamanoMaximo) {
    throw archivoDemasiadoGrande(tamanoMaximo);
  }

  const nombreOriginal = limpiarNombreOriginal(archivo.originalname);
  const punto = nombreOriginal.lastIndexOf('.');
  const extension = punto >= 0 ? nombreOriginal.slice(punto + 1).toLowerCase() : '';
  const formato = TODOS_LOS_FORMATOS.find((f) => FORMATOS[f].extensiones.includes(extension));
  if (!formato) {
    throw new UnsupportedMediaTypeException({
      codigo: 'FORMATO_NO_PERMITIDO',
      message: 'Solo se aceptan archivos PDF, JPG y PNG.',
    });
  }
  if (!permitidos.includes(formato)) {
    throw new UnsupportedMediaTypeException({
      codigo: 'FORMATO_NO_PERMITIDO_PARA_TIPO',
      message: `${mayuscula(queEs)} solo acepta archivos ${describirFormatos(permitidos)}.`,
    });
  }
  if (archivo.mimetype.toLowerCase() !== FORMATOS[formato].mime) {
    throw new BadRequestException({
      codigo: 'MIME_NO_COINCIDE',
      message: `El tipo del archivo no coincide con su extensión .${extension}. Vuelva a guardarlo como ${FORMATOS[formato].etiqueta}.`,
    });
  }
  if (detectarFormato(archivo.buffer) !== formato) {
    throw new BadRequestException({
      codigo: 'CONTENIDO_NO_COINCIDE',
      message: `El contenido del archivo no es un ${FORMATOS[formato].etiqueta} válido. Puede estar dañado o tener otra extensión.`,
    });
  }
  return { formato, mime: FORMATOS[formato].mime, nombreOriginal };
}

/** 413 con el tope en MB. */
export function archivoDemasiadoGrande(tamanoMaximo: number): HttpException {
  return new PayloadTooLargeException({
    codigo: 'ARCHIVO_DEMASIADO_GRANDE',
    message: `El archivo supera el máximo de ${Math.round(tamanoMaximo / (1024 * 1024))} MB.`,
    statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
  });
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
