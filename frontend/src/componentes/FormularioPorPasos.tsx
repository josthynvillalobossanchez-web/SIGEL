/*
 * Pagina de edicion por pasos, con el mismo HTML del prototipo
 * ("Registrar funcionario": migas, pagina-cab, pasos, card form-pasos,
 * panel-paso con barra de progreso, pie-form con "Paso 1 de 3").
 *
 * Regla de SIGEL (Josthyn, 26/09): lo que solo se CONSULTA va en una
 * ventana; lo que se CREA o EDITA va en una pagina aparte como esta,
 * dividida en pasos para no tener que bajar, y con su subseccion en el
 * menu lateral (diseno/menu.ts).
 *
 * Quien la usa:
 *   - tiene el estado del formulario y dibuja el contenido del paso actual
 *     como children;
 *   - dice como revisar cada paso (revisarPaso) antes de avanzar;
 *   - guarda en alGuardar (el ultimo paso siempre es "Revisar y guardar").
 *
 * Al cambiar de paso:
 *   - SIEMPRE se revisan las fechas del paso (una fecha a medio escribir se
 *     perderia sin avisar al salir del paso);
 *   - hacia adelante, ademas, se revisa el paso con revisarPaso.
 *   - El foco va al titulo del paso nuevo (lo anuncia el lector de pantalla).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mensaje } from './Mensaje';
import { Migas, type Miga } from './Migas';
import { Pasos, type Paso } from './Pasos';
import { BotonConAyuda } from './Botones';
import { revisarFechasDeVencimiento } from './CampoFechaDeVencimiento';

export interface PasoDeFormulario extends Paso {
  /** Explicacion bajo el titulo del paso (clase "paso-desc"). */
  descripcion: ReactNode;
}

interface PropiedadesDelFormulario {
  migas: Miga[];
  titulo: string;
  descripcion: ReactNode;
  pasos: PasoDeFormulario[];
  actual: number;
  alCambiarPaso: (indice: number) => void;
  /** Problema del paso "indice" (null = se puede avanzar). */
  revisarPaso: (indice: number) => string | null;
  /** Editar: se puede ir a cualquier paso. Crear: en orden. */
  libre?: boolean;
  alCancelar: () => void;
  alGuardar: () => void;
  textoGuardar: string;
  /** Por que no se puede guardar todavia (el boton queda atenuado y lo explica). */
  bloqueoGuardar?: string | null;
  ocupado?: boolean;
  /** Error del servidor u otro aviso general. */
  error?: string | null;
  /** Resumen de los datos del formulario: si cambia, se quita el aviso de "falta algo". */
  claveDeDatos?: string;
  children: ReactNode;
}

export function FormularioPorPasos({
  migas,
  titulo,
  descripcion,
  pasos,
  actual,
  alCambiarPaso,
  revisarPaso,
  libre,
  alCancelar,
  alGuardar,
  textoGuardar,
  bloqueoGuardar,
  ocupado,
  error,
  claveDeDatos,
  children,
}: PropiedadesDelFormulario) {
  const panel = useRef<HTMLDivElement>(null);
  const tituloDelPaso = useRef<HTMLHeadingElement>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const pasoAnterior = useRef(actual);
  const ultimo = actual === pasos.length - 1;
  const paso = pasos[actual];

  // Al cambiar de paso: limpiar el aviso y llevar el foco al titulo.
  // (Se compara con el paso anterior y no con "primera vez": en desarrollo
  // React ejecuta los efectos dos veces y el foco saltaria al abrir.)
  useEffect(() => {
    if (pasoAnterior.current === actual) return;
    pasoAnterior.current = actual;
    setProblema(null);
    tituloDelPaso.current?.focus();
  }, [actual]);

  // Si cambian los datos (p. ej. se eligio al funcionario), el aviso general
  // ya no aplica.
  useEffect(() => {
    setProblema(null);
  }, [claveDeDatos]);

  // Un error nuevo del servidor reemplaza el aviso local.
  useEffect(() => {
    if (error) setProblema(null);
  }, [error]);

  function irA(destino: number) {
    const fechas = revisarFechasDeVencimiento(panel.current);
    if (fechas) return setProblema(fechas);
    if (destino > actual) {
      // Hacia adelante se revisa el paso actual (y, al saltar varios, los del medio).
      for (let i = actual; i < destino; i++) {
        const encontrado = revisarPaso(i);
        if (encontrado) {
          if (i !== actual) alCambiarPaso(i);
          return setProblema(encontrado);
        }
      }
    }
    alCambiarPaso(destino);
  }

  function guardar() {
    const fechas = revisarFechasDeVencimiento(panel.current);
    if (fechas) return setProblema(fechas);
    for (let i = 0; i < pasos.length; i++) {
      const encontrado = revisarPaso(i);
      if (encontrado) {
        if (i !== actual) alCambiarPaso(i);
        return setProblema(encontrado);
      }
    }
    setProblema(null);
    alGuardar();
  }

  const porcentaje = Math.round(((actual + 1) / pasos.length) * 100);

  return (
    <section className="pagina pagina-pasos">
      <Migas migas={migas} />
      <div className="pagina-cab">
        <div>
          <h1>{titulo}</h1>
          <p>{descripcion}</p>
        </div>
      </div>

      <Pasos pasos={pasos} actual={actual} alElegir={irA} etiqueta={`Pasos de "${titulo}"`} libre={libre} enPagina />

      <form
        className="card form-pasos"
        noValidate
        aria-label={titulo}
        // Al corregir cualquier campo, el aviso general se quita (los avisos
        // de cada campo, como el de la fecha, siguen en su lugar).
        onChange={() => problema && setProblema(null)}
        onSubmit={(e) => {
          e.preventDefault();
          if (ocupado) return;
          if (ultimo) {
            if (!bloqueoGuardar) guardar();
          } else irA(actual + 1);
        }}
      >
        <div className="panel-paso" ref={panel}>
          <div className="barra-progreso" aria-hidden="true">
            <span style={{ width: `${porcentaje}%` }} />
          </div>
          <h2 className="paso-titulo" ref={tituloDelPaso} tabIndex={-1}>
            {paso.titulo}
          </h2>
          <p className="paso-desc">{paso.descripcion}</p>
          <div aria-live="assertive">
            {(problema || error) && <Mensaje tipo="error">{problema ?? error}</Mensaje>}
          </div>
          {children}
        </div>

        <div className="pie-form">
          <span className="contador-paso">
            Paso <b>{actual + 1}</b> de {pasos.length}
          </span>
          <div className="der">
            <button className="btn btn-secundario" type="button" onClick={alCancelar} disabled={ocupado} data-ayuda="Salir sin guardar y volver a la lista">
              Cancelar
            </button>
            {actual > 0 && (
              <button
                className="btn btn-secundario"
                type="button"
                onClick={() => irA(actual - 1)}
                disabled={ocupado}
                data-ayuda={`Volver al paso ${actual}: ${pasos[actual - 1].titulo}`}
              >
                Anterior
              </button>
            )}
            {ultimo ? (
              <BotonConAyuda
                tipo="submit"
                clase="btn btn-primario"
                texto={ocupado ? 'Guardando…' : textoGuardar}
                ayuda={`${textoGuardar}: se guarda todo junto`}
                bloqueadoPor={bloqueoGuardar}
                ocupado={ocupado}
              />
            ) : (
              <button className="btn btn-primario" type="submit" disabled={ocupado} data-ayuda={`Ir al paso ${actual + 2}: ${pasos[actual + 1].titulo}`}>
                Siguiente
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
