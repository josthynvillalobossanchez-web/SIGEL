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
import { useEffect, useState, type ReactNode } from 'react';

export interface DatoRapido {
  titulo: string;
  valor: string;
  /** Numero o fecha (cifras alineadas). */
  num?: boolean;
}

/** Foto si hay y carga; si no, las iniciales (la foto nunca deja la tarjeta rota). */
export function FotoOIniciales({ src, iniciales }: { src?: string; iniciales: string }) {
  const [fallo, setFallo] = useState(false);
  // Una foto nueva vuelve a intentarse aunque la anterior hubiera fallado.
  useEffect(() => setFallo(false), [src]);
  if (src && !fallo) return <img src={src} alt="" onError={() => setFallo(true)} />;
  return <span aria-hidden="true">{iniciales}</span>;
}

export function TarjetaDePerfil(props: {
  /** Nombre de la seccion para el lector de pantalla. */
  etiqueta: string;
  iniciales: string;
  /** Direccion de la fotografia (api/documentos.ts: direccionDeFoto). Sin ella, o si falla, se ven las iniciales. */
  fotoSrc?: string;
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
        <FotoOIniciales src={props.fotoSrc} iniciales={props.iniciales} />
        {props.extraDeFoto}
      </div>
      {/* Envoltorio de los textos: en pantallas anchas la foto va a la izquierda y esto a su lado (ajustes.css). */}
      <div className="perfil-texto">
        <h1>{props.titulo}</h1>
        <p className="ident">{props.identificacion}</p>
        {props.chips && <div className="chips">{props.chips}</div>}
        {props.acciones && <div className="acc">{props.acciones}</div>}
      </div>
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
