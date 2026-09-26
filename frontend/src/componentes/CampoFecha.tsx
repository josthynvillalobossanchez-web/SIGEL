/*
 * Campo de fecha de calendario (nacimiento, ingreso, salida).
 *
 * Igual que CampoFechaDeVencimiento, detecta la fecha a MEDIO escribir
 * (el navegador la entrega como "" y se perderia sin avisar): la marca en
 * rojo y la pagina no deja avanzar (revisarFechasDeVencimiento revisa
 * tambien estos campos). Los rangos (edad minima, etc.) los revisa la
 * pagina y los muestra con "error".
 */
import { useState } from 'react';
import { Icono } from './Icono';

const TEXTO_INCOMPLETA = 'Fecha incompleta: complete el día, el mes y el año.';

export function CampoFecha({
  id,
  etiqueta,
  valor,
  alCambiar,
  obligatorio,
  min,
  max,
  ayuda,
  error,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  obligatorio?: boolean;
  min?: string;
  max?: string;
  ayuda?: string;
  /** Problema que detecto la pagina (fuera de rango, etc.). */
  error?: string | null;
}) {
  const [incompleta, setIncompleta] = useState(false);
  const problema = incompleta ? TEXTO_INCOMPLETA : error;
  const revisar = (campo: HTMLInputElement) => setIncompleta(campo.validity.badInput);
  return (
    <div className="campo campo-fecha">
      <label htmlFor={id}>
        {etiqueta} {obligatorio && <span className="obligatorio">*</span>}
      </label>
      <input
        id={id}
        type="date"
        value={valor}
        min={min}
        max={max}
        data-fecha-revisada=""
        aria-required={obligatorio || undefined}
        aria-invalid={problema ? true : undefined}
        aria-describedby={`${id}-nota`}
        onChange={(e) => {
          revisar(e.target);
          alCambiar(e.target.value);
        }}
        onKeyUp={(e) => revisar(e.currentTarget)}
        onBlur={(e) => revisar(e.target)}
      />
      {problema ? (
        <span className="msg-error" id={`${id}-nota`}>
          <Icono nombre="error" tamano={14} /> {problema}
        </span>
      ) : (
        <span className="ayuda" id={`${id}-nota`}>
          {ayuda ?? ''}
        </span>
      )}
    </div>
  );
}
