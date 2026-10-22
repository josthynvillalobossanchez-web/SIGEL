/*
 * Mis ausencias (/mis-ausencias; antes "Mis vacaciones"): lo principal del modulo para cualquier
 * persona. Arriba el boton para pedir y, en pestanas (sin tener que bajar,
 * decision 01/10): el saldo, sus solicitudes, sus incapacidades y el
 * historial del saldo.
 * Pensada primero para celular: una sola columna, boton grande, tarjetas.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { consultarMiSaldo, consultarMisSolicitudes, consultarSolicitud, type EstadoDeSolicitud, type SolicitudDeLista } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { hoyEnCostaRica } from '../../utilidades/calendario';
import { useConsulta } from '../../utilidades/useConsulta';
import { consultarIncapacidad, consultarMisIncapacidades, type Incapacidad } from '../../api/ausencias';
import { useAbrirDesdeEnlace } from '../../utilidades/useAbrirDesdeEnlace';
import { DetalleDeIncapacidad } from '../ausencias/DetalleDeIncapacidad';
import { ListaDeIncapacidades } from '../ausencias/ListaDeIncapacidades';
import { useSesion } from '../../sesion/SesionProveedor';
import { DetalleDeSolicitud } from './comunes';
import { ListaDeSolicitudes } from './ListaDeSolicitudes';
import { HistorialDelSaldo, SaldoDeVacaciones } from './SaldoDeVacaciones';

const FILTROS: { valor: '' | EstadoDeSolicitud; texto: string }[] = [
  { valor: '', texto: 'Todas' },
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aprobada', texto: 'Aprobadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
];

export function MisVacaciones() {
  const { usuario } = useSesion();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const estado = (parametros.get('estado') ?? '') as '' | EstadoDeSolicitud;
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const pestana = ['saldo', 'solicitudes', 'incapacidades', 'historial'].includes(parametros.get('pestana') ?? '') ? parametros.get('pestana')! : 'saldo';

  const saldo = useConsulta(consultarMiSaldo, []);
  const pendientes = useConsulta(() => consultarMisSolicitudes({ estado: 'pendiente', tamano: 1 }), []).datos?.total ?? 0;
  const lista = useConsulta(() => consultarMisSolicitudes({ estado: estado || undefined, pagina, tamano: 8 }), [estado, pagina]);
  const [abierta, setAbierta] = useState<SolicitudDeLista | null>(null);
  const incapacidades = useConsulta(pestana === 'incapacidades' ? () => consultarMisIncapacidades({ estado: 'todas', pagina, tamano: 8 }) : null, [pestana, pagina]);
  const [incapacidadAbierta, setIncapacidadAbierta] = useState<Incapacidad | null>(null);
  // Desde una notificacion (?abrir=<id>): una incapacidad (pestana Incapacidades) o una solicitud.
  useAbrirDesdeEnlace(
    (id) => (pestana === 'incapacidades' ? consultarIncapacidad(id).then((i) => ({ incapacidad: i })) : consultarSolicitud(id).then((s) => ({ solicitud: s }))),
    (r: { incapacidad?: Incapacidad; solicitud?: SolicitudDeLista }) => (r.incapacidad ? setIncapacidadAbierta(r.incapacidad) : r.solicitud && setAbierta(r.solicitud)),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const consultaProximas = useConsulta(() => consultarMisSolicitudes({ desde: hoyEnCostaRica(), tamano: 3 }), []);
  const proximas = consultaProximas.datos;

  function alCambiar(mensaje: string) {
    setAbierta(null);
    setAviso(mensaje);
    saldo.recargar();
    lista.recargar();
    // 21/10: "Lo proximo" tambien (antes seguia mostrando como aprobada una solicitud recien cancelada).
    consultaProximas.recargar();
  }


  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Mis ausencias</h1>
          <p>Todo lo de sus días fuera del trabajo: el saldo de vacaciones, sus solicitudes (vacaciones, permisos, licencias, capacitaciones) y sus incapacidades.</p>
        </div>
        <div className="acc acc-principal">
          <Link className="btn btn-primario btn-grande" to="/mis-ausencias/nueva" data-ayuda="Pedir vacaciones, un permiso o una licencia, o registrar una incapacidad o capacitación">
            <Icono nombre="mas" /> Nueva solicitud
          </Link>
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}

      <Pestanas
        etiqueta="Mis ausencias"
        actual={pestana}
        alCambiar={(id) => cambiar({ pestana: id === 'saldo' ? '' : id, estado: '' })}
        opciones={[
          { id: 'saldo', texto: 'Mi saldo' },
          { id: 'solicitudes', texto: 'Mis solicitudes', cuenta: pendientes || undefined },
          { id: 'incapacidades', texto: 'Incapacidades' },
          { id: 'historial', texto: 'Historial del saldo' },
        ]}
      />

      <PanelDePestana id="saldo" actual={pestana}>
        {saldo.error && <Mensaje tipo="error">{saldo.error}</Mensaje>}
        {saldo.datos && <SaldoDeVacaciones saldo={saldo.datos} />}
        {proximas && proximas.datos.filter((s) => s.estado === 'pendiente' || s.estado === 'aprobada').length > 0 && (
          <>
            <h2 className="inicio-titulo">Lo próximo</h2>
            <ListaDeSolicitudes solicitudes={proximas.datos.filter((s) => s.estado === 'pendiente' || s.estado === 'aprobada')} alAbrir={setAbierta} />
          </>
        )}
      </PanelDePestana>

      <PanelDePestana id="solicitudes" actual={pestana}>
        <div className="filtros" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button key={f.valor} type="button" className="filtro" aria-pressed={estado === f.valor} onClick={() => cambiar({ estado: f.valor })} data-ayuda={f.valor ? `Ver solo las solicitudes ${f.texto.toLowerCase()}` : 'Ver todas sus solicitudes'}>
              {f.texto}
            </button>
          ))}
        </div>

        <div className="bloque-lista">
          {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
          {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
          {lista.datos && lista.datos.datos.length === 0 && (
            <div className="vacio">
              <Icono nombre="sombrilla" tamano={30} />
              <h3>{estado ? 'No hay solicitudes con ese estado' : 'Todavía no ha hecho solicitudes'}</h3>
              <p>{estado ? 'Pruebe con otro filtro.' : 'Cuando pida vacaciones o un permiso, aparecerá aquí con su estado.'}</p>
            </div>
          )}
          {lista.datos && lista.datos.datos.length > 0 && (
            <>
              <ListaDeSolicitudes solicitudes={lista.datos.datos} alAbrir={setAbierta} />
              <Paginacion resultado={lista.datos} nombre={['solicitud', 'solicitudes']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
            </>
          )}
        </div>
      </PanelDePestana>

      <PanelDePestana id="incapacidades" actual={pestana}>
        <div className="fila-acciones">
          <p className="ayuda-detalle">Las incapacidades no se aprueban ni descuentan vacaciones. Su jefatura solo ve las fechas.</p>
          <Link className="btn btn-secundario" to="/mis-ausencias/nueva?tipo=incapacidad" data-ayuda="Registrar una incapacidad con su boleta">
            <Icono nombre="mas" /> Registrar incapacidad
          </Link>
        </div>
        <div className="bloque-lista">
          {incapacidades.error && <Mensaje tipo="error">{incapacidades.error}</Mensaje>}
          {incapacidades.cargando && !incapacidades.datos && <p className="ayuda-detalle">Cargando…</p>}
          {incapacidades.datos && incapacidades.datos.datos.length === 0 && (
            <div className="vacio">
              <Icono nombre="calendario" tamano={30} />
              <h3>No tiene incapacidades registradas</h3>
              <p>Cuando registre una, con su boleta, aparecerá aquí.</p>
            </div>
          )}
          {incapacidades.datos && incapacidades.datos.datos.length > 0 && (
            <>
              <ListaDeIncapacidades incapacidades={incapacidades.datos.datos} alAbrir={setIncapacidadAbierta} />
              <Paginacion resultado={incapacidades.datos} nombre={['incapacidad', 'incapacidades']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
            </>
          )}
        </div>
      </PanelDePestana>

      <PanelDePestana id="historial" actual={pestana}>
        {usuario?.funcionarioId && <HistorialDelSaldo funcionarioId={usuario.funcionarioId} siempreAbierto />}
      </PanelDePestana>

      {incapacidadAbierta && (
        <DetalleDeIncapacidad id={incapacidadAbierta.id} alCerrar={() => setIncapacidadAbierta(null)} />
      )}
      {abierta && <DetalleDeSolicitud solicitud={abierta} modo="propia" alCerrar={() => setAbierta(null)} alCambiar={alCambiar} />}
    </section>
  );
}
