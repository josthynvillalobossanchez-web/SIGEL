/*
 * Botones con ayuda (globo al pasar el mouse) y con BLOQUEO explicado.
 *
 * Un boton "bloqueado" no se desactiva con disabled (asi el lector de
 * pantalla y el globo de ayuda lo siguen alcanzando): se marca con
 * aria-disabled="true", se ve atenuado, no hace nada al tocarlo y su ayuda
 * dice POR QUE no se puede. Ejemplo:
 *
 *   <BotonIcono icono="editar" texto="Editar usuario"
 *               bloqueadoPor="Esta cuenta tiene permisos que usted no tiene."
 *               alHacerClic={...} />
 *
 * El texto siempre queda tambien en aria-label (lectores de pantalla).
 */
import type { ReactNode } from 'react';
import { Icono, type NombreDeIcono } from './Icono';

interface PropiedadesBase {
  /** Para que sirve el boton (globo y lector de pantalla). */
  texto: string;
  /** Si viene, el boton esta bloqueado y este es el motivo. */
  bloqueadoPor?: string | null;
  alHacerClic?: () => void;
}

/** Texto de ayuda: "Para que sirve — por que no se puede" si esta bloqueado. */
function textoDeAyuda(texto: string, bloqueadoPor?: string | null) {
  return bloqueadoPor ? `${texto}: ${bloqueadoPor}` : texto;
}

/** Boton de solo icono (acciones de las filas). */
export function BotonIcono({
  icono,
  texto,
  sobre,
  bloqueadoPor,
  alHacerClic,
  peligro,
}: PropiedadesBase & {
  icono: NombreDeIcono;
  peligro?: boolean;
  /** Sobre que actua (p. ej. el nombre de la persona). Solo para el lector de pantalla. */
  sobre?: string;
}) {
  const bloqueado = Boolean(bloqueadoPor);
  const completo = sobre ? `${texto}: ${sobre}` : texto;
  return (
    <button
      type="button"
      className={`icono-btn${peligro ? ' peligro' : ''}`}
      aria-label={bloqueado ? `${completo}. No disponible: ${bloqueadoPor}` : completo}
      aria-disabled={bloqueado || undefined}
      data-ayuda={textoDeAyuda(texto, bloqueadoPor)}
      onClick={(e) => {
        // Que el clic no llegue a la fila (que abre el detalle).
        e.stopPropagation();
        if (!bloqueado) alHacerClic?.();
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
    >
      <Icono nombre={icono} />
    </button>
  );
}

/** Boton con texto (clases del prototipo: btn btn-primario, etc.). */
export function BotonConAyuda({
  texto,
  ayuda,
  bloqueadoPor,
  alHacerClic,
  clase = 'btn btn-secundario',
  icono,
  tipo = 'button',
  ocupado,
  children,
}: PropiedadesBase & {
  /** Explicacion mas larga que el texto visible (opcional). */
  ayuda?: string;
  clase?: string;
  icono?: NombreDeIcono;
  tipo?: 'button' | 'submit';
  ocupado?: boolean;
  children?: ReactNode;
}) {
  const bloqueado = Boolean(bloqueadoPor);
  const explicacion = ayuda ?? texto;
  return (
    <button
      type={tipo}
      className={clase}
      aria-disabled={bloqueado || undefined}
      aria-busy={ocupado || undefined}
      disabled={ocupado}
      aria-label={bloqueado ? `${texto}. No disponible: ${bloqueadoPor}` : undefined}
      data-ayuda={textoDeAyuda(explicacion, bloqueadoPor)}
      onClick={(e) => {
        if (bloqueado) {
          e.preventDefault();
          return;
        }
        alHacerClic?.();
      }}
    >
      {icono && <Icono nombre={icono} />}
      {children ?? texto}
    </button>
  );
}
