/*
 * Tarjeta de perfil con el degradado (clase "perfil" del prototipo), la de
 * Mi cuenta y la del expediente: foto (o iniciales), nombre, identificacion,
 * chips, acciones y, si se pide, la fila de datos rapidos.
 *
 *   <TarjetaDePerfil etiqueta="Mi perfil" iniciales="AP" titulo="Ana Prueba"
 *     identificacion="Cedula 9-0000-0001" chips={<>...</>}
 *     rapidos={[{ titulo: 'Puesto', valor: 'Asistente' }]} />
 *
 * Usa "perfil-compacto" (estilos/ajustes.css) para que la pagina quepa sin
 * scroll a 1366x768.
 */
import type { ReactNode } from 'react';

export interface DatoRapido {
  titulo: string;
  valor: string;
  /** Numero o fecha (cifras alineadas). */
  num?: boolean;
}

export function TarjetaDePerfil(props: {
  /** Nombre de la seccion para el lector de pantalla. */
  etiqueta: string;
  iniciales: string;
  titulo: string;
  identificacion: ReactNode;
  chips?: ReactNode;
  acciones?: ReactNode;
  rapidos?: DatoRapido[];
  /** Algo mas dentro de la foto (p. ej. el boton de cambiarla y su texto para el lector). */
  extraDeFoto?: ReactNode;
}) {
  return (
    <section className="perfil perfil-compacto" aria-label={props.etiqueta}>
      <div className="perfil-foto">
        <span aria-hidden="true">{props.iniciales}</span>
        {props.extraDeFoto}
      </div>
      <h1>{props.titulo}</h1>
      <p className="ident">{props.identificacion}</p>
      {props.chips && <div className="chips">{props.chips}</div>}
      {props.acciones && <div className="acc">{props.acciones}</div>}
      {props.rapidos && (
        <dl className="perfil-rapido">
          {props.rapidos.map((d) => (
            <div key={d.titulo}>
              <dt>{d.titulo}</dt>
              <dd className={d.num ? 'num' : undefined}>{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
