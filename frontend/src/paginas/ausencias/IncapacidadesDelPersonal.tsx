/*
 * Incapacidades del personal (/incapacidades), para Recursos Humanos:
 * buscar y filtrar las de todos (tipo, departamento, fechas), ver la
 * boleta y registrar a nombre de alguien. Nadie aprueba, rechaza ni anula una
 * incapacidad (decision 10/10).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { consultarOpcionesDeFuncionario } from '../../api/funcionarios';
import { consultarTiposDeIncapacidad, consultarTodasLasIncapacidades, type Incapacidad } from '../../api/ausencias';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { useSesion } from '../../sesion/SesionProveedor';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { DetalleDeIncapacidad } from './DetalleDeIncapacidad';
import { ListaDeIncapacidades } from './ListaDeIncapacidades';

export function IncapacidadesDelPersonal() {
  const { tienePermisos } = useSesion();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const tipoIncapacidadId = parametros.get('tipo') ?? '';
  const departamentoId = parametros.get('departamento') ?? '';
  const busqueda = parametros.get('busqueda') ?? '';
  const desde = parametros.get('desde') ?? '';
  const hasta = parametros.get('hasta') ?? '';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const hayFiltros = Boolean(tipoIncapacidadId || departamentoId || busqueda || desde || hasta);
  const [texto, setTexto] = useBusquedaDiferida(busqueda, (t) => cambiar({ busqueda: t }));

  const tipos = useConsulta(consultarTiposDeIncapacidad, []).datos ?? [];
  const departamentos = useConsulta(tienePermisos('funcionarios.ver') ? consultarOpcionesDeFuncionario : null, []).datos?.departamentos ?? [];
  const lista = useConsulta(
    () =>
      consultarTodasLasIncapacidades({
        tipoIncapacidadId: tipoIncapacidadId || undefined,
        departamentoId: departamentoId || undefined,
        busqueda: busqueda || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        pagina,
        tamano: 12,
      }),
    [tipoIncapacidadId, departamentoId, busqueda, desde, hasta, pagina],
  );
  const [abierta, setAbierta] = useState<Incapacidad | null>(null);

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Incapacidades del personal</h1>
          <p>Las incapacidades registradas, con su boleta. Nadie las aprueba, rechaza ni anula, y no descuentan vacaciones: la boleta es el respaldo.</p>
        </div>
        <div className="acc">
          <Link className="btn btn-primario" to="/registrar-solicitud?tipo=incapacidad" data-ayuda="Registrar una incapacidad a nombre de cualquier funcionario">
            <Icono nombre="personaMas" /> Registrar incapacidad
          </Link>
        </div>
      </div>


      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, cédula, consecutivo o boleta" aria-label="Buscar incapacidades" />
        </div>
        <label className="filtro-select">
          <span className="sr">Tipo</span>
          <select value={tipoIncapacidadId} onChange={(e) => cambiar({ tipo: e.target.value })}>
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
          <input type="date" value={desde} onChange={(e) => cambiar({ desde: e.target.value })} aria-label="Incapacidades que terminan desde esta fecha" />
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label="Incapacidades que empiezan hasta esta fecha" />
        </label>
        {hayFiltros && (
          <button type="button" className="btn-texto" onClick={() => { setTexto(''); cambiar({ tipo: '', departamento: '', busqueda: '', desde: '', hasta: '' }); }} data-ayuda="Quitar todos los filtros y la búsqueda">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="bloque-lista">
        {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
        {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
        {lista.datos && lista.datos.datos.length === 0 && (
          <div className="vacio">
            <h3>{hayFiltros ? 'No hay incapacidades con esos filtros' : 'Todavía no hay incapacidades registradas'}</h3>
            <p>{hayFiltros ? 'Pruebe con otra búsqueda o quite algún filtro.' : 'Las que registre el personal o Recursos Humanos aparecerán aquí.'}</p>
          </div>
        )}
        {lista.datos && lista.datos.datos.length > 0 && (
          <>
            <ListaDeIncapacidades incapacidades={lista.datos.datos} mostrarPersona alAbrir={setAbierta} />
            <Paginacion resultado={lista.datos} nombre={['incapacidad', 'incapacidades']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
          </>
        )}
      </div>

      {abierta && (
        <DetalleDeIncapacidad
          id={abierta.id}
          alCerrar={() => setAbierta(null)} />
      )}
    </section>
  );
}
