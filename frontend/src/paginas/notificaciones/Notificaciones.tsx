/*
 * Notificaciones (/notificaciones), Sprint 3 (HU 42 y 44): los avisos de la
 * persona, las pendientes (sin leer) y las anteriores. Cada aviso dice que
 * proceso lo origino y lleva a su tramite; se puede marcar como leido uno a
 * uno o todos a la vez. Solo dentro del sistema: no se envian por correo.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  avisarCambioDeNotificaciones,
  consultarNotificaciones,
  cuandoFue,
  marcarNotificacionLeida,
  marcarTodasLasNotificaciones,
  type EstadoDeNotificaciones,
  type Notificacion,
} from '../../api/notificaciones';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { formatearFechaHora } from '../../utilidades/fechas';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useConsulta } from '../../utilidades/useConsulta';

const VISTAS: { valor: EstadoDeNotificaciones; texto: string }[] = [
  { valor: 'sinLeer', texto: 'Sin leer' },
  { valor: 'todas', texto: 'Todas' },
];

/** De que proceso viene (HU 42 CA02 / HU 44 CA04). */
const PROCESO: Record<string, string> = {
  solicitudPorAprobar: 'Solicitudes',
  solicitudRegistrada: 'Solicitudes',
  solicitudAprobada: 'Solicitudes',
  solicitudRechazada: 'Solicitudes',
  solicitudCancelada: 'Solicitudes',
  solicitudANombreSuyo: 'Solicitudes',
  incapacidadRegistrada: 'Incapacidades',
  horasExtraRegistradas: 'Horas extra',
  saldoAjustado: 'Vacaciones',
  vacacionesPorVencer: 'Vacaciones',
  vacacionesSobreElTope: 'Vacaciones',
  cambioEnSuExpediente: 'Expediente',
  cambioHechoPorFuncionario: 'Expediente',
  revisarJefatura: 'Funcionarios',
  constanciaFallida: 'Documentos',
};

export function Notificaciones() {
  const navegar = useNavigate();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const estado: EstadoDeNotificaciones = parametros.get('ver') === 'todas' ? 'todas' : 'sinLeer';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const lista = useConsulta(() => consultarNotificaciones(estado, pagina), [estado, pagina]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function marcar(n: Notificacion) {
    setError(null);
    try {
      await marcarNotificacionLeida(n.id);
      avisarCambioDeNotificaciones();
      lista.recargar();
    } catch (e) {
      setError(textoDelError(e));
    }
  }

  async function abrir(n: Notificacion) {
    if (!n.leida) await marcarNotificacionLeida(n.id).catch(() => undefined);
    avisarCambioDeNotificaciones();
    if (n.enlace) navegar(n.enlace);
    else lista.recargar();
  }

  async function leerTodas() {
    setError(null);
    try {
      const r = await marcarTodasLasNotificaciones();
      avisarCambioDeNotificaciones();
      setAviso(r.marcadas === 1 ? 'Se marcó 1 notificación como leída.' : `Se marcaron ${r.marcadas} notificaciones como leídas.`);
      lista.recargar();
    } catch (e) {
      setError(textoDelError(e));
    }
  }

  const sinLeer = lista.datos?.sinLeer ?? 0;

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Notificaciones</h1>
          <p>Avisos de los trámites que le corresponden: solicitudes, incapacidades, cambios en su expediente y otros. Tóquelos para ir al trámite.</p>
        </div>
        <div className="acc">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void leerTodas()}
            disabled={sinLeer === 0}
            data-ayuda={sinLeer === 0 ? 'No hay notificaciones sin leer' : 'Marcar todas sus notificaciones como leídas'}
          >
            <Icono nombre="check" /> Marcar todas como leídas
          </button>
        </div>
      </div>

      <div className="herramientas">
        <div className="segmentado" role="group" aria-label="Qué notificaciones mostrar">
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              type="button"
              aria-pressed={estado === v.valor}
              onClick={() => cambiar({ ver: v.valor === 'sinLeer' ? '' : v.valor })}
              data-ayuda={v.valor === 'sinLeer' ? 'Solo las pendientes de leer' : 'Las pendientes y las anteriores'}
            >
              {v.texto}
              {v.valor === 'sinLeer' && sinLeer > 0 && <span className="segmentado-cuenta">{sinLeer}</span>}
            </button>
          ))}
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {(error || lista.error) && <Mensaje tipo="error">{error ?? lista.error}</Mensaje>}
      {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}

      {lista.datos && lista.datos.datos.length === 0 && (
        <div className="vacio">
          <Icono nombre="campana" tamano={34} />
          <h3>{estado === 'sinLeer' ? 'No tiene notificaciones sin leer' : 'Todavía no tiene notificaciones'}</h3>
          <p>{estado === 'sinLeer' ? 'Está al día. En «Todas» puede ver las anteriores.' : 'Cuando un trámite requiera su atención, aparecerá aquí.'}</p>
        </div>
      )}

      {lista.datos && lista.datos.datos.length > 0 && (
        <>
          <ul className="lista-notificaciones">
            {lista.datos.datos.map((n) => (
              <li key={n.id} data-leida={n.leida ? 'si' : 'no'}>
                <button
                  type="button"
                  className="notif-item"
                  data-leida={n.leida ? 'si' : 'no'}
                  onClick={() => void abrir(n)}
                  data-ayuda={n.enlace ? 'Abrir el trámite (queda marcada como leída)' : 'Marcar como leída'}
                >
                  <span className="notif-punto" aria-hidden="true" />
                  <span className="notif-texto">
                    <span className="notif-cab">
                      <span className="chip chip-neutro">{PROCESO[n.clave] ?? 'ARCA'}</span>
                      <small title={formatearFechaHora(n.fechaCreacion)}>{cuandoFue(n.fechaCreacion)}</small>
                    </span>
                    <b>
                      {n.titulo}
                      {!n.leida && <span className="sr"> (sin leer)</span>}
                    </b>
                    <span className="notif-mensaje">{n.mensaje}</span>
                  </span>
                </button>
                {!n.leida && (
                  <button type="button" className="icono-btn notif-marcar" onClick={() => void marcar(n)} aria-label={`Marcar como leída: ${n.titulo}`} data-ayuda="Marcar como leída sin abrirla">
                    <Icono nombre="check" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Paginacion resultado={lista.datos} nombre={['notificación', 'notificaciones']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
        </>
      )}
    </section>
  );
}
