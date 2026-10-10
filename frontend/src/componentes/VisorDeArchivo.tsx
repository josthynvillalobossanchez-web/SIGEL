/*
 * Ventana para VER un archivo que llega del backend como Blob (constancia,
 * boleta, certificado, justificante), con las mismas barreras que el visor
 * del expediente (PDF sin barra de herramientas, imagen sin arrastrar). Quien
 * lo llama dice como se trae el archivo y, si se puede, como se descarga
 * (la descarga queda en la bitacora como tal).
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../api/cliente';
import { Icono } from './Icono';
import { Mensaje } from './Mensaje';
import { Modal } from './Modal';

type Archivo = { blob: Blob; tipo: string };

export function VisorDeArchivo({
  titulo,
  descripcion,
  traer,
  descargar,
  nombreAlDescargar,
  alCerrar,
}: {
  titulo: string;
  descripcion?: string;
  traer: () => Promise<Archivo>;
  /** Pide el archivo en modo "descargar"; si no viene, se guarda el mismo que se esta viendo. */
  descargar?: () => Promise<Archivo>;
  nombreAlDescargar: string;
  alCerrar: () => void;
}) {
  const [archivo, setArchivo] = useState<{ direccion: string; tipo: string; blob: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);

  useEffect(() => {
    let vigente = true;
    let creada: string | null = null;
    traer()
      .then(({ blob, tipo }) => {
        creada = URL.createObjectURL(blob);
        if (vigente) setArchivo({ direccion: creada, tipo, blob });
        else URL.revokeObjectURL(creada);
      })
      .catch((e: unknown) => vigente && setError(textoDelError(e)));
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
    // Se trae una sola vez al abrir la ventana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bajar() {
    setBajando(true);
    setError(null);
    try {
      const blob = descargar ? (await descargar()).blob : archivo?.blob;
      if (!blob) return;
      // Sin extension en el nombre: se pone la que corresponde al tipo de archivo.
      const extension = blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : '.jpg';
      const nombre = /\.[a-z0-9]{3,4}$/i.test(nombreAlDescargar) ? nombreAlDescargar : nombreAlDescargar + extension;
      const direccion = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = direccion;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(direccion), 10_000);
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setBajando(false);
    }
  }

  const esPdf = archivo?.tipo.includes('pdf');
  return (
    <Modal
      titulo={titulo}
      descripcion={descripcion}
      icono="documento"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} data-ayuda="Cerrar el visor">
            Cerrar
          </button>
          <button className="btn btn-primario" type="button" onClick={() => void bajar()} disabled={bajando || !archivo} aria-busy={bajando} data-ayuda="Guardar una copia en su computadora">
            <Icono nombre="descargar" /> {bajando ? 'Descargando…' : 'Descargar'}
          </button>
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!archivo && !error && <p style={{ color: 'var(--texto-sec)' }}>Abriendo el archivo…</p>}
      {archivo && (
        <div className="visor-doc" onContextMenu={(e) => e.preventDefault()}>
          {esPdf ? (
            <iframe src={`${archivo.direccion}#toolbar=0&navpanes=0&scrollbar=1`} title={titulo} />
          ) : (
            <img src={archivo.direccion} alt={titulo} draggable={false} />
          )}
        </div>
      )}
    </Modal>
  );
}
