/*
 * Vista de mes del calendario inteligente.
 *
 * Pantalla ancha: cada solicitud es una barra de color que cruza los dias
 * que dura (como en los calendarios de correo). Si en un dia coincide mas
 * gente de la que cabe, aparece "+N mas" y al tocarlo se abre la lista del dia.
 *
 * Celular: las barras serian ilegibles, asi que cada dia muestra puntitos
 * de color (uno por solicitud) y al tocar un dia se ve su lista debajo.
 *
 * Pendientes = barra rayada y con borde punteado; aprobadas = color pleno.
 */
import { useMemo } from 'react';
import type { SolicitudDeLista } from '../../api/vacaciones';
import { diaDelMes, fechaLarga, mesDe, NOMBRES_DE_DIAS_CORTOS, semanasDelMes, textoDeRango } from '../../utilidades/calendario';
import { colorDelTipo } from '../vacaciones/comunes';
import { repartirSemana, solicitudesDelDia } from './reparto';

interface Propiedades {
  anio: number;
  mes: number;
  solicitudes: SolicitudDeLista[];
  feriados: ReadonlyMap<string, string>;
  hoy: string;
  /** Dia seleccionado (celular: se muestra su lista debajo). */
  diaElegido: string | null;
  esMovil: boolean;
  /** true = mostrar el nombre de la persona en la barra; false = el tipo (calendario propio). */
  mostrarPersona: boolean;
  alElegirDia: (fecha: string) => void;
  alAbrir: (solicitud: SolicitudDeLista) => void;
  /** Id de la solicitud a resaltar (al llegar con "Ver en calendario"). */
  resaltar?: string | null;
}

/** Cuantas filas de barras caben en cada semana antes de contar "+N mas". */
const CARRILES_DE_ESCRITORIO = 3;
const PUNTOS_EN_CELULAR = 3;

export function VistaDeMes({ anio, mes, solicitudes, feriados, hoy, diaElegido, esMovil, mostrarPersona, alElegirDia, alAbrir, resaltar }: Propiedades) {
  const semanas = useMemo(() => semanasDelMes(anio, mes), [anio, mes]);
  const repartos = useMemo(() => semanas.map((semana) => repartirSemana(semana, solicitudes, CARRILES_DE_ESCRITORIO)), [semanas, solicitudes]);

  return (
    <div className="mes" role="grid" aria-label="Calendario del mes">
      <div className="mes-cab" role="row">
        {NOMBRES_DE_DIAS_CORTOS.map((d, i) => (
          <span key={d} role="columnheader" className={i >= 5 ? 'fin-de-semana' : undefined}>
            {d}
          </span>
        ))}
      </div>

      {semanas.map((semana, indice) => {
        const { barras, ocultasPorDia } = repartos[indice];
        return (
          <div
            className="mes-semana"
            role="row"
            key={semana[0]}
            // Alto segun lo que hay: una semana vacia ocupa poco; una llena, hasta los carriles maximos + "+N mas".
            style={esMovil ? undefined : { ['--alto-semana' as string]: `${Math.max(92, 42 + (Math.max(-1, ...barras.map((b) => b.carril)) + 1) * 25 + (ocultasPorDia.some((n) => n > 0) ? 26 : 8))}px` }}
          >
            <div className="mes-dias">
              {semana.map((fecha, d) => {
                const delDia = esMovil ? solicitudesDelDia(fecha, solicitudes) : [];
                const feriado = feriados.get(fecha);
                const enOtroMes = mesDe(fecha) !== mes;
                const total = esMovil ? delDia.length : 0;
                return (
                  <div
                    key={fecha}
                    role="gridcell"
                    className="mes-dia"
                    data-otro-mes={enOtroMes ? 'si' : undefined}
                    data-hoy={fecha === hoy ? 'si' : undefined}
                    data-fin-de-semana={d >= 5 ? 'si' : undefined}
                    data-feriado={feriado ? 'si' : undefined}
                    data-elegido={fecha === diaElegido ? 'si' : undefined}
                  >
                    <button
                      type="button"
                      className="mes-dia-boton"
                      onClick={() => alElegirDia(fecha)}
                      aria-label={`${fechaLarga(fecha)}${feriado ? `, feriado: ${feriado}` : ''}${esMovil ? `, ${total} solicitudes` : ''}`}
                      aria-pressed={fecha === diaElegido}
                    >
                      <span className="mes-num">{diaDelMes(fecha)}</span>
                      {feriado && <span className="mes-feriado" title={feriado}>{esMovil ? '⚑' : `⚑ ${feriado}`}</span>}
                    </button>

                    {esMovil && total > 0 && (
                      <span className="mes-puntos" aria-hidden="true">
                        {delDia.slice(0, PUNTOS_EN_CELULAR).map((s) => (
                          <i key={s.id} data-estado={s.estado} style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }} />
                        ))}
                        {total > PUNTOS_EN_CELULAR && <em>+</em>}
                      </span>
                    )}

                    {!esMovil && ocultasPorDia[d] > 0 && (
                      <button type="button" className="mes-mas" onClick={() => alElegirDia(fecha)} data-ayuda="Ver todas las ausencias de ese día">
                        +{ocultasPorDia[d]} más
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!esMovil && (
              <div className="mes-barras">
                {barras.map((b) => {
                  const s = b.solicitud;
                  const texto = mostrarPersona ? s.funcionario.nombre : s.tipo.nombre;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="barra"
                      data-estado={s.estado}
                      data-antes={b.vieneDeAntes ? 'si' : undefined}
                      data-despues={b.siguePorDespues ? 'si' : undefined}
                      style={{ gridColumn: `${b.columna} / span ${b.largo}`, gridRow: b.carril + 1, ['--ev' as string]: colorDelTipo(s.tipo.color) }}
                      data-ayuda={`${s.funcionario.nombre} · ${s.tipo.nombre} · ${textoDeRango(s.fechaInicio, s.fechaFin)}${s.estado === 'pendiente' ? ' (pendiente)' : ''}`}
                      data-resaltada={s.id === resaltar ? 'si' : undefined}
                      onClick={() => alAbrir(s)}
                    >
                      <span>{texto}</span>
                      {mostrarPersona && b.largo >= 3 && <small>{s.tipo.nombre}</small>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
