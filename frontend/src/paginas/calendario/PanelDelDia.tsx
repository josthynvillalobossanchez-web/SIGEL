/*
 * Lista de quienes estan fuera un dia. En celular va debajo del mes (el
 * dia elegido); en pantalla ancha se abre en una ventana al tocar un dia o
 * su "+N mas". Es una lista vertical: no importa cuanta gente coincida,
 * nunca se sale de la pantalla (si son muchas, se desliza dentro del panel).
 */
import type { SolicitudDeLista } from '../../api/vacaciones';
import { fechaLarga, textoDeRango } from '../../utilidades/calendario';
import { Avatar, ChipDeEstado, colorDelTipo } from '../vacaciones/comunes';

interface Propiedades {
  fecha: string;
  solicitudes: SolicitudDeLista[];
  /** Nombre del feriado de ese dia, si lo es. */
  feriado?: string;
  /** En el alcance "propio" no hace falta repetir quien es. */
  mostrarPersona: boolean;
  alAbrir: (solicitud: SolicitudDeLista) => void;
}

export function PanelDelDia({ fecha, solicitudes, feriado, mostrarPersona, alAbrir }: Propiedades) {
  return (
    <div className="panel-dia">
      <h3>{fechaLarga(fecha)}</h3>
      {feriado && (
        <p className="panel-feriado">
          <span aria-hidden="true">⚑</span> Feriado: {feriado}
        </p>
      )}
      {solicitudes.length === 0 ? (
        <p className="panel-vacio">{feriado ? 'Nadie tiene vacaciones ni permisos este día.' : 'Nadie tiene vacaciones ni permisos este día.'}</p>
      ) : (
        <>
          <p className="panel-cuenta">
            {solicitudes.length} {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'} ese día
          </p>
          <ul className="panel-lista">
            {solicitudes.map((s) => (
              <li key={s.id}>
                <button type="button" className="panel-fila" style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }} onClick={() => alAbrir(s)} data-ayuda="Abrir el detalle de la solicitud">
                  {mostrarPersona ? <Avatar nombre={s.funcionario.nombre} tamano={34} /> : <span className="punto-tipo grande" aria-hidden="true" style={{ background: colorDelTipo(s.tipo.color) }} />}
                  <span className="panel-texto">
                    <b>{mostrarPersona ? s.funcionario.nombre : s.tipo.nombre}</b>
                    <small>
                      {mostrarPersona ? `${s.tipo.nombre} · ` : ''}
                      {textoDeRango(s.fechaInicio, s.fechaFin)}
                    </small>
                  </span>
                  {s.estado !== 'aprobada' && <ChipDeEstado estado={s.estado} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
