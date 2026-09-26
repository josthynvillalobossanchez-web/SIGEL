/*
 * Cuadro de aviso del prototipo (clases "mensaje mensaje-error", etc.).
 * role="alert" en errores y advertencias para que los lectores de pantalla
 * lo lean apenas aparece; role="status" en los demas.
 */
import type { ReactNode } from 'react';
import { Icono, type NombreDeIcono } from './Icono';

type TipoDeMensaje = 'error' | 'advert' | 'info' | 'exito';

const ICONO_POR_TIPO: Record<TipoDeMensaje, NombreDeIcono> = {
  error: 'error',
  advert: 'candado',
  info: 'info',
  exito: 'exito',
};

interface PropiedadesDeMensaje {
  tipo: TipoDeMensaje;
  children: ReactNode;
  /** Para cambiar el icono por defecto del tipo. */
  icono?: NombreDeIcono;
}

export function Mensaje({ tipo, children, icono }: PropiedadesDeMensaje) {
  const urgente = tipo === 'error' || tipo === 'advert';
  return (
    <div className={`mensaje mensaje-${tipo}`} role={urgente ? 'alert' : 'status'}>
      <Icono nombre={icono ?? ICONO_POR_TIPO[tipo]} />
      <p>{children}</p>
    </div>
  );
}
