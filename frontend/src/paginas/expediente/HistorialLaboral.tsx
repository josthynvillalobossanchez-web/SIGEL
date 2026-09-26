/*
 * Pestana "Historial laboral" del expediente (Ficha 17): linea de tiempo de
 * solo lectura, lo mas reciente arriba. Sale de la bitacora (backend:
 * ExpedientesService.historial): ingreso, cambios laborales (de que valor a
 * cual), salida y reingreso, con quien lo hizo. Los cambios de datos
 * personales no son historial laboral y no aparecen.
 *
 * Se piden 20 por vez; "Ver movimientos anteriores" trae los siguientes.
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { consultarHistorial, type MovimientoDelHistorial } from '../../api/expedientes';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono, type NombreDeIcono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { formatearFecha, formatearFechaHora, formatearFechaSola } from '../../utilidades/fechas';

const ICONOS: Record<MovimientoDelHistorial['tipo'], NombreDeIcono> = {
  ingreso: 'mas',
  cambio: 'editar',
  salida: 'salir',
  reingreso: 'reactivar',
};

export function HistorialLaboral({ funcionarioId }: { funcionarioId: string }) {
  const [movimientos, setMovimientos] = useState<MovimientoDelHistorial[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar(siguiente: number) {
    setCargando(true);
    setError(null);
    try {
      const r = await consultarHistorial(funcionarioId, siguiente);
      setMovimientos((antes) => (siguiente === 1 ? r.datos : [...antes, ...r.datos]));
      setPagina(r.pagina);
      setTotalPaginas(r.totalPaginas);
      setTotal(r.total);
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId]);

  if (error && movimientos.length === 0) return <Mensaje tipo="error">{error}</Mensaje>;
  if (cargando && movimientos.length === 0) return <p style={{ color: 'var(--texto-sec)' }}>Cargando el historial…</p>;
  if (movimientos.length === 0) {
    return (
      <div className="vacio">
        <Icono nombre="reloj" tamano={36} />
        <h3>Todavía no hay movimientos</h3>
        <p>Aquí aparecerán el ingreso, los cambios de puesto, departamento, jefatura o nombramiento, la salida y el reingreso.</p>
      </div>
    );
  }

  return (
    <>
      <p className="nota-pagina">
        {total} movimiento{total === 1 ? '' : 's'}, del más reciente al más antiguo. Es de solo lectura: sale de la bitácora
        del sistema.
      </p>
      <ol className="linea-tiempo" aria-label="Historial laboral">
        {movimientos.map((m) => (
          <li key={m.id} data-tipo={m.tipo}>
            <span className="lt-marca" aria-hidden="true">
              <Icono nombre={ICONOS[m.tipo]} tamano={16} />
            </span>
            <div className="lt-cuerpo">
              <div className="lt-cab">
                <h3>{m.titulo}</h3>
                <span className="lt-fecha num">{m.fechaEfectiva ? formatearFechaSola(m.fechaEfectiva) : formatearFecha(m.fechaHora)}</span>
              </div>
              {m.cambios.length > 0 && (
                <ul className="lt-cambios">
                  {m.cambios.map((c) => (
                    <li key={c.campo}>
                      <b>{c.campo}:</b>{' '}
                      {m.tipo === 'ingreso' ? (
                        <span>{c.despues ?? 'sin dato'}</span>
                      ) : (
                        <>
                          <span className="lt-antes">{c.antes ?? 'sin dato'}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="solo-lector"> cambió a </span>
                          <span className="lt-despues">{c.despues ?? 'sin dato'}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {m.detalle && <p className="lt-detalle">{m.detalle}</p>}
              <p className="lt-quien">
                Registrado por {m.quien} · {formatearFechaHora(m.fechaHora)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {pagina < totalPaginas && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <BotonConAyuda
            texto={cargando ? 'Cargando…' : 'Ver movimientos anteriores'}
            ayuda={`Mostrar los siguientes (van ${movimientos.length} de ${total})`}
            ocupado={cargando}
            alHacerClic={() => void cargar(pagina + 1)}
          />
        </div>
      )}
    </>
  );
}
