/*
 * Ventana modal con el mismo HTML del prototipo (velo > modal > modal-cab,
 * modal-cuerpo, modal-pie).
 *
 * Accesibilidad:
 *   - role="dialog" + aria-modal + titulo y descripcion enlazados.
 *   - Al abrir, el foco va al primer campo; Tab y Shift+Tab quedan dentro
 *     de la ventana; al cerrar, el foco vuelve al boton que la abrio.
 *   - Escape cierra (salvo mientras guarda).
 *
 * Uso simple (formulario de un paso):
 *   <Modal titulo="Cambiar estado" icono="candado" alCerrar={...}
 *          alEnviar={guardar} textoConfirmar="Guardar" ocupado={x}>...</Modal>
 *
 * Uso con pie propio (pasos: Anterior / Siguiente):
 *   <Modal titulo="Crear usuario" cabeceraExtra={<Pasos .../>}
 *          pie={<>...botones...</>} alEnviar={...}>...</Modal>
 */
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Icono, type NombreDeIcono } from './Icono';

interface PropiedadesDeModal {
  titulo: ReactNode;
  descripcion?: ReactNode;
  icono?: NombreDeIcono;
  alCerrar: () => void;
  /** Si viene, el cuerpo es un formulario: Enter y el boton principal lo envian. */
  alEnviar?: () => void;
  textoConfirmar?: string;
  /** Texto del boton que cierra (por defecto "Cancelar", o "Cerrar" sin formulario). */
  textoCerrar?: string;
  /** Boton principal en rojo (acciones que quitan algo). */
  peligro?: boolean;
  ocupado?: boolean;
  confirmarDesactivado?: boolean;
  ancho?: boolean;
  /** Algo bajo la descripcion (p. ej. los pasos o las pestanas). */
  cabeceraExtra?: ReactNode;
  /** Reemplaza los botones del pie. */
  pie?: ReactNode;
  children?: ReactNode;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  titulo,
  descripcion,
  icono,
  alCerrar,
  alEnviar,
  textoConfirmar = 'Guardar',
  textoCerrar,
  peligro,
  ocupado,
  confirmarDesactivado,
  ancho,
  cabeceraExtra,
  pie,
  children,
}: PropiedadesDeModal) {
  const idTitulo = useId();
  const idDescripcion = useId();
  const caja = useRef<HTMLDivElement>(null);
  // Se guarda en una referencia para no reiniciar los efectos en cada render.
  const cerrar = useRef({ alCerrar, ocupado });
  cerrar.current = { alCerrar, ocupado };

  // Foco inicial, trampa de foco, Escape y devolucion del foco al cerrar.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const primero =
      caja.current?.querySelector<HTMLElement>('.modal-cuerpo input:not([disabled]), .modal-cuerpo select, .modal-cuerpo textarea') ??
      caja.current?.querySelector<HTMLElement>(ENFOCABLES);
    primero?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cerrar.current.ocupado) {
        e.stopPropagation();
        cerrar.current.alCerrar();
        return;
      }
      if (e.key !== 'Tab' || !caja.current) return;
      const lista = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (lista.length === 0) return;
      const inicio = lista[0];
      const fin = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault();
        inicio.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      anterior?.focus?.();
    };
  }, []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!ocupado && !confirmarDesactivado) alEnviar?.();
  }

  const contenido = (
    <>
      <div className="modal-cab">
        <h2 id={idTitulo}>
          {icono && (
            <span className="ic" aria-hidden="true">
              <Icono nombre={icono} />
            </span>
          )}
          {titulo}
        </h2>
        {descripcion && <p id={idDescripcion}>{descripcion}</p>}
        {cabeceraExtra}
      </div>
      {children && <div className="modal-cuerpo">{children}</div>}
      <div className="modal-pie">
        {pie ?? (
          <>
            <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado}>
              {textoCerrar ?? (alEnviar ? 'Cancelar' : 'Cerrar')}
            </button>
            {alEnviar && (
              <button
                className={`btn ${peligro ? 'btn-peligro' : 'btn-primario'}`}
                type="submit"
                disabled={ocupado || confirmarDesactivado}
                aria-busy={ocupado}
              >
                {ocupado ? 'Guardando…' : textoConfirmar}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div
      className="velo"
      data-abierto="si"
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDescripcion : undefined}
      // Tocar el fondo oscuro cierra; tocar dentro de la caja, no.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !ocupado) alCerrar();
      }}
    >
      <div className={`modal${ancho ? ' modal-ancho' : ''}`} ref={caja}>
        {alEnviar ? (
          <form onSubmit={enviar} noValidate className="modal-form">
            {contenido}
          </form>
        ) : (
          contenido
        )}
      </div>
    </div>
  );
}
