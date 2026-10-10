/*
 * Mini calendario para elegir "desde" y "hasta" tocando dos dias.
 *
 * Pensado para el celular, donde dos campos de fecha son incomodos:
 *   1er toque = dia de inicio (tambien queda como fin: un solo dia)
 *   2do toque = dia de fin (si es anterior, se toma como nuevo inicio)
 *   3er toque = empieza de nuevo
 * Los fines de semana y feriados se ven apagados (no cuentan como dias
 * habiles), los dias ya pedidos llevan un punto, y el pasado esta
 * bloqueado cuando se indica un "minimo".
 */
import { useState } from 'react';
import { Icono } from '../../componentes/Icono';
import {
  diaDelMes,
  estaEnRango,
  fechaLarga,
  mesDe,
  moverMes,
  NOMBRES_DE_DIAS_CORTOS,
  nombreDelMes,
  posicionEnSemana,
  semanasDelMes,
  anioDe,
} from '../../utilidades/calendario';

interface Propiedades {
  inicio: string;
  fin: string;
  alCambiar: (inicio: string, fin: string) => void;
  /** Nombre de cada feriado por fecha (para el mes que se ve y los vecinos). */
  feriados: ReadonlyMap<string, string>;
  /** Fechas en que la persona ya tiene algo pedido. */
  ocupados?: ReadonlySet<string>;
  /** Primer dia que se puede elegir (los anteriores se bloquean). */
  minimo?: string;
  hoy: string;
  /** Avisa que se cambio de mes, para pedir los feriados y dias ocupados de ese mes. */
  alCambiarDeMes?: (anio: number, mes: number) => void;
}

export function SelectorDeRango({ inicio, fin, alCambiar, feriados, ocupados, minimo, hoy, alCambiarDeMes }: Propiedades) {
  const referencia = inicio || hoy;
  const [vista, setVista] = useState({ anio: anioDe(referencia), mes: mesDe(referencia) });
  const semanas = semanasDelMes(vista.anio, vista.mes);

  function mover(n: number) {
    const nuevo = moverMes(vista.anio, vista.mes, n);
    setVista(nuevo);
    alCambiarDeMes?.(nuevo.anio, nuevo.mes);
  }

  function tocar(fecha: string) {
    if (!inicio || (inicio && fin && fin !== inicio)) alCambiar(fecha, fecha); // empieza de nuevo
    else if (fecha < inicio) alCambiar(fecha, fecha);
    else alCambiar(inicio, fecha);
  }

  return (
    <div className="selector-rango">
      <div className="selector-cab">
        <button type="button" className="icono-btn" onClick={() => mover(-1)} aria-label="Mes anterior" data-ayuda="Ver el mes anterior">
          <Icono nombre="plegar" />
        </button>
        <b aria-live="polite">
          {nombreDelMes(vista.mes)} {vista.anio}
        </b>
        <button type="button" className="icono-btn" onClick={() => mover(1)} aria-label="Mes siguiente" data-ayuda="Ver el mes siguiente">
          <Icono nombre="siguiente" />
        </button>
      </div>

      <div className="selector-dias-semana" aria-hidden="true">
        {NOMBRES_DE_DIAS_CORTOS.map((d) => (
          <span key={d}>{d.slice(0, 2)}</span>
        ))}
      </div>

      <div className="selector-cuadricula" role="group" aria-label="Elija el primer y el último día">
        {semanas.flat().map((fecha) => {
          const bloqueado = Boolean(minimo && fecha < minimo);
          const enRango = Boolean(inicio && fin && estaEnRango(fecha, inicio, fin));
          const feriado = feriados.get(fecha);
          return (
            <button
              key={fecha}
              type="button"
              className="selector-dia"
              disabled={bloqueado}
              data-otro-mes={mesDe(fecha) !== vista.mes ? 'si' : undefined}
              data-fin-de-semana={posicionEnSemana(fecha) >= 5 ? 'si' : undefined}
              data-feriado={feriado ? 'si' : undefined}
              data-hoy={fecha === hoy ? 'si' : undefined}
              data-en-rango={enRango ? 'si' : undefined}
              data-extremo={fecha === inicio || fecha === fin ? 'si' : undefined}
              data-ocupado={ocupados?.has(fecha) ? 'si' : undefined}
              aria-pressed={enRango}
              aria-label={`${fechaLarga(fecha)}${feriado ? `, feriado: ${feriado}` : ''}${ocupados?.has(fecha) ? ', ya tiene algo pedido' : ''}`}
              onClick={() => tocar(fecha)}
            >
              {diaDelMes(fecha)}
            </button>
          );
        })}
      </div>

      <p className="selector-ayuda">
        <span><i className="m-feriado" /> Feriado</span>
        <span><i className="m-ocupado" /> Ya pedido</span>
        <span><i className="m-finde" /> Fin de semana (no cuenta)</span>
      </p>
    </div>
  );
}
