/*
 * Reglas de archivos que se revisan en el navegador ANTES de subir, para
 * avisar rapido. El backend las revisa otra vez (extension, tipo, firma real
 * del archivo y tamano): esta copia solo evita esperar una subida inutil.
 * Mantener iguales a backend/src/almacenamiento/validacion-de-archivos.ts.
 */
import type { Formato } from '../api/documentos';

export const TAMANO_MAXIMO_DOCUMENTO = 25 * 1024 * 1024;
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Como se llama cada formato en pantalla, y su extension. */
export const NOMBRE_DE_FORMATO: Record<Formato, string> = { pdf: 'PDF', jpg: 'JPG', png: 'PNG' };
export const TODOS_LOS_FORMATOS: Formato[] = ['pdf', 'jpg', 'png'];

/** "PDF", "PDF y JPG", "PDF, JPG y PNG". */
export function describirFormatos(formatos: Formato[]): string {
  const nombres = formatos.map((f) => NOMBRE_DE_FORMATO[f]);
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** Valor del atributo accept de un <input type="file">. */
export function aceptarDeFormatos(formatos: Formato[]): string {
  return formatos.flatMap((f) => (f === 'jpg' ? ['.jpg', '.jpeg'] : [`.${f}`])).join(',');
}

/** "850 KB", "2,4 MB". */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CR', { maximumFractionDigits: 1 })} MB`;
}

/** Formato segun la extension del nombre, o null si no es uno permitido. */
export function formatoDelNombre(nombre: string): Formato | null {
  const extension = nombre.toLowerCase().split('.').pop() ?? '';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'jpg';
  if (extension === 'png') return 'png';
  return null;
}

/** Problema del archivo elegido (texto para la persona) o null si se puede subir. */
export function problemaDeArchivo(archivo: File, permitidos: Formato[], tamanoMaximo: number): string | null {
  if (archivo.size === 0) return 'El archivo está vacío.';
  const formato = formatoDelNombre(archivo.name);
  if (!formato) return `Ese tipo de archivo no se acepta. Solo ${describirFormatos(permitidos)}.`;
  if (!permitidos.includes(formato)) return `Este documento solo acepta archivos ${describirFormatos(permitidos)}.`;
  if (archivo.size > tamanoMaximo) {
    return `El archivo pesa ${formatearTamano(archivo.size)} y el máximo es ${formatearTamano(tamanoMaximo)}.`;
  }
  return null;
}
