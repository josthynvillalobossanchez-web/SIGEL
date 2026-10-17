/*
 * Marco comun de las pantallas de acceso (iniciar sesion, recuperar
 * contrasena, primer ingreso): fondo, boton de tema arriba a la derecha,
 * simbolo de SINERGIA + nombre + subtitulo, debajo la tarjeta de cada
 * pantalla y, al pie, el logo de la Municipalidad mas pequeno (pedido de Joseph, 01/10).
 * Mismo HTML que las vistas vLogin / vRecuperar / vPrimerIngreso del prototipo.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BotonTema } from './BotonTema';
import { Icono } from './Icono';
import logoClaro from '../recursos/logo-claro.png';
import logoOscuro from '../recursos/logo-oscuro.png';
import simboloSinergia from '../recursos/sinergia-simbolo.png';

interface PropiedadesDePantallaDeAcceso {
  /** Texto pequeno debajo de "SINERGIA" (p. ej. "Primer ingreso"). */
  subtitulo: string;
  children: ReactNode;
  /** Texto al pie, fuera de la tarjeta. */
  pie?: ReactNode;
  /** Boton "Volver al inicio" (la bienvenida), arriba a la izquierda (17/10). */
  volverAlInicio?: boolean;
}

export function PantallaDeAcceso({ subtitulo, children, pie, volverAlInicio }: PropiedadesDePantallaDeAcceso) {
  return (
    <div className="acceso">
      {volverAlInicio && (
        <Link to="/" className="btn-icono-claro tp-volver acceso-volver" data-ayuda="Volver a la página de bienvenida">
          <Icono nombre="volver" tamano={16} /> Volver al inicio
        </Link>
      )}
      <div className="acceso-barra">
        <BotonTema clase="btn-icono-claro btn-tema-acceso" />
      </div>

      <main className="acceso-caja">
        <div className="acceso-marca">
          <span className="acceso-simbolo">
            <img src={simboloSinergia} alt="" />
          </span>
          <div className="nom">
            <b>SINERGIA</b>
            <span>{subtitulo}</span>
          </div>
        </div>

        {children}

        <div className="acceso-muni">
          {/* El CSS muestra uno u otro segun el tema. */}
          <img className="logo-claro" src={logoClaro} alt="Municipalidad de Palmares" />
          <img className="logo-oscuro" src={logoOscuro} alt="" />
          <span aria-hidden="true">Municipalidad de Palmares</span>
        </div>

        {pie && <p className="acceso-pie">{pie}</p>}
      </main>
    </div>
  );
}
