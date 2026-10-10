/*
 * Bandeja de la jefatura (/bandeja): las solicitudes de las personas a su
 * cargo que le toca resolver. Lo nuevo (sin abrir) se marca. Al abrir una
 * solicitud ve el saldo de la persona y quien mas del equipo estara fuera,
 * para decidir con criterio. Las que coinciden con dias de otra persona del
 * equipo se marcan desde la lista ("Coincide con 2 personas").
 * La persona elige verlas en tarjetas o en lista compacta.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { consultarBandeja, consultarCalendario, type EstadoDeSolicitud, type SolicitudDeLista } from '../../api/vacaciones';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Paginacion } from '../../componentes/Paginacion';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useConsulta } from '../../utilidades/useConsulta';
import { DetalleDeSolicitud } from './comunes';
import { ListaDeSolicitudes } from './ListaDeSolicitudes';
import { avisosDeChoque, ElegirForma, FORMAS } from './ElegirForma';
import { usePreferencia } from '../../utilidades/usePreferencia';

const FILTROS: { valor: EstadoDeSolicitud; texto: string }[] = [
  { valor: 'pendiente', texto: 'Por resolver' },
  { valor: 'aprobada', texto: 'Aprobadas' },
  { valor: 'rechazada', texto: 'Rechazadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
];

export function BandejaDeJefatura() {
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const estado = (parametros.get('estado') ?? 'pendiente') as EstadoDeSolicitud;
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);

  const lista = useConsulta(() => consultarBandeja({ estado, pagina, tamano: 10 }), [estado, pagina]);
  const [abierta, setAbierta] = useState<SolicitudDeLista | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [forma, setForma] = usePreferencia('forma-bandeja', FORMAS, 'tarjetas');

  // Choques: lo del equipo entre la primera y la ultima fecha de lo que se ve.
  const rango = useMemo(() => {
    const filas = lista.datos?.datos ?? [];
    if (!filas.length || estado !== 'pendiente') return null;
    return { desde: filas.reduce((m, s) => (s.fechaInicio < m ? s.fechaInicio : m), filas[0].fechaInicio), hasta: filas.reduce((m, s) => (s.fechaFin > m ? s.fechaFin : m), filas[0].fechaFin) };
  }, [lista.datos, estado]);
  const equipo = useConsulta(rango ? () => consultarCalendario(rango.desde, rango.hasta, 'equipo') : null, [rango?.desde, rango?.hasta]).datos;
  const avisos = useMemo(() => (equipo && lista.datos ? avisosDeChoque(lista.datos.datos, equipo.eventos) : undefined), [equipo, lista.datos]);

  function alCambiar(mensaje: string) {
    setAbierta(null);
    setAviso(mensaje);
    lista.recargar();
  }

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Bandeja de solicitudes</h1>
          <p>Las solicitudes del personal a su cargo. Al abrir una verá el saldo de la persona y quién más estará fuera esos días.</p>
        </div>
        <div className="acc">
          <Link className="btn btn-secundario" to="/calendario?alcance=equipo" data-ayuda="Ver en el calendario quién de su equipo está fuera y cuándo">
            <Icono nombre="calendario" /> Calendario del equipo
          </Link>
          <Link className="btn btn-secundario" to="/registrar-solicitud" data-ayuda="Registrar vacaciones o un permiso a nombre de alguien de su equipo">
            <Icono nombre="personaMas" /> Para alguien del equipo
          </Link>
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}

      <div className="barra-lista">
        <div className="filtros" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button key={f.valor} type="button" className="filtro" aria-pressed={estado === f.valor} onClick={() => cambiar({ estado: f.valor === 'pendiente' ? '' : f.valor })} data-ayuda={`Ver las solicitudes ${f.texto.toLowerCase()}`}>
              {f.texto}
              {f.valor === 'pendiente' && estado === 'pendiente' && lista.datos ? ` (${lista.datos.total})` : ''}
            </button>
          ))}
        </div>
        <ElegirForma forma={forma} alCambiar={setForma} />
      </div>

      <div className="bloque-lista">
        {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
        {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
        {lista.datos && lista.datos.datos.length === 0 && (
          <div className="vacio">
            <Icono nombre="exito" tamano={30} />
            <h3>{estado === 'pendiente' ? 'No tiene solicitudes por resolver' : 'No hay solicitudes con ese estado'}</h3>
            <p>{estado === 'pendiente' ? 'Cuando alguien de su equipo pida vacaciones o un permiso, aparecerá aquí.' : 'Pruebe con otro filtro.'}</p>
          </div>
        )}
        {lista.datos && lista.datos.datos.length > 0 && (
          <>
            <ListaDeSolicitudes solicitudes={lista.datos.datos} mostrarPersona marcarNuevas alAbrir={setAbierta} avisos={avisos} forma={forma} />
            <Paginacion resultado={lista.datos} nombre={['solicitud', 'solicitudes']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
          </>
        )}
      </div>

      {abierta && <DetalleDeSolicitud solicitud={abierta} modo="jefatura" alCerrar={() => { setAbierta(null); lista.recargar(); }} alCambiar={alCambiar} />}
    </section>
  );
}
