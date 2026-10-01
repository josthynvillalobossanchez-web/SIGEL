/*
 * Zona para elegir un archivo: recuadro con linea punteada, icono de nube,
 * "Arrastre y suelte su archivo aqui, o examine sus archivos" y los formatos
 * que acepta en etiquetas de color. La usan "Subir documento" y la ventana
 * de la fotografia de perfil.
 *
 * Por dentro sigue siendo un <input type="file"> normal, estirado y
 * transparente sobre todo el recuadro: asi funcionan solos el clic, el
 * teclado (Tab y Enter o Espacio), los lectores de pantalla y soltar un
 * archivo encima. Este componente no valida nada: avisa con alElegir y la
 * pagina revisa el archivo (utilidades/archivos.ts) y muestra el mensaje.
 */
import { useState, type Ref } from 'react';
import type { Formato } from '../api/documentos';
import { aceptarDeFormatos, describirFormatos, formatearTamano, NOMBRE_DE_FORMATO } from '../utilidades/archivos';
import { Icono } from './Icono';

export function ZonaDeArchivo({
  id,
  formatos,
  tamanoMaximo,
  archivo,
  alElegir,
  entradaRef,
  invalido,
  obligatorio,
  descritoPor,
}: {
  /** id del <input>: la etiqueta del campo apunta a el. */
  id: string;
  formatos: Formato[];
  tamanoMaximo: number;
  /** Archivo ya elegido (se muestra su nombre dentro del recuadro). */
  archivo: File | null;
  alElegir: (archivo: File | undefined) => void;
  entradaRef?: Ref<HTMLInputElement>;
  invalido?: boolean;
  obligatorio?: boolean;
  /** id del texto de ayuda o error que lee el lector de pantalla. */
  descritoPor?: string;
}) {
  // Solo para pintar el recuadro mientras se arrastra un archivo encima.
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <div
      className={`zona-archivo${arrastrando ? ' arrastrando' : ''}${invalido ? ' invalida' : ''}`}
      onDragEnter={() => setArrastrando(true)}
      onDragLeave={() => setArrastrando(false)}
      onDrop={() => setArrastrando(false)}
    >
      <input
        id={id}
        ref={entradaRef}
        type="file"
        accept={aceptarDeFormatos(formatos)}
        onChange={(e) => alElegir(e.target.files?.[0])}
        aria-required={obligatorio ? 'true' : undefined}
        aria-invalid={invalido ? true : undefined}
        aria-describedby={descritoPor}
      />
      <span className="zona-icono" aria-hidden="true">
        <Icono nombre="subirNube" />
      </span>
      {archivo ? (
        <span className="zona-titulo">
          <strong>{archivo.name}</strong> · {formatearTamano(archivo.size)}
          <span className="zona-enlace"> Cambiar archivo</span>
        </span>
      ) : (
        <span className="zona-titulo">
          Arrastre y suelte su archivo aquí, o <span className="zona-enlace">examine sus archivos</span>
        </span>
      )}
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
    </div>
  );
}
