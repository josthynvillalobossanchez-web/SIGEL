/*
 * Reparto de las solicitudes en las filas ("carriles") de una semana del
 * calendario. Es la parte que evita que el calendario se vea feo cuando
 * mucha gente coincide: cada solicitud es UNA barra que cruza los dias que
 * dura; si no caben mas carriles, el resto se cuenta ("+3 mas") en el dia.
 *
 * Es codigo puro (sin React) para poder probarlo aparte.
 */
import type { SolicitudDeLista } from '../../api/vacaciones';
import { diasEntre } from '../../utilidades/calendario';

export interface Barra {
  solicitud: SolicitudDeLista;
  /** Columna donde empieza (1 = lunes ... 7 = domingo). */
  columna: number;
  /** Cuantas columnas cruza. */
  largo: number;
  /** Fila dentro de la semana (0 = la de arriba). */
  carril: number;
  /** La solicitud empezo antes de esta semana (se dibuja sin borde redondo a la izquierda). */
  vieneDeAntes: boolean;
  /** La solicitud sigue despues de esta semana. */
  siguePorDespues: boolean;
}

export interface RepartoDeSemana {
  /** Las barras que si caben (carril < maximoDeCarriles). */
  barras: Barra[];
  /** Por cada dia de la semana, cuantas solicitudes quedaron sin barra. */
  ocultasPorDia: number[];
}

/**
 * @param semana         las 7 fechas (lunes a domingo)
 * @param solicitudes    todas las del rango visible; se toman las que tocan la semana
 * @param maximoDeCarriles cuantas filas de barras se dibujan como maximo
 */
export function repartirSemana(semana: string[], solicitudes: SolicitudDeLista[], maximoDeCarriles: number): RepartoDeSemana {
  const lunes = semana[0];
  const domingo = semana[6];

  const tocan = solicitudes
    .filter((s) => s.fechaInicio <= domingo && s.fechaFin >= lunes)
    .map((s) => {
      const desde = s.fechaInicio < lunes ? lunes : s.fechaInicio;
      const hasta = s.fechaFin > domingo ? domingo : s.fechaFin;
      return { s, columna: diasEntre(lunes, desde) + 1, largo: diasEntre(desde, hasta) + 1 };
    })
    // Primero las que empiezan antes; a igual inicio, las mas largas; luego por nombre (orden estable).
    .sort((a, b) => a.columna - b.columna || b.largo - a.largo || a.s.funcionario.nombre.localeCompare(b.s.funcionario.nombre, 'es') || a.s.id.localeCompare(b.s.id));

  // Ultimo dia (columna) ocupado de cada carril.
  const finDeCarril: number[] = [];
  const barras: Barra[] = [];
  const ocultasPorDia = [0, 0, 0, 0, 0, 0, 0];

  for (const { s, columna, largo } of tocan) {
    let carril = finDeCarril.findIndex((fin) => fin < columna);
    if (carril === -1) carril = finDeCarril.length;
    finDeCarril[carril] = columna + largo - 1;

    if (carril < maximoDeCarriles) {
      barras.push({ solicitud: s, columna, largo, carril, vieneDeAntes: s.fechaInicio < lunes, siguePorDespues: s.fechaFin > domingo });
    } else {
      for (let d = columna - 1; d < columna - 1 + largo; d++) ocultasPorDia[d]++;
    }
  }
  return { barras, ocultasPorDia };
}

/** Las solicitudes que cubren una fecha, en un orden estable (por nombre). */
export function solicitudesDelDia(fecha: string, solicitudes: SolicitudDeLista[]): SolicitudDeLista[] {
  return solicitudes
    .filter((s) => s.fechaInicio <= fecha && s.fechaFin >= fecha)
    .sort((a, b) => a.funcionario.nombre.localeCompare(b.funcionario.nombre, 'es') || a.tipo.nombre.localeCompare(b.tipo.nombre, 'es'));
}
