/*
 * Ventana para VER un documento sin bajarlo: PDF (visor del navegador) o
 * imagen (JPG/PNG). Es una ventana porque es solo consulta.
 *
 * El archivo se pide al backend (que revisa permisos, lo descifra y anota
 * "consultar" en la bitacora) y se muestra con una direccion temporal del
 * navegador (blob:), que se libera al cerrar. Nada queda en cache.
 *
 * Barreras para que la copia salga por el boton "Descargar" de SINERGIA (que
 * queda en la bitacora) y no por las herramientas del navegador (que no):
 *   - PDF: se pide al visor sin barra de herramientas ni panel lateral
 *     (#toolbar=0&navpanes=0), asi no aparecen sus botones de descargar e imprimir.
 *   - Imagen: sin arrastrar, sin seleccionar, sin menu del boton derecho y sin
 *     imprimirse con la pagina.
 * NO son seguridad: quien ya vio el documento puede copiarlo (Ctrl+S, captura
 * de pantalla). Solo quitan el camino mas facil. Por eso "ver" tambien queda
 * en la bitacora: significa que la persona tuvo el contenido completo a la vista.
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { abrirArchivoDeDocumento, type DocumentoDeLista } from '../../api/documentos';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { formatearTamano } from '../../utilidades/archivos';
import { descargarDocumento } from './descargar';

export function VisorDeDocumento({ documento, alCerrar }: { documento: DocumentoDeLista; alCerrar: () => void }) {
  const [direccion, setDireccion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    abrirArchivoDeDocumento(documento.id, 'ver')
      .then(({ blob }) => {
        creada = URL.createObjectURL(blob);
        if (vigente) setDireccion(creada);
        else URL.revokeObjectURL(creada);
      })
      .catch((e: unknown) => vigente && setError(textoDelError(e)));
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [documento.id]);

  async function bajar() {
    setBajando(true);
    try {
      await descargarDocumento(documento);
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setBajando(false);
    }
  }

  return (
    <Modal
      titulo={documento.titulo}
      icono="documento"
      descripcion={`${documento.tipo.nombre} · ${documento.formato.toUpperCase()} · ${formatearTamano(documento.tamanoBytes)}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar}>
            Cerrar
          </button>
          <button
            className="btn btn-primario"
            type="button"
            onClick={() => void bajar()}
            disabled={bajando}
            aria-busy={bajando}
            data-ayuda="Guardar una copia del documento en su computadora"
          >
            <Icono nombre="descargar" /> {bajando ? 'Descargando…' : 'Descargar'}
          </button>
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!direccion && !error && <p style={{ color: 'var(--texto-sec)' }}>Abriendo el documento…</p>}
      {direccion && (
        <div className="visor-doc" onContextMenu={(e) => e.preventDefault()}>
          {documento.formato === 'pdf' ? (
            <iframe src={`${direccion}#toolbar=0&navpanes=0&scrollbar=1`} title={`Documento: ${documento.titulo}`} />
          ) : (
            <img src={direccion} alt={`Documento: ${documento.titulo}`} draggable={false} />
          )}
        </div>
      )}
    </Modal>
  );
}
