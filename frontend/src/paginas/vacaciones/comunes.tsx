/*
 * Piezas que comparten las pantallas de vacaciones y solicitudes:
 * etiqueta de estado, avatar con iniciales, colores por tipo y la ventana
 * de detalle de una solicitud (con las acciones que correspondan).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  aprobarSolicitud,
  cancelarSolicitud,
  consultarCalendario,
  consultarSaldoDe,
  consultarSolicitud,
  rechazarSolicitud,
  type EstadoDeSolicitud,
  type SolicitudDeLista,
} from '../../api/vacaciones';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { formatearFechaHora } from '../../utilidades/fechas';
import { hoyEnCostaRica, textoDeRango } from '../../utilidades/calendario';
import { useConsulta } from '../../utilidades/useConsulta';

/* ------------------------------------------------------------------ */
/* Estado, tipo y avatar                                               */
/* ------------------------------------------------------------------ */

export const TEXTO_DE_ESTADO: Record<EstadoDeSolicitud, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

const CLASE_DE_ESTADO: Record<EstadoDeSolicitud, string> = {
  pendiente: 'chip-advert',
  aprobada: 'chip-exito',
  rechazada: 'chip-error',
  cancelada: 'chip-neutro',
};

export function ChipDeEstado({ estado }: { estado: EstadoDeSolicitud }) {
  return <span className={`chip ${CLASE_DE_ESTADO[estado]}`}>{TEXTO_DE_ESTADO[estado]}</span>;
}

/** Color del tipo (el del catalogo) o un gris si el tipo no trae. */
export const colorDelTipo = (color: string | null | undefined) => color ?? '#6b7780';

/** Circulo con las iniciales de la persona; el color sale de su nombre, asi siempre es el mismo. */
export function Avatar({ nombre, tamano = 32 }: { nombre: string; tamano?: number }) {
  const palabras = nombre.trim().split(/\s+/);
  const iniciales = ((palabras[0]?.[0] ?? '') + (palabras[1]?.[0] ?? '')).toUpperCase();
  let semilla = 0;
  for (const letra of nombre) semilla = (semilla * 31 + letra.charCodeAt(0)) % 360;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.38), background: `hsl(${semilla} 32% 38%)` }}
    >
      {iniciales}
    </span>
  );
}

export function PuntoDeTipo({ color }: { color: string | null }) {
  return <span className="punto-tipo" style={{ background: colorDelTipo(color) }} aria-hidden="true" />;
}

/** "26 – 30 oct 2026 · 4 días" */
export function textoDeFechasYDias(s: Pick<SolicitudDeLista, 'fechaInicio' | 'fechaFin' | 'cantidadDias'>): string {
  const dias = s.cantidadDias === null ? '' : ` · ${s.cantidadDias} ${s.cantidadDias === 1 ? 'día' : 'días'}`;
  return `${textoDeRango(s.fechaInicio, s.fechaFin)}${dias}`;
}

/** Dias que dos rangos tienen en comun ("14 – 16 oct 2026"), o null si no se cruzan. */
export function rangoEnComun(a: { fechaInicio: string; fechaFin: string }, b: { fechaInicio: string; fechaFin: string }): string | null {
  const inicio = a.fechaInicio > b.fechaInicio ? a.fechaInicio : b.fechaInicio;
  const fin = a.fechaFin < b.fechaFin ? a.fechaFin : b.fechaFin;
  return inicio <= fin ? textoDeRango(inicio, fin) : null;
}

/** Direccion del calendario en el mes de la solicitud, con su barra resaltada. */
export function enlaceAlCalendario(s: SolicitudDeLista, alcance: 'propio' | 'equipo' | 'todos'): string {
  return `/calendario?alcance=${alcance}&mes=${s.fechaInicio.slice(0, 7)}&resaltar=${encodeURIComponent(s.id)}`;
}

/* ------------------------------------------------------------------ */
/* Ventana de detalle                                                  */
/* ------------------------------------------------------------------ */

