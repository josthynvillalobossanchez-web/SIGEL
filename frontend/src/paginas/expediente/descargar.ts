/*
 * Baja un documento a la computadora: lo pide al backend (modo "descargar",
 * que queda en la bitacora como descarga) y dispara el guardado del
 * navegador con el nombre original del archivo.
 */
import { abrirArchivoDeDocumento, type DocumentoDeLista } from '../../api/documentos';

export async function descargarDocumento(documento: Pick<DocumentoDeLista, 'id' | 'nombreArchivo'>): Promise<void> {
  const { blob } = await abrirArchivoDeDocumento(documento.id, 'descargar');
  const direccion = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = documento.nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // El navegador ya tomo el archivo; se libera la memoria un momento despues.
  window.setTimeout(() => URL.revokeObjectURL(direccion), 10_000);
}
