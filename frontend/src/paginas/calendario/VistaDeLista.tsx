/*
 * Vista "Lista" del calendario (01/10): la forma mas liviana de ver el mes.
 * Una fila por solicitud, agrupadas por semana, sin cuadricula. Pensada para
 * la jefatura y Recursos Humanos cuando el mes tiene muchas ausencias y las
 * barras "marean". Cada fila abre el detalle.
 */
import type { SolicitudDeLista } from '../../api/vacaciones';
import { fechaCorta, posicionEnSemana, sumarDias, textoDeRango } from '../../utilidades/calendario';
import { Avatar, ChipDeEstado, colorDelTipo } from '../vacaciones/comunes';

interface Propiedades {
  /** Primer y ultimo dia del mes que se ve. */
  primero: string;
  ultimo: string;
  solicitudes: SolicitudDeLista[];
  mostrarPersona: boolean;
  alAbrir: (s: SolicitudDeLista) => void;
  resaltar?: string | null;
}

export function VistaDeLista({ primero, ultimo, solicitudes, mostrarPersona, alAbrir, resaltar }: Propiedades) {
  // Solo las que tocan el mes; cada una va en la semana en que empieza (o la primera del mes).
  const delMes = solicitudes
    .filter((s) => s.fechaInicio <= ultimo && s.fechaFin >= primero)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio) || a.funcionario.nombre.localeCompare(b.funcionario.nombre));
  const semanas = new Map<string, SolicitudDeLista[]>();
  for (const s of delMes) {
    const desde = s.fechaInicio < primero ? primero : s.fechaInicio;
    const lunes = sumarDias(desde, -posicionEnSemana(desde));
    semanas.set(lunes, [...(semanas.get(lunes) ?? []), s]);
  }

  if (delMes.length === 0) {
    return (
      <div className="vacio">
        <h3>Nadie fuera este mes</h3>
        <p>No hay vacaciones ni permisos que mostrar con los filtros elegidos.</p>
      </div>
    );
  }

  return (
    <div className="cal-lista">
      {[...semanas.entries()].map(([lunes, filas]) => (
        <section key={lunes} className="cal-lista-semana" aria-label={`Semana del ${fechaCorta(lunes)}`}>
          <h3>
            Semana del {fechaCorta(lunes)} al {fechaCorta(sumarDias(lunes, 6))}
            <small>
              {' '}
              · {filas.length} {filas.length === 1 ? 'solicitud' : 'solicitudes'}
            </small>
          </h3>
          <ul>
            {filas.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => alAbrir(s)}
                  style={{ ['--ev' as string]: colorDelTipo(s.tipo.color) }}
                  data-estado={s.estado}
                  data-resaltada={s.id === resaltar ? 'si' : undefined}
                  data-ayuda="Abrir el detalle de la solicitud"
                  aria-label={`${s.funcionario.nombre}, ${s.tipo.nombre}, ${textoDeRango(s.fechaInicio, s.fechaFin)}, ${s.estado}. Abrir detalle`}
                >
                  <span className="cal-lista-franja" aria-hidden="true" />
                  {mostrarPersona && (
                    <span className="cal-lista-persona">
                      <Avatar nombre={s.funcionario.nombre} tamano={26} />
                      <span>{s.funcionario.nombre}</span>
                    </span>
                  )}
                  <span className="cal-lista-tipo">{s.tipo.nombre}</span>
                  <span className="cal-lista-fechas">
                    {textoDeRango(s.fechaInicio, s.fechaFin)}
                    {s.cantidadDias !== null && <small> · {s.cantidadDias} {s.cantidadDias === 1 ? 'día' : 'días'}</small>}
                  </span>
                  <ChipDeEstado estado={s.estado} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