interface PropiedadesDeDetalle {
  /** La solicitud ya cargada (de la lista): se muestra al instante y se refresca al abrir. */
  solicitud: SolicitudDeLista;
  /** "propia": la persona ve lo suyo. "jefatura": quien la resuelve. "rrhh": solo consulta. */
  modo: 'propia' | 'jefatura' | 'rrhh';
  alCerrar: () => void;
  /** Algo cambio (aprobada, rechazada, cancelada): refrescar la lista. */
  alCambiar: (mensaje: string) => void;
}

export function DetalleDeSolicitud({ solicitud: inicial, modo, alCerrar, alCambiar }: PropiedadesDeDetalle) {
  // Al abrirla la jefatura queda "leida" en el servidor, por eso se vuelve a pedir.
  const { datos } = useConsulta(() => consultarSolicitud(inicial.id), [inicial.id]);
  const s = datos ?? inicial;
  const navegar = useNavigate();
  const pendiente = s.estado === 'pendiente';
  const esDeJefatura = modo === 'jefatura' && pendiente;

  const [rechazando, setRechazando] = useState(false);
  /** Cancelar pide confirmacion; si ya estaba aprobada, ademas marcar "entiendo" (doble confirmacion). */
  const [cancelando, setCancelando] = useState(false);
  const [entiendo, setEntiendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contexto para decidir con criterio: el saldo de la persona y quien mas estara fuera.
  const saldo = useConsulta(esDeJefatura && s.tipo.descuentaVacaciones ? () => consultarSaldoDe(s.funcionario.id) : null, [s.funcionario.id, esDeJefatura]).datos;
  const equipo = useConsulta(esDeJefatura ? () => consultarCalendario(s.fechaInicio, s.fechaFin, 'equipo') : null, [s.id, esDeJefatura]).datos;
  const coinciden = (equipo?.eventos ?? []).filter((e) => e.id !== s.id && e.funcionario.id !== s.funcionario.id && (e.estado === 'aprobada' || e.estado === 'pendiente'));

  async function ejecutar(accion: () => Promise<unknown>, mensaje: string) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      alCambiar(mensaje);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  // Pendiente sin abrir: cualquiera. Aprobada: solo quien se la aprobo a si mismo (tope) y antes de que empiece.
  const cancelaAprobada = modo === 'propia' && s.estado === 'aprobada' && s.autoaprobada && s.fechaInicio > hoyEnCostaRica();
  const puedeCancelar = (modo === 'propia' && pendiente && !s.leidaPorAprobador) || cancelaAprobada;
  const alcanceDelCalendario = modo === 'jefatura' ? 'equipo' : modo === 'rrhh' ? 'todos' : 'propio';
  const motivoValido = motivo.trim().length >= 5;

  const pie = cancelando ? (
    <>
      <button className="btn btn-secundario" type="button" onClick={() => { setCancelando(false); setEntiendo(false); }} disabled={ocupado} data-ayuda="No cancelar: la solicitud queda como está">
        No, volver
      </button>
      <button
        className="btn btn-peligro"
        type="button"
        disabled={ocupado || (cancelaAprobada && !entiendo)}
        data-ayuda={cancelaAprobada && !entiendo ? 'Primero marque que entiende que no se puede deshacer' : 'Cancelar la solicitud definitivamente'}
        onClick={() => void ejecutar(() => cancelarSolicitud(s.id), cancelaAprobada && s.tipo.descuentaVacaciones ? `Solicitud cancelada: ${s.cantidadDias ?? 0} día(s) volvieron a su saldo.` : 'Solicitud cancelada.')}
      >
        Sí, cancelar solicitud
      </button>
    </>
  ) : (
    <>
      <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado} data-ayuda="Cerrar el detalle">
        Cerrar
      </button>
      {/* Las rechazadas y canceladas no se pintan en el calendario: ahi no hay nada que ver. */}
      {(s.estado === 'pendiente' || s.estado === 'aprobada') && (
      <button
        className="btn btn-secundario"
        type="button"
        disabled={ocupado}
        data-ayuda="Abrir el calendario en ese mes, con esta solicitud resaltada"
        onClick={() => {
          alCerrar();
          navegar(enlaceAlCalendario(s, alcanceDelCalendario));
        }}
      >
        <Icono nombre="calendario" /> Ver en calendario
      </button>
      )}
      {puedeCancelar && (
        <button className="btn btn-peligro" type="button" disabled={ocupado} onClick={() => setCancelando(true)} data-ayuda="Cancelar esta solicitud (le pedirá confirmar)">
          Cancelar solicitud
        </button>
      )}
      {esDeJefatura && !rechazando && (
        <>
          <button className="btn btn-peligro" type="button" disabled={ocupado} onClick={() => setRechazando(true)} data-ayuda="Rechazar: le pedirá el motivo, que la persona verá">
            Rechazar
          </button>
          <button className="btn btn-primario" type="button" disabled={ocupado} onClick={() => void ejecutar(() => aprobarSolicitud(s.id), 'Solicitud aprobada.')} data-ayuda={s.tipo.descuentaVacaciones ? 'Aprobar: los días se descuentan del saldo de la persona' : 'Aprobar la solicitud'}>
            <Icono nombre="check" /> Aprobar
          </button>
        </>
      )}
      {esDeJefatura && rechazando && (
        <button
          className="btn btn-peligro"
          type="button"
          disabled={ocupado || !motivoValido}
          data-ayuda={motivoValido ? 'Rechazar con este motivo' : 'Escriba un motivo de al menos 5 caracteres'}
          onClick={() => void ejecutar(() => rechazarSolicitud(s.id, motivo.trim()), 'Solicitud rechazada.')}
        >
          Confirmar rechazo
        </button>
      )}
    </>
  );

  return (
    <Modal
      titulo={s.tipo.nombre}
      descripcion={`${s.consecutivo} · ${s.funcionario.nombre}`}
      icono="calendario"
      alCerrar={alCerrar}
      ocupado={ocupado}
      pie={pie}
    >
      <div className="detalle-solicitud">
        <div className="detalle-fechas" style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }}>
          <b>{textoDeRango(s.fechaInicio, s.fechaFin)}</b>
          <span>{s.cantidadDias === null ? '' : `${s.cantidadDias} ${s.cantidadDias === 1 ? 'día hábil' : 'días hábiles'}`}</span>
          <ChipDeEstado estado={s.estado} />
        </div>

        <dl className="detalle-datos">
          <div>
            <dt>Funcionario</dt>
            <dd>
              {s.funcionario.nombre}
              {s.funcionario.departamento && <small> · {s.funcionario.departamento}</small>}
            </dd>
          </div>
          <div>
            <dt>Solicitada</dt>
            <dd>
              {formatearFechaHora(s.fechaSolicitud)}
              {s.enNombreDeTercero && <small> · por {s.solicitadaPor.nombre ?? 'Recursos Humanos'}</small>}
            </dd>
          </div>
          {s.motivo && (
            <div>
              <dt>Motivo</dt>
              <dd>{s.motivo}</dd>
            </div>
          )}
          {s.aprobador && (
            <div>
              <dt>{s.autoaprobada ? 'Aprobación' : 'Le corresponde aprobar a'}</dt>
              <dd>{s.autoaprobada ? 'Automática (no tiene jefatura por encima)' : s.aprobador.nombre}</dd>
            </div>
          )}
          {s.fechaResolucion && (
            <div>
              <dt>Resuelta</dt>
              <dd>{formatearFechaHora(s.fechaResolucion)}</dd>
            </div>
          )}
          {s.motivoRechazo && (
            <div>
              <dt>Motivo del rechazo</dt>
              <dd>{s.motivoRechazo}</dd>
            </div>
          )}
        </dl>

        {pendiente && modo === 'propia' && !cancelando && (
          <Mensaje tipo="info">
            {s.leidaPorAprobador
              ? 'Su jefatura ya la abrió, por eso ya no se puede cancelar. Si necesita cambiarla, hable con ella.'
              : `Mientras su jefatura no la abra, todavía puede cancelarla.${s.tipo.descuentaVacaciones ? ' Los días se descuentan solo si se aprueba.' : ''}`}
          </Mensaje>
        )}

        {cancelando && (
          <div className="confirmar-cancelacion" role="alert">
            <p>
              <Icono nombre="alerta" tamano={18} /> <b>¿Cancelar {s.tipo.nombre.toLowerCase()} del {textoDeRango(s.fechaInicio, s.fechaFin)}?</b>
            </p>
            {cancelaAprobada ? (
              <>
                <p>
                  Ya estaba aprobada. Al cancelarla {s.tipo.descuentaVacaciones ? <>{s.cantidadDias === 1 ? 'el ' : 'los '}<b>{s.cantidadDias === 1 ? '1 día hábil vuelve' : `${s.cantidadDias} días hábiles vuelven`} a su saldo</b></> : 'se libera esa fecha'} y la solicitud queda cancelada. <b>No se puede deshacer</b>: si después quiere esas fechas, tendrá que hacer una solicitud nueva.
                </p>
                <label className="casilla">
                  <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} /> Entiendo que la cancelación no se puede deshacer.
                </label>
              </>
            ) : (
              <p>No se puede deshacer: si después la quiere, tendrá que hacer una solicitud nueva.</p>
            )}
          </div>
        )}

        {esDeJefatura && (
          <div className="contexto-jefatura">
            {saldo && (
              <p>
                <Icono nombre="sombrilla" tamano={15} /> {s.funcionario.nombre.split(' ')[0]} tiene <b>{saldo.disponible} días disponibles</b>
                {saldo.reservado > 0 ? ` (${saldo.reservado} en solicitudes pendientes, incluida esta). Si aprueba, le quedan ${saldo.disponible - (s.cantidadDias ?? 0)}.` : '.'}
              </p>
            )}
            {equipo &&
              (coinciden.length === 0 ? (
                <p>
                  <Icono nombre="exito" tamano={15} /> Nadie más de su equipo estará fuera en esas fechas.
                </p>
              ) : (
                <div className="aviso-choque" role="status">
                  <p>
                    <Icono nombre="alerta" tamano={16} />{' '}
                    <b>
                      {coinciden.length === 1 ? 'Otra persona de su equipo ya pidió' : `${coinciden.length} personas de su equipo ya pidieron`} días que coinciden:
                    </b>
                  </p>
                  <ul className="coinciden">
                    {coinciden.map((e) => (
                      <li key={e.id}>
                        <Avatar nombre={e.funcionario.nombre} tamano={24} />
                        <span>
                          {e.funcionario.nombre}
                          <small>
                            {' '}
                            · {e.tipo.nombre.toLowerCase()} · coinciden <b>{rangoEnComun(e, s)}</b>
                            {e.estado === 'pendiente' ? ' (aún pendiente)' : ''}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {rechazando && (
          <div className="campo">
            <label htmlFor="motivo-rechazo">
              Motivo del rechazo <span className="obligatorio">*</span>
            </label>
            <textarea
              id="motivo-rechazo"
              value={motivo}
              maxLength={500}
              rows={3}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique brevemente por qué no se puede (la persona lo verá)."
            />
            <span className="ayuda">Mínimo 5 caracteres.</span>
          </div>
        )}

        {s.estado === 'aprobada' && s.tipo.descuentaVacaciones && modo !== 'jefatura' && !cancelando && (
          <p className="ayuda-detalle">
            Los días ya se descontaron del saldo. <Link to="/mis-vacaciones">Ver mi saldo</Link>
          </p>
        )}

        {error && <Mensaje tipo="error">{error}</Mensaje>}
      </div>
    </Modal>
  );
}
