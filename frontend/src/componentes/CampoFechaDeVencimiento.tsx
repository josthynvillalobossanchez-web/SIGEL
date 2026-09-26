/*
 * Campo "Vence (opcional)" de roles y excepciones de permisos.
 *
 * Problema que resuelve (reportado por Josthyn el 26/09): si la persona
 * deja la fecha a medio escribir (por ejemplo "dd/11/1111"), el navegador
 * entrega el valor como "" y la asignacion se guardaba como PERMANENTE sin
 * que nadie lo notara. Aqui:
 *   - una fecha incompleta se marca en rojo con su explicacion
 *     (validity.badInput), y la pagina NO deja avanzar ni guardar
 *     (ver revisarFechasDeVencimiento);
 *   - una fecha pasada o a mas de 5 anios tambien se marca (el backend lo
 *     revisa otra vez).
 *
 * Accesibilidad: el mensaje de error queda ligado al campo
 * (aria-describedby) y el campo lleva aria-invalid.
 */
import { useState } from 'react';
import { Icono } from './Icono';
import { hoyEnCostaRica, limiteDeVencimiento, problemaDeFechaDeVencimiento } from '../utilidades/fechas';

const TEXTO_INCOMPLETA = 'Fecha incompleta: complete el día, el mes y el año (o elija "Permanente").';

interface PropiedadesDelCampo {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** Texto de ayuda cuando no hay error. */
  ayuda?: string;
  /** Para el lector de pantalla: de que es la fecha ("del rol Aprobador"). */
  deQue?: string;
  desactivado?: boolean;
  /** Version en linea (sin etiqueta visible ni ayuda; el error si se muestra). */
  compacto?: boolean;
}

export function CampoFechaDeVencimiento({ id, etiqueta, valor, alCambiar, ayuda, deQue, desactivado, compacto }: PropiedadesDelCampo) {
  const [incompleta, setIncompleta] = useState(false);
  const problema = incompleta ? TEXTO_INCOMPLETA : problemaDeFechaDeVencimiento(valor);
  const revisar = (campo: HTMLInputElement) => setIncompleta(campo.validity.badInput);

  return (
    <div className={`campo campo-fecha${compacto ? ' compacto' : ''}`}>
      <label htmlFor={id} className={compacto ? 'solo-lector' : undefined}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="date"
        min={hoyEnCostaRica()}
        max={limiteDeVencimiento()}
        value={valor}
        disabled={desactivado}
        // Marca que usa revisarFechasDeVencimiento para encontrarlo.
        data-fecha-vencimiento=""
        aria-invalid={problema ? true : undefined}
        aria-describedby={`${id}-nota`}
        aria-label={deQue ? `${etiqueta} ${deQue}` : undefined}
        onChange={(e) => {
          revisar(e.target);
          alCambiar(e.target.value);
        }}
        // Al escribir a medias el valor no cambia ("" -> ""), asi que onChange
        // no siempre llega: se revisa tambien al soltar cada tecla y al salir.
        onKeyUp={(e) => revisar(e.currentTarget)}
        onBlur={(e) => revisar(e.target)}
      />
      {problema ? (
        <span className="msg-error" id={`${id}-nota`}>
          <Icono nombre="error" tamano={14} /> {problema}
        </span>
      ) : compacto ? (
        <span className="solo-lector" id={`${id}-nota`}>
          {ayuda ?? 'Deja de contar sola al terminar ese día.'}
        </span>
      ) : (
        <span className="ayuda" id={`${id}-nota`}>
          {ayuda ?? 'Deja de contar sola al terminar ese día.'}
        </span>
      )}
    </div>
  );
}

/**
 * Revisa todos los campos de fecha dentro de "raiz" antes de avanzar
 * o guardar. Si alguno esta incompleto o fuera de rango, lo enfoca y
 * devuelve el texto del problema; si todo esta bien devuelve null.
 */
export function revisarFechasDeVencimiento(raiz: HTMLElement | null): string | null {
  if (!raiz) return null;
  // Vencimientos (se revisa tambien el rango) y fechas de calendario de
  // CampoFecha (solo que esten completas; el rango lo revisa la pagina).
  const campos = raiz.querySelectorAll<HTMLInputElement>('input[data-fecha-vencimiento], input[data-fecha-revisada]');
  for (const campo of campos) {
    const esVencimiento = campo.hasAttribute('data-fecha-vencimiento');
    const problema = campo.validity.badInput
      ? esVencimiento
        ? TEXTO_INCOMPLETA
        : 'Fecha incompleta: complete el día, el mes y el año.'
      : esVencimiento
        ? problemaDeFechaDeVencimiento(campo.value)
        : null;
    if (problema) {
      campo.focus();
      // Dispara el aviso rojo del propio campo.
      campo.dispatchEvent(new FocusEvent('blur'));
      return problema;
    }
  }
  return null;
}
