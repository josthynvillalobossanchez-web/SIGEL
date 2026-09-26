/*
 * Marco comun de las pantallas de acceso (iniciar sesion, recuperar
 * contrasena, primer ingreso): fondo, boton de tema arriba a la derecha,
 * logo + "SIGEL" + subtitulo, y debajo la tarjeta de cada pantalla.
 * Mismo HTML que las vistas vLogin / vRecuperar / vPrimerIngreso del prototipo.
 */
import type { ReactNode } from 'react';
import { BotonTema } from './BotonTema';
import logoClaro from '../recursos/logo-claro.png';
import logoOscuro from '../recursos/logo-oscuro.png';

interface PropiedadesDePantallaDeAcceso {
  /** Texto pequeno debajo de "SIGEL" (p. ej. "Primer ingreso"). */
  subtitulo: string;
  children: ReactNode;
  /** Texto al pie, fuera de la tarjeta. */
  pie?: ReactNode;
}

export function PantallaDeAcceso({ subtitulo, children, pie }: PropiedadesDePantallaDeAcceso) {
  return (
    <div className="acceso">
      <div className="acceso-barra">
        <BotonTema clase="btn-icono-claro btn-tema-acceso" />
      </div>

      <main className="acceso-caja">
        <div className="acceso-marca">
          <span className="logo-caja">
            {/* El CSS muestra uno u otro segun el tema. */}
            <img className="logo-claro" src={logoClaro} alt="Municipalidad de Palmares" />
            <img className="logo-oscuro" src={logoOscuro} alt="" />
          </span>
          <div className="nom">
            <b>SIGEL</b>
            <span>{subtitulo}</span>
          </div>
        </div>

        {children}

        {pie && <p className="acceso-pie">{pie}</p>}
      </main>
    </div>
  );
}
