/*
 * Pestana "Historial laboral" del expediente (Ficha 17): linea de tiempo de
 * solo lectura, lo mas reciente arriba. Sale de la bitacora (backend:
 * ExpedientesService.historial): ingreso, cambios laborales (de que valor a
 * cual), salida y reingreso, con quien lo hizo. Los cambios de datos
 * personales no son historial laboral y no aparecen. Tambien muestra los
 * documentos agregados al expediente; las bajas y restauraciones de
 * documentos solo las ve quien puede restaurar (Recursos Humanos).
 *
 * Se piden 20 por vez; "Ver movimientos anteriores" trae los siguientes.
 * Filtros (10/10): tipo de movimiento, rango de fechas y texto libre.
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { consultarHistorial, type FiltrosDeHistorial, type MovimientoDelHistorial, type TipoDeFiltroDeHistorial } from '../../api/expedientes';
import { BotonConAyuda } from '../../componentes/Botones';
import { Icono, type NombreDeIcono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { formatearFecha, formatearFechaHora, formatearFechaSola } from '../../utilidades/fechas';

const ICONOS: Record<MovimientoDelHistorial['tipo'], NombreDeIcono> = {
  ingreso: 'mas',
  cambio: 'editar',
  salida: 'salir',
  reingreso: 'reactivar',
  documentoAgregado: 'documento',
  documentoBaja: 'desactivar',
  documentoRestaurado: 'reactivar',
};

const TIPOS: { valor: TipoDeFiltroDeHistorial; texto: string }[] = [
  { valor: '', texto: 'Todos los movimientos' },
  { valor: 'ingreso', texto: 'Ingreso' },
  { valor: 'cambio', texto: 'Cambios laborales' },
  { valor: 'salida', texto: 'Salida' },
  { valor: 'reingreso', texto: 'Reingreso' },
  { valor: 'documentos', texto: 'Documentos' },
];

export function HistorialLaboral({ funcionarioId }: { funcionarioId: string }) {
  const [texto, setTexto] = useState('');
  const [filtros, setFiltros] = useState<FiltrosDeHistorial>({});
  const hayFiltros = Boolean(filtros.tipo || filtros.desde || filtros.hasta || filtros.busqueda);
  // La busqueda espera a que se deje de escribir.
  useEffect(() => {
    const espera = window.setTimeout(() => setFiltros((f) => (f.busqueda === (texto.trim() || undefined) ? f : { ...f, busqueda: texto.trim() || undefined })), 350);
    return () => window.clearTimeout(espera);
  }, [texto]);
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
      const r = await consultarHistorial(funcionarioId, siguiente, filtros);
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
    // Se vuelve a pedir desde la primera pagina al cambiar de persona o de filtros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId, filtros]);

  const barra = (
    <div className="herramientas filtros-historial">
      <div className="buscador">
        <Icono nombre="buscar" />
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar (puesto, departamento, documento, quién…)" aria-label="Buscar en el historial" />
      </div>
      <label className="filtro-select">
        <span className="sr">Tipo de movimiento</span>
        <select value={filtros.tipo ?? ''} onChange={(e) => setFiltros((f) => ({ ...f, tipo: (e.target.value || undefined) as TipoDeFiltroDeHistorial | undefined }))}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.texto}
            </option>
          ))}
        </select>
      </label>
      <label className="filtro-select filtro-fecha">
        <span>Desde</span>
        <input type="date" value={filtros.desde ?? ''} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value || undefined }))} aria-label="Movimientos desde esta fecha" />
      </label>
      <label className="filtro-select filtro-fecha">
        <span>Hasta</span>
        <input type="date" value={filtros.hasta ?? ''} min={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value || undefined }))} aria-label="Movimientos hasta esta fecha" />
      </label>
      {hayFiltros && (
        <button type="button" className="btn-texto" onClick={() => { setTexto(''); setFiltros({}); }} data-ayuda="Quitar todos los filtros">
          Limpiar filtros
        </button>
      )}
    </div>
  );

  if (error && movimientos.length === 0) return <>{barra}<Mensaje tipo="error">{error}</Mensaje></>;
  if (cargando && movimientos.length === 0) return <>{barra}<p style={{ color: 'var(--texto-sec)' }}>Cargando el historial…</p></>;
  if (movimientos.length === 0) {
    return (
      <>
        {hayFiltros && barra}
        <div className="vacio">
          <Icono nombre="reloj" tamano={36} />
          <h3>{hayFiltros ? 'Ningún movimiento coincide con esos filtros' : 'Todavía no hay movimientos'}</h3>
          <p>{hayFiltros ? 'Pruebe con otro filtro o quítelos.' : 'Aquí aparecerán el ingreso, los cambios de puesto, departamento, jefatura o nombramiento, la salida y el reingreso.'}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {barra}
      <p className="nota-pagina">
        {total} movimiento{total === 1 ? '' : 's'}{hayFiltros ? ' con esos filtros' : ''}, del más reciente al más antiguo. Es de solo lectura: sale de la bitácora
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
