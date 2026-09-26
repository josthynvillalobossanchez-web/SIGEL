/*
 * Globos de ayuda ("tooltips") de toda la aplicacion.
 *
 * Cualquier elemento con el atributo data-ayuda="texto" muestra ese texto en
 * un globo al pasarle el mouse encima o al llegar a el con el teclado (Tab).
 * En el celular, donde no hay mouse, el globo aparece al tocar un boton
 * BLOQUEADO (aria-disabled="true"), para que la persona sepa por que no
 * puede usarlo.
 *
 * Por que un globo propio y no el atributo "title" del navegador:
 *   - "title" tarda en salir, no se puede estilar y no funciona en celular.
 *   - Este globo usa position: fixed, asi que no lo recortan las tablas con
 *     desplazamiento horizontal.
 *
 * Accesibilidad: el globo es solo visual. Para lectores de pantalla, cada
 * boton lleva su propio aria-label con el mismo texto (lo hacen BotonIcono y
 * BotonConAyuda).
 *
 * Se monta UNA vez, en App.tsx: <GestorDeAyudas />.
 */
import { useEffect, useRef, useState } from 'react';

interface Globo {
  texto: string;
  x: number;
  y: number;
  /** Abajo del elemento cuando arriba no hay espacio. */
  abajo: boolean;
}

const SELECTOR = '[data-ayuda]';

export function GestorDeAyudas() {
  const [globo, setGlobo] = useState<Globo | null>(null);
  const actual = useRef<Element | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  /** Momento del ultimo toque: el celular simula "mouse encima" al tocar y eso no debe abrir globos. */
  const ultimoToque = useRef(0);

  useEffect(() => {
    function mostrar(el: Element) {
      const texto = el.getAttribute('data-ayuda');
      if (!texto) return;
      const caja = el.getBoundingClientRect();
      const abajo = caja.top < 60;
      actual.current = el;
      setGlobo({
        texto,
        x: caja.left + caja.width / 2,
        y: abajo ? caja.bottom + 8 : caja.top - 8,
        abajo,
      });
    }
    function ocultar() {
      actual.current = null;
      window.clearTimeout(temporizador.current);
      setGlobo(null);
    }

    const alPasarMouse = (e: MouseEvent) => {
      if (Date.now() - ultimoToque.current < 1000) return;
      const el = (e.target as Element).closest?.(SELECTOR);
      if (el && el !== actual.current) mostrar(el);
      else if (!el && actual.current) ocultar();
    };
    const alEnfocar = (e: FocusEvent) => {
      const el = (e.target as Element).closest?.(SELECTOR);
      // Solo con teclado (:focus-visible), no al hacer clic con el mouse.
      if (el && (e.target as Element).matches(':focus-visible')) mostrar(el);
    };
    const alTocar = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      ultimoToque.current = Date.now();
      const el = (e.target as Element).closest?.(`${SELECTOR}[aria-disabled="true"], label${SELECTOR}`);
      if (!el) {
        ocultar();
        return;
      }
      mostrar(el);
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(ocultar, 3500);
    };

    document.addEventListener('mouseover', alPasarMouse);
    document.addEventListener('focusin', alEnfocar);
    document.addEventListener('focusout', ocultar);
    document.addEventListener('pointerdown', alTocar);
    window.addEventListener('scroll', ocultar, true);
    window.addEventListener('resize', ocultar);
    return () => {
      document.removeEventListener('mouseover', alPasarMouse);
      document.removeEventListener('focusin', alEnfocar);
      document.removeEventListener('focusout', ocultar);
      document.removeEventListener('pointerdown', alTocar);
      window.removeEventListener('scroll', ocultar, true);
      window.removeEventListener('resize', ocultar);
    };
  }, []);

  if (!globo) return null;
  return (
    <div
      className="globo-ayuda"
      data-abajo={globo.abajo ? 'si' : 'no'}
      style={{ left: globo.x, top: globo.y }}
      aria-hidden="true"
    >
      {globo.texto}
    </div>
  );
}
