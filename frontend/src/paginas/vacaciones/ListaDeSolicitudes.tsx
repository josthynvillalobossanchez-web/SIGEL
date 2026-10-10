/*
 * Lista de solicitudes en tarjetas. Sirve para "Mis vacaciones", la bandeja
 * de la jefatura y la lista de Recursos Humanos: en celular cada solicitud
 * es una tarjeta que se toca; en pantalla ancha las tarjetas se acomodan en
 * dos columnas. Nunca es una tabla, asi no hay que deslizar de lado.
 */
import type { SolicitudDeLista } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { formatearFecha } from '../../utilidades/fechas';
import { textoDeRango } from '../../utilidades/calendario';
import { Avatar, ChipDeEstado, colorDelTipo } from './comunes';

interface Propiedades {
  solicitudes: SolicitudDeLista[];
  /** Mostrar quien pidio (bandeja y Recursos Humanos). */
  mostrarPersona?: boolean;
  /** Resaltar las que la jefatura todavia no abre. */
  marcarNuevas?: boolean;
  alAbrir: (solicitud: SolicitudDeLista) => void;
  /** Aviso corto por solicitud (p. ej. "Coincide con 2 personas"). */
  avisos?: Record<string, string>;
  /** "compacta": una fila por solicitud, sin tarjeta (para ver mucho de un vistazo). */
  forma?: 'tarjetas' | 'compacta';
}

export function ListaDeSolicitudes({ solicitudes, mostrarPersona, marcarNuevas, alAbrir, avisos, forma = 'tarjetas' }: Propiedades) {
  if (forma === 'compacta') return <ListaCompacta solicitudes={solicitudes} mostrarPersona={mostrarPersona} marcarNuevas={marcarNuevas} alAbrir={alAbrir} avisos={avisos} />;
  return (
    <ul className="lista-solicitudes">
      {solicitudes.map((s) => {
        const nueva = marcarNuevas && s.estado === 'pendiente' && !s.leidaPorAprobador;
        return (
          <li key={s.id}>
            <button
              type="button"
              className="tarjeta-solicitud"
              data-nueva={nueva ? 'si' : undefined}
              style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }}
              onClick={() => alAbrir(s)}
              aria-label={`${s.tipo.nombre}, ${s.funcionario.nombre}, ${textoDeRango(s.fechaInicio, s.fechaFin)}, ${s.estado}${avisos?.[s.id] ? `, ${avisos[s.id]}` : ''}. Abrir detalle`}
              data-ayuda="Abrir el detalle de la solicitud"
            >
              <span className="tarjeta-franja" aria-hidden="true" />
              <span className="tarjeta-cuerpo">
                <span className="tarjeta-fila">
                  <b className="tarjeta-tipo">{s.tipo.nombre}</b>
                  <ChipDeEstado estado={s.estado} />
                </span>
                {mostrarPersona && (
                  <span className="tarjeta-persona">
                    <Avatar nombre={s.funcionario.nombre} tamano={26} />
                    <span>
                      {s.funcionario.nombre}
                      {s.funcionario.departamento && <small> · {s.funcionario.departamento}</small>}
                    </span>
                  </span>
                )}
                <span className="tarjeta-fechas">
                  <Icono nombre="calendario" tamano={15} />
                  {textoDeRango(s.fechaInicio, s.fechaFin)}
                  {s.cantidadDias !== null && (
                    <span className="tarjeta-dias">
                      {s.cantidadDias} {s.cantidadDias === 1 ? 'día' : 'días'}
                    </span>
                  )}
                </span>
                <span className="tarjeta-pie">
                  <span>{s.consecutivo}</span>
                  <span>Pedida el {formatearFecha(s.fechaSolicitud)}</span>
                  {nueva && <span className="etiqueta-nueva">Sin abrir</span>}
                  {avisos?.[s.id] && (
                    <span className="etiqueta-choque">
                      <Icono nombre="alerta" tamano={12} /> {avisos[s.id]}
                    </span>
                  )}
                  {s.enNombreDeTercero && <span className="etiqueta-tercero">Registrada por {s.solicitadaPor.nombre ?? 'otra persona'}</span>}
                  {s.autoaprobada && <span className="etiqueta-tercero">Aprobación automática</span>}
                </span>
              </span>
              <Icono nombre="siguiente" tamano={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Una fila por solicitud: persona, tipo, fechas, dias y estado. Mas liviana que las tarjetas. */
function ListaCompacta({ solicitudes, mostrarPersona, marcarNuevas, alAbrir, avisos }: Omit<Propiedades, 'forma'>) {
  return (
    <ul className="lista-compacta">
      {solicitudes.map((s) => {
        const nueva = marcarNuevas && s.estado === 'pendiente' && !s.leidaPorAprobador;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => alAbrir(s)}
              data-nueva={nueva ? 'si' : undefined}
              style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }}
              aria-label={`${s.tipo.nombre}, ${s.funcionario.nombre}, ${textoDeRango(s.fechaInicio, s.fechaFin)}, ${s.estado}${avisos?.[s.id] ? `, ${avisos[s.id]}` : ''}. Abrir detalle`}
              data-ayuda="Abrir el detalle de la solicitud"
            >
              <span className="compacta-punto" aria-hidden="true" />
              {mostrarPersona && <span className="compacta-persona">{s.funcionario.nombre}</span>}
              <span className="compacta-tipo">{s.tipo.nombre}</span>
              <span className="compacta-fechas">
                {textoDeRango(s.fechaInicio, s.fechaFin)}
                {s.cantidadDias !== null && <small> · {s.cantidadDias} d</small>}
              </span>
              <span className="compacta-estado">
                {avisos?.[s.id] && (
                  <span className="etiqueta-choque" title={avisos[s.id]}>
                    <Icono nombre="alerta" tamano={12} />
                  </span>
                )}
                {nueva && <span className="etiqueta-nueva">Sin abrir</span>}
                <ChipDeEstado estado={s.estado} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
