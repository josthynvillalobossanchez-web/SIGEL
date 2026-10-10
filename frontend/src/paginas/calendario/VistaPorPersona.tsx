/*
 * Vista "Por persona": una fila por funcionario y una columna por dia del
 * mes, con la barra de cada solicitud. Es la forma mas clara de ver quien
 * coincide con quien. Arriba, una fila con CUANTAS personas estan fuera
 * cada dia (mas oscuro = mas gente), para detectar los dias criticos.
 *
 * En celular se desliza de lado y la columna de nombres queda fija.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { SolicitudDeLista } from '../../api/vacaciones';
import { diaDelMes, diasEntre, esFinDeSemana, fechasDelRango, fechaLarga, primeroDelMes, textoDeRango, ultimoDelMes } from '../../utilidades/calendario';
import { Avatar, colorDelTipo } from '../vacaciones/comunes';

interface Propiedades {
  anio: number;
  mes: number;
  solicitudes: SolicitudDeLista[];
  feriados: ReadonlyMap<string, string>;
  hoy: string;
  alElegirDia: (fecha: string) => void;
  alAbrir: (solicitud: SolicitudDeLista) => void;
  /** Id de la solicitud a resaltar (al llegar con "Ver en calendario"). */
  resaltar?: string | null;
}

export function VistaPorPersona({ anio, mes, solicitudes, feriados, hoy, alElegirDia, alAbrir, resaltar }: Propiedades) {
  const primero = primeroDelMes(anio, mes);
  const ultimo = ultimoDelMes(anio, mes);
  const dias = useMemo(() => fechasDelRango(primero, ultimo), [primero, ultimo]);

  const { filas, fueraPorDia, maximo } = useMemo(() => {
    const porPersona = new Map<string, { id: string; nombre: string; solicitudes: SolicitudDeLista[] }>();
    for (const s of solicitudes) {
      if (s.fechaFin < primero || s.fechaInicio > ultimo) continue;
      const fila = porPersona.get(s.funcionario.id) ?? { id: s.funcionario.id, nombre: s.funcionario.nombre, solicitudes: [] };
      fila.solicitudes.push(s);
      porPersona.set(s.funcionario.id, fila);
    }
    const filas = [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const fueraPorDia = dias.map((f) => filas.filter((p) => p.solicitudes.some((s) => s.fechaInicio <= f && s.fechaFin >= f)).length);
    return { filas, fueraPorDia, maximo: Math.max(1, ...fueraPorDia) };
  }, [solicitudes, dias, primero, ultimo]);

  // En celular el mes no cabe: al abrir se lleva a la vista la primera ausencia (o hoy).
  const caja = useRef<HTMLDivElement>(null);
  const primeraAusencia = filas.reduce<string | null>((menor, p) => p.solicitudes.reduce((m, s) => { const f = s.fechaInicio < primero ? primero : s.fechaInicio; return m === null || f < m ? f : m; }, menor), null);
  useEffect(() => {
    const el = caja.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const meta = primeraAusencia ?? (hoy >= primero && hoy <= ultimo ? hoy : null);
    const celda = meta ? el.querySelectorAll<HTMLElement>('.persona-cabecera .persona-dia')[diasEntre(primero, meta)] : null;
    el.scrollLeft = celda ? Math.max(0, celda.offsetLeft - 140) : 0;
  }, [primero, hoy, ultimo, primeraAusencia]);

  const columnas = { gridTemplateColumns: `repeat(${dias.length}, var(--ancho-dia))` };

  if (filas.length === 0) {
    return (
      <div className="vacio">
        <h3>Nadie tiene ausencias este mes</h3>
        <p>Cuando haya vacaciones o permisos aparecerán aquí, una fila por persona.</p>
      </div>
    );
  }

  const celdasDeFondo = (
    <>
      {dias.map((f, i) => (
        <span
          key={f}
          className="persona-celda"
          style={{ gridColumn: i + 1 }}
          data-fin-de-semana={esFinDeSemana(f) ? 'si' : undefined}
          data-feriado={feriados.has(f) ? 'si' : undefined}
          data-hoy={f === hoy ? 'si' : undefined}
          title={feriados.get(f) ?? undefined}
        />
      ))}
    </>
  );

  return (
    <div className="por-persona" ref={caja} tabIndex={0} aria-label="Calendario por persona, se desliza de lado en pantallas pequeñas">
      <div className="por-persona-tabla" style={{ ['--dias' as string]: dias.length }}>
        <div className="persona-fila persona-cabecera">
          <span className="persona-nombre">Día</span>
          <div className="persona-dias" style={columnas}>
            {dias.map((f) => (
              <button
                type="button"
                key={f}
                className="persona-dia"
                data-fin-de-semana={esFinDeSemana(f) ? 'si' : undefined}
                data-feriado={feriados.has(f) ? 'si' : undefined}
                data-hoy={f === hoy ? 'si' : undefined}
                aria-label={fechaLarga(f)}
                onClick={() => alElegirDia(f)}
              >
                {diaDelMes(f)}
              </button>
            ))}
          </div>
        </div>

        <div className="persona-fila persona-ocupacion">
          <span className="persona-nombre">Fuera ese día</span>
          <div className="persona-dias" style={columnas}>
            {fueraPorDia.map((n, i) => (
              <span key={dias[i]} className="persona-cuenta" style={{ ['--calor' as string]: n / maximo }} data-ayuda={`${n} ${n === 1 ? 'persona' : 'personas'} fuera ese día`}>
                {n > 0 ? n : ''}
              </span>
            ))}
          </div>
        </div>

        {filas.map((persona) => (
          <div className="persona-fila" key={persona.id}>
            <span className="persona-nombre">
              <Avatar nombre={persona.nombre} tamano={24} />
              <span>{persona.nombre}</span>
            </span>
            <div className="persona-dias persona-barras" style={columnas}>
              {celdasDeFondo}
              {persona.solicitudes.map((s) => {
                const desde = s.fechaInicio < primero ? primero : s.fechaInicio;
                const hasta = s.fechaFin > ultimo ? ultimo : s.fechaFin;
                return (
                  <button
                    type="button"
                    key={s.id}
                    className="barra barra-persona"
                    data-estado={s.estado}
                    data-antes={s.fechaInicio < primero ? 'si' : undefined}
                    data-despues={s.fechaFin > ultimo ? 'si' : undefined}
                    style={{ gridColumn: `${diasEntre(primero, desde) + 1} / span ${diasEntre(desde, hasta) + 1}`, ['--ev' as string]: colorDelTipo(s.tipo.color) }}
                    data-ayuda={`${persona.nombre} · ${s.tipo.nombre} · ${textoDeRango(s.fechaInicio, s.fechaFin)}${s.estado === 'pendiente' ? ' (pendiente)' : ''}`}
                    data-resaltada={s.id === resaltar ? 'si' : undefined}
                    onClick={() => alAbrir(s)}
                  >
                    <span>{diasEntre(desde, hasta) >= 2 ? s.tipo.nombre : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
