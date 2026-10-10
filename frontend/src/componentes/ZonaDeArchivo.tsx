/*
 * Zona para elegir un archivo: recuadro con linea punteada, icono de nube,
 * "Arrastre y suelte su archivo aqui, o examine sus archivos" y los formatos
 * que acepta en etiquetas de color. La usan "Subir documento", la ventana
 * de la fotografia de perfil y los tramites (justificante, boleta, certificado).
 *
 * Con un archivo ya elegido (revision de Josthyn, 09/10) se convierte en una
 * tarjeta que se distingue de un vistazo: borde solido verde, miniatura (si es
 * imagen) o la "hoja" del formato con su color, el nombre, el tamano, una marca
 * de "Listo" y los botones Cambiar y (si la pagina lo permite) Quitar.
 *
 * Por dentro sigue siendo un <input type="file"> normal, estirado y
 * transparente sobre todo el recuadro: asi funcionan solos el clic, el
 * teclado (Tab y Enter o Espacio), los lectores de pantalla y soltar un
 * archivo encima. Este componente no valida nada: avisa con alElegir y la
 * pagina revisa el archivo (utilidades/archivos.ts) y muestra el mensaje.
 */
import { useEffect, useRef, useState, type Ref } from 'react';
import type { Formato } from '../api/documentos';
import { aceptarDeFormatos, describirFormatos, formatearTamano, formatoDelNombre, NOMBRE_DE_FORMATO } from '../utilidades/archivos';
import { Icono } from './Icono';

export function ZonaDeArchivo({
  id,
  formatos,
  tamanoMaximo,
  archivo,
  alElegir,
  alQuitar,
  entradaRef,
  invalido,
  obligatorio,
  descritoPor,
}: {
  /** id del <input>: la etiqueta del campo apunta a el. */
  id: string;
  formatos: Formato[];
  tamanoMaximo: number;
  /** Archivo ya elegido (se muestra como tarjeta dentro del recuadro). */
  archivo: File | null;
  alElegir: (archivo: File | undefined) => void;
  /** Si viene, aparece el boton "Quitar" para volver a dejarlo vacio. */
  alQuitar?: () => void;
  entradaRef?: Ref<HTMLInputElement>;
  invalido?: boolean;
  obligatorio?: boolean;
  /** id del texto de ayuda o error que lee el lector de pantalla. */
  descritoPor?: string;
}) {
  // Solo para pintar el recuadro mientras se arrastra un archivo encima.
  const [arrastrando, setArrastrando] = useState(false);
  const entradaPropia = useRef<HTMLInputElement | null>(null);
  const formato = archivo ? formatoDelNombre(archivo.name) : null;
  const esImagen = formato === 'jpg' || formato === 'png';

  // Miniatura de las imagenes (direccion temporal que se libera al cambiar o salir).
  const [miniatura, setMiniatura] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo || !esImagen) {
      setMiniatura(null);
      return;
    }
    const direccion = URL.createObjectURL(archivo);
    setMiniatura(direccion);
    return () => URL.revokeObjectURL(direccion);
  }, [archivo, esImagen]);

  // Al quitarlo, el <input> se vacia para que se pueda volver a elegir el mismo archivo.
  useEffect(() => {
    if (!archivo && entradaPropia.current) entradaPropia.current.value = '';
  }, [archivo]);

  function unirRefs(nodo: HTMLInputElement | null) {
    entradaPropia.current = nodo;
    if (typeof entradaRef === 'function') entradaRef(nodo);
    else if (entradaRef && typeof entradaRef === 'object') (entradaRef as { current: HTMLInputElement | null }).current = nodo;
  }

  return (
    <div
      className={`zona-archivo${arrastrando ? ' arrastrando' : ''}${invalido ? ' invalida' : ''}${archivo ? ' con-archivo' : ''}`}
      onDragEnter={() => setArrastrando(true)}
      onDragLeave={() => setArrastrando(false)}
      onDrop={() => setArrastrando(false)}
    >
      <input
        id={id}
        ref={unirRefs}
        type="file"
        accept={aceptarDeFormatos(formatos)}
        onChange={(e) => alElegir(e.target.files?.[0])}
        aria-required={obligatorio ? 'true' : undefined}
        aria-invalid={invalido ? true : undefined}
        aria-describedby={descritoPor}
        aria-label={archivo ? `Archivo elegido: ${archivo.name}. Elegir otro archivo` : undefined}
      />
      {archivo ? (
        <span className="zarch-elegido" key={archivo.name + archivo.size}>
          <span className={`zarch-hoja${formato ? ` hoja-${formato}` : ''}`} aria-hidden="true">
            {miniatura ? <img src={miniatura} alt="" /> : <span className="hoja-formato">{formato ? NOMBRE_DE_FORMATO[formato] : '?'}</span>}
            <span className="zarch-listo">
              <Icono nombre="check" tamano={12} />
            </span>
          </span>
          <span className="zarch-datos">
            <strong className="zarch-nombre" title={archivo.name}>
              {archivo.name}
            </strong>
            <span className="zarch-meta">
              {formato ? NOMBRE_DE_FORMATO[formato] : 'Archivo'} · {formatearTamano(archivo.size)} · <span className="zarch-estado">Listo para enviar</span>
            </span>
          </span>
          <span className="zarch-acciones">
            <span className="zarch-cambiar" aria-hidden="true">
              Cambiar
            </span>
            {alQuitar && (
              <button
                type="button"
                className="zarch-quitar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  alQuitar();
                }}
                aria-label={`Quitar el archivo ${archivo.name}`}
                data-ayuda="Quitar este archivo"
              >
                <Icono nombre="equis" tamano={16} />
              </button>
            )}
          </span>
        </span>
      ) : (
        <>
          <span className="zona-icono" aria-hidden="true">
            <Icono nombre="subirNube" />
          </span>
          <span className="zona-titulo">
            Arrastre y suelte su archivo aquí, o <span className="zona-enlace">examine sus archivos</span>
          </span>
          <span className="zona-pie">
            <span className="zona-formatos" aria-hidden="true">
              {formatos.map((f) => (
                <span key={f} className={`formato-etiqueta formato-${f}`}>
                  {NOMBRE_DE_FORMATO[f]}
                </span>
              ))}
            </span>
            <span className="zona-ayuda">
              Acepta {describirFormatos(formatos)}. Máximo {formatearTamano(tamanoMaximo)}.
            </span>
          </span>
        </>
      )}
    </div>
  );
}
