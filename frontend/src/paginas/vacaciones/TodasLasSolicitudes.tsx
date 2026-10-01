/*
 * Todas las solicitudes (/solicitudes), para Recursos Humanos: ver y buscar
 * las de todo el personal, con filtros (estado, tipo, departamento, fechas),
 * en tarjetas o en lista compacta. Registrar a nombre de alguien se hace en
 * "Solicitud para otra persona".
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { consultarOpcionesDeFuncionario } from '../../api/funcionarios';
import { consultarTiposDeSolicitud, consultarTodasLasSolicitudes, type EstadoDeSolicitud, type SolicitudDeLista } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { useSesion } from '../../sesion/SesionProveedor';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { DetalleDeSolicitud, TEXTO_DE_ESTADO } from './comunes';
import { ListaDeSolicitudes } from './ListaDeSolicitudes';
import { ElegirForma, FORMAS } from './ElegirForma';
import { usePreferencia } from '../../utilidades/usePreferencia';

const ESTADOS = Object.keys(TEXTO_DE_ESTADO) as EstadoDeSolicitud[];

export function TodasLasSolicitudes() {
  const { tienePermisos } = useSesion();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const estado = (parametros.get('estado') ?? '') as '' | EstadoDeSolicitud;
  const tipoSolicitudId = parametros.get('tipo') ?? '';
  const departamentoId = parametros.get('departamento') ?? '';
  const busqueda = parametros.get('busqueda') ?? '';
  const desde = parametros.get('desde') ?? '';
  const hasta = parametros.get('hasta') ?? '';
  const [forma, setForma] = usePreferencia('forma-solicitudes', FORMAS, 'compacta');
  const hayFiltros = Boolean(estado || tipoSolicitudId || departamentoId || busqueda || desde || hasta);
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const [texto, setTexto] = useBusquedaDiferida(busqueda, (t) => cambiar({ busqueda: t }));

  const tipos = useConsulta(consultarTiposDeSolicitud, []).datos ?? [];
  const departamentos = useConsulta(tienePermisos('funcionarios.ver') ? consultarOpcionesDeFuncionario : null, []).datos?.departamentos ?? [];
  const lista = useConsulta(
    () =>
      consultarTodasLasSolicitudes({
        estado: estado || undefined,
        tipoSolicitudId: tipoSolicitudId || undefined,
        departamentoId: departamentoId || undefined,
        busqueda: busqueda || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        pagina,
        tamano: forma === 'compacta' ? 20 : 10,
      }),
    [estado, tipoSolicitudId, departamentoId, busqueda, desde, hasta, pagina, forma],
  );
  const [abierta, setAbierta] = useState<SolicitudDeLista | null>(null);

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Solicitudes del personal</h1>
          <p>Todas las solicitudes de vacaciones y permisos. Aquí solo se consultan: las resuelve la jefatura de cada persona.</p>
        </div>
        <div className="acc">
          <Link className="btn btn-secundario" to="/calendario?alcance=todos" data-ayuda="Ver en el calendario quién está fuera y cuándo">
            <Icono nombre="calendario" /> Calendario
          </Link>
          <Link className="btn btn-primario" to="/registrar-solicitud" data-ayuda="Registrar vacaciones o un permiso a nombre de cualquier funcionario">
            <Icono nombre="personaMas" /> Para otra persona
          </Link>
        </div>
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, cédula o consecutivo" aria-label="Buscar solicitudes" />
        </div>
        <label className="filtro-select">
          <span className="sr">Estado</span>
          <select value={estado} onChange={(e) => cambiar({ estado: e.target.value })}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {TEXTO_DE_ESTADO[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Tipo</span>
          <select value={tipoSolicitudId} onChange={(e) => cambiar({ tipo: e.target.value })}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        {departamentos.length > 0 && (
          <label className="filtro-select">
            <span className="sr">Departamento</span>
            <select value={departamentoId} onChange={(e) => cambiar({ departamento: e.target.value })}>
              <option value="">Todos los departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="filtro-select filtro-fecha">
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => cambiar({ desde: e.target.value })} aria-label="Solicitudes que terminan desde esta fecha" />
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label="Solicitudes que empiezan hasta esta fecha" />
        </label>
        {hayFiltros && (
          <button type="button" className="btn-texto" onClick={() => { setTexto(''); cambiar({ estado: '', tipo: '', departamento: '', busqueda: '', desde: '', hasta: '' }); }} data-ayuda="Quitar todos los filtros y la búsqueda">
            Limpiar filtros
          </button>
        )}
        <span className="herramientas-fin">
          <ElegirForma forma={forma} alCambiar={setForma} />
        </span>
      </div>

      <div className="bloque-lista">
        {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
        {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
        {lista.datos && lista.datos.datos.length === 0 && (
          <div className="vacio">
            <h3>No hay solicitudes con esos filtros</h3>
            <p>Pruebe con otra búsqueda o quite algún filtro.</p>
          </div>
        )}
        {lista.datos && lista.datos.datos.length > 0 && (
          <>
            <ListaDeSolicitudes solicitudes={lista.datos.datos} mostrarPersona alAbrir={setAbierta} forma={forma} />
            <Paginacion resultado={lista.datos} nombre={['solicitud', 'solicitudes']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
          </>
        )}
      </div>

      {abierta && <DetalleDeSolicitud solicitud={abierta} modo="rrhh" alCerrar={() => setAbierta(null)} alCambiar={() => setAbierta(null)} />}
    </section>
  );
}
