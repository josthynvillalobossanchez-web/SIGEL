/*
 * Tarjeta del saldo de vacaciones: un anillo con los dias libres, el
 * desglose (ganados, usados, vencidos, ajustes) y el aviso de vencimiento.
 *
 * El saldo SIEMPRE lo calcula el backend (suma de movimientos); aqui solo
 * se dibuja. El numero grande es el DISPONIBLE (decision 01/10): pedir no
 * resta; los dias se descuentan solo al aprobarse. Lo pendiente se muestra
 * aparte, como "reservado" (no se puede volver a pedir mientras tanto).
 */
import { useState } from 'react';
import { consultarMovimientos, type MovimientoDeVacaciones, type ResumenDeSaldo } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { cuantoFalta, fechaCorta, fechaLargaConAnio, hoyEnCostaRica } from '../../utilidades/calendario';
import { useConsulta } from '../../utilidades/useConsulta';

const TEXTO_DE_MOVIMIENTO: Record<MovimientoDeVacaciones['tipo'], string> = {
  saldoInicial: 'Saldo inicial',
  acumulacion: 'Días ganados',
  consumo: 'Vacaciones disfrutadas',
  ajuste: 'Ajuste de Recursos Humanos',
  vencimiento: 'Días vencidos',
};

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
const conSigno = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Anillo de progreso: la parte llena es lo disponible sobre el tope que se puede acumular. */
function Anillo({ libre, tope }: { libre: number; tope: number }) {
  const radio = 52;
  const largo = 2 * Math.PI * radio;
  const parte = tope > 0 ? Math.max(0, Math.min(1, libre / tope)) : 0;
  return (
    <div className="anillo" role="img" aria-label={`${dias(libre)} disponibles de un tope de ${tope}`} data-ayuda={`Disponibles sobre el tope de ${tope} días que se pueden acumular`}>
      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
        <circle cx="60" cy="60" r={radio} className="anillo-fondo" />
        <circle
          cx="60"
          cy="60"
          r={radio}
          className="anillo-lleno"
          strokeDasharray={`${largo * parte} ${largo}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="anillo-texto">
        <b>{libre}</b>
        <span>{libre === 1 ? 'día disponible' : 'días disponibles'}</span>
      </div>
    </div>
  );
}

export function SaldoDeVacaciones({ saldo, nombre }: { saldo: ResumenDeSaldo; nombre?: string }) {
  const p = saldo.proximoPeriodo;
  const tope = saldo.regimen.topeEnDias ?? Math.max(saldo.disponible, 1);

  if (!saldo.saldoCargado) {
    return (
      <div className="card saldo-card">
        <Mensaje tipo="info">
          Recursos Humanos todavía no ha cargado {nombre ? `el saldo de ${nombre}` : 'su saldo de vacaciones'}. Cuando lo haga podrá ver aquí sus días y hacer solicitudes.
        </Mensaje>
      </div>
    );
  }

  return (
    <div className="card saldo-card">
      <div className="saldo-principal">
        <Anillo libre={saldo.disponible} tope={tope} />
        <div className="saldo-resumen">
          <h2>{nombre ? `Vacaciones de ${nombre}` : 'Sus vacaciones'}</h2>
          <p>
            Tiene <b>{dias(saldo.disponible)}</b> para disfrutar.
          </p>
          {saldo.reservado > 0 && (
            <p className="saldo-reservado">
              <b>{dias(saldo.reservado)}</b> en solicitudes pendientes de aprobar: se descuentan solo si se aprueban. Mientras tanto puede pedir hasta {dias(saldo.libre)} más.
            </p>
          )}
          <p className="saldo-proximo">
            <Icono nombre="reloj" tamano={15} /> Próxima acreditación: <b>+{p.diasQueSeGanan ?? '—'} días</b> el {fechaLargaConAnio(p.fecha, hoyEnCostaRica())} ({cuantoFalta(p.diasParaLlegar)}), al cumplir un año más de servicio.
          </p>
        </div>
      </div>

      {p.avisar && (
        <Mensaje tipo="advert">
          Ese día se perderían <b>{dias(p.diasEnRiesgo)}</b> porque el tope es de {saldo.regimen.topeEnDias} días. Conviene programar sus vacaciones antes del {fechaCorta(p.fecha)}.
        </Mensaje>
      )}

      {saldo.aniosDeServicio === 0 && saldo.ganadosPorAniversario === 0 && (
        <Mensaje tipo="info">
          Los días de vacaciones se ganan al cumplir cada año de servicio, no al ingresar. {nombre ?? 'Usted'} recibe sus primeros {p.diasQueSeGanan ?? ''} días el {fechaLargaConAnio(p.fecha, hoyEnCostaRica())}.
        </Mensaje>
      )}

      <dl className="saldo-cifras">
        {saldo.inicial > 0 && (
          <div data-ayuda="Los días que ya traía cuando Recursos Humanos lo registró en el sistema">
            <dt>Saldo inicial</dt>
            <dd>{saldo.inicial}</dd>
          </div>
        )}
        <div data-ayuda="Días ganados al cumplir cada año de servicio">
          <dt>Ganados</dt>
          <dd>{saldo.ganadosPorAniversario}</dd>
        </div>
        <div>
          <dt>Disfrutados</dt>
          <dd>{saldo.utilizado}</dd>
        </div>
        <div>
          <dt>Vencidos</dt>
          <dd>{saldo.vencido}</dd>
        </div>
        {saldo.ajustes !== 0 && (
          <div>
            <dt>Ajustes</dt>
            <dd>{conSigno(saldo.ajustes)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Historial de movimientos del saldo. Plegado hasta que se abre, o siempre abierto (pestana "Historial"). */
export function HistorialDelSaldo({ funcionarioId, siempreAbierto }: { funcionarioId: string; siempreAbierto?: boolean }) {
  const [abiertoAMano, setAbierto] = useState(false);
  const abierto = siempreAbierto || abiertoAMano;
  const [pagina, setPagina] = useState(1);
  const { datos, cargando, error } = useConsulta(abierto ? () => consultarMovimientos(funcionarioId, pagina) : null, [funcionarioId, pagina, abierto]);

  const cuerpo = (
    <>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {cargando && !datos && <p className="ayuda-detalle">Cargando…</p>}
      {datos && datos.datos.length === 0 && <p className="ayuda-detalle">Todavía no hay movimientos.</p>}
      {datos && datos.datos.length > 0 && (
        <>
          <ul className="movimientos">
            {datos.datos.map((m) => (
              <li key={m.id}>
                <div>
                  <b>{m.tipo === 'consumo' && m.cantidadDias > 0 ? 'Devolución por cancelación' : TEXTO_DE_MOVIMIENTO[m.tipo]}</b>
                  <small>
                    {fechaCorta(m.fecha)} {m.fecha.slice(0, 4)}
                    {m.periodo ? ` · periodo ${m.periodo}` : ''}
                    {m.solicitud ? ` · ${m.solicitud.consecutivo}` : ''}
                  </small>
                  {m.observacion && <small>{m.observacion}</small>}
                </div>
                <span className={m.cantidadDias < 0 ? 'resta' : 'suma'}>{conSigno(m.cantidadDias)}</span>
              </li>
            ))}
          </ul>
          {datos.totalPaginas > 1 && <Paginacion resultado={datos} nombre={['movimiento', 'movimientos']} alCambiar={setPagina} />}
        </>
      )}
    </>
  );

  if (siempreAbierto) return <div className="card historial-saldo historial-abierto">{cuerpo}</div>;
  return (
    <details className="card historial-saldo" onToggle={(e) => setAbierto(e.currentTarget.open)}>
      <summary data-ayuda="Mostrar u ocultar cada movimiento del saldo: días ganados, disfrutados, vencidos y ajustes">
        <Icono nombre="reloj" tamano={16} /> Historial del saldo
      </summary>
      {cuerpo}
    </details>
  );
}
