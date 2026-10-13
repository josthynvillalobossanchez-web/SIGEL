/*
 * Campana de notificaciones de la barra superior (Sprint 3, HU 42 y 44).
 *
 * - Muestra cuantas hay sin leer (globo rojo; 9+ si son muchas).
 * - Al tocarla abre un panel con las 6 mas recientes: tocar una la marca
 *   como leida y lleva a su tramite; "Marcar todas como leídas" y "Ver
 *   todas" (pagina /notificaciones).
 * - Se actualiza sola cada minuto, al cambiar de pagina y cuando la pagina de
 *   Notificaciones marca algo (EVENTO_NOTIFICACIONES).
 * - Accesible: el boton dice cuantas hay sin leer, el panel se cierra con
 *   Escape o tocando fuera y devuelve el foco a la campana.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  consultarResumenDeNotificaciones,
  cuandoFue,
  EVENTO_NOTIFICACIONES,
  marcarNotificacionLeida,
  marcarTodasLasNotificaciones,
  type Notificacion,
} from '../api/notificaciones';
import { Icono } from './Icono';

const CADA_CUANTO_MS = 60_000;

export function Campana() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [resumen, setResumen] = useState<{ sinLeer: number; recientes: Notificacion[] } | null>(null);
  const [abierta, setAbierta] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    consultarResumenDeNotificaciones()
      .then(setResumen)
      .catch(() => undefined); // si falla, se intenta en el siguiente minuto
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = window.setInterval(cargar, CADA_CUANTO_MS);
    window.addEventListener(EVENTO_NOTIFICACIONES, cargar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener(EVENTO_NOTIFICACIONES, cargar);
    };
  }, [cargar]);

  // Al cambiar de pagina: se actualiza y se cierra el panel.
  useEffect(() => {
    cargar();
    setAbierta(false);
  }, [ubicacion.pathname, ubicacion.search, cargar]);

  // Cerrar con Escape o tocando fuera.
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierta(false);
        boton.current?.focus();
      }
    };
    const alTocar = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alTocar);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.removeEventListener('mousedown', alTocar);
    };
  }, [abierta]);

  async function abrir(n: Notificacion) {
    setAbierta(false);
    if (!n.leida) await marcarNotificacionLeida(n.id).catch(() => undefined);
    cargar();
    if (n.enlace) navegar(n.enlace);
    else navegar('/notificaciones');
  }

  async function leerTodas() {
    await marcarTodasLasNotificaciones().catch(() => undefined);
    cargar();
  }

  const sinLeer = resumen?.sinLeer ?? 0;
  const etiqueta = sinLeer === 0 ? 'Notificaciones: ninguna sin leer' : `Notificaciones: ${sinLeer} sin leer`;

  return (
    <div className="campana">
      <button
        ref={boton}
        type="button"
        className="tb-btn campana-btn"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        aria-controls="panel-notificaciones"
        data-ayuda={abierta ? undefined : 'Ver sus notificaciones'}
        onClick={() => setAbierta((a) => !a)}
      >
        <Icono nombre="campana" />
        {sinLeer > 0 && (
          <span className="campana-globo" aria-hidden="true">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div ref={panel} id="panel-notificaciones" className="campana-panel" role="dialog" aria-label="Notificaciones recientes">
          <div className="campana-cab">
            <b>Notificaciones</b>
            {sinLeer > 0 && (
              <button type="button" className="btn-texto" onClick={() => void leerTodas()} data-ayuda="Marcar todas sus notificaciones como leídas">
                Marcar todas como leídas
              </button>
            )}
          </div>
          {!resumen || resumen.recientes.length === 0 ? (
            <p className="campana-vacio">No tiene notificaciones.</p>
          ) : (
            <ul className="campana-lista">
              {resumen.recientes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="notif-item"
                    data-leida={n.leida ? 'si' : 'no'}
                    onClick={() => void abrir(n)}
                    data-ayuda={n.enlace ? 'Abrir el trámite (queda marcada como leída)' : 'Ver en Notificaciones'}
                  >
                    <span className="notif-punto" aria-hidden="true" />
                    <span className="notif-texto">
                      <b>
                        {n.titulo}
                        {!n.leida && <span className="sr"> (sin leer)</span>}
                      </b>
                      <span className="notif-mensaje">{n.mensaje}</span>
                      <small>{cuandoFue(n.fechaCreacion)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="campana-pie">
            <button type="button" className="btn btn-secundario btn-chico" onClick={() => navegar('/notificaciones')} data-ayuda="Ver todas sus notificaciones, las leídas y las sin leer">
              Ver todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
