/*
 * Calendario inteligente (/calendario).
 *
 * Una sola pantalla para ver quien esta fuera y cuando: vacaciones, permisos
 * y, mas adelante, incapacidades y capacitaciones. Segun los permisos de la
 * cuenta hay hasta tres alcances (T-3):
 *   - Mi calendario    (toda persona)
 *   - Mi equipo        (jefaturas: sus subordinados directos)
 *   - Todo el personal (Recursos Humanos)
 * y tres vistas que la persona elige (01/10: "que no maree"): "Mes" (barras
 * de color), "Por persona" (una fila por funcionario, para ver coincidencias
 * de un vistazo) y "Lista" (lo mas liviano: una fila por solicitud).
 * Filtros: estado (aprobadas y/o pendientes), persona, departamento (RRHH) y
 * la leyenda, que oculta tipos. "Mi equipo" incluye a la propia jefatura.
 * Con ?resaltar=<id> (boton "Ver en calendario") se resalta esa solicitud.
 *
 * El estado (alcance, vista y mes) vive en la URL, asi se puede compartir el
 * enlace o volver con "Atras" a lo mismo.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { consultarCalendario, consultarTiposDeSolicitud, type AlcanceDeCalendario, type SolicitudDeLista } from '../../api/vacaciones';
import { consultarOpcionesDeFuncionario } from '../../api/funcionarios';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { useSesion } from '../../sesion/SesionProveedor';
import { anioDe, hoyEnCostaRica, mesDe, moverMes, nombreDelMes, primeroDelMes, semanasDelMes, ultimoDelMes } from '../../utilidades/calendario';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useConsulta } from '../../utilidades/useConsulta';
import { useEsMovil } from '../../utilidades/useEsMovil';
import { DetalleDeSolicitud, PuntoDeTipo } from '../vacaciones/comunes';
import { PanelDelDia } from './PanelDelDia';
import { solicitudesDelDia } from './reparto';
import { VistaDeMes } from './VistaDeMes';
import { VistaPorPersona } from './VistaPorPersona';
import { VistaDeLista } from './VistaDeLista';

type Vista = 'mes' | 'persona' | 'lista';
type FiltroDeEstado = '' | 'aprobada' | 'pendiente';

const TEXTO_DE_ALCANCE: Record<AlcanceDeCalendario, string> = {
  propio: 'Mi calendario',
  equipo: 'Mi equipo',
  todos: 'Todo el personal',
};

/** "2026-10" -> { anio, mes } (si viene mal escrito, el mes actual). */
function mesDeLaUrl(texto: string | null, hoy: string): { anio: number; mes: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(texto ?? '');
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { anio: Number(m[1]), mes: Number(m[2]) - 1 };
  return { anio: anioDe(hoy), mes: mesDe(hoy) };
}
const textoDeMes = (anio: number, mes: number) => `${anio}-${String(mes + 1).padStart(2, '0')}`;

export function Calendario() {
  const { usuario, tienePermisos } = useSesion();
  const esMovil = useEsMovil();
  const hoy = hoyEnCostaRica();
  const [parametros, cambiar] = useParametrosEnUrl();

  // Alcances permitidos y el de inicio (el mas amplio que la cuenta puede ver).
  const alcances: AlcanceDeCalendario[] = [
    ...(usuario?.funcionarioId ? (['propio'] as const) : []),
    ...(tienePermisos('solicitudes.aprobar') ? (['equipo'] as const) : []),
    ...(tienePermisos('solicitudes.administrar') ? (['todos'] as const) : []),
  ];
  const alcanceDeInicio = alcances.includes('todos') ? 'todos' : alcances.includes('equipo') ? 'equipo' : 'propio';
  const pedido = parametros.get('alcance') as AlcanceDeCalendario | null;
  const alcance: AlcanceDeCalendario = pedido && alcances.includes(pedido) ? pedido : alcanceDeInicio;
  const pedidaLaVista = parametros.get('vista');
  const vista: Vista = pedidaLaVista === 'lista' ? 'lista' : alcance !== 'propio' && pedidaLaVista === 'persona' ? 'persona' : 'mes';
  const filtroDeEstado = (['aprobada', 'pendiente'].includes(parametros.get('estado') ?? '') ? parametros.get('estado') : '') as FiltroDeEstado;
  const quien = parametros.get('persona') ?? '';
  const resaltar = parametros.get('resaltar');
  const { anio, mes } = mesDeLaUrl(parametros.get('mes'), hoy);
  const departamentoId = alcance === 'todos' ? (parametros.get('departamento') ?? '') : '';

  const semanas = useMemo(() => semanasDelMes(anio, mes), [anio, mes]);
  const desde = semanas[0][0];
  const hasta = semanas[semanas.length - 1][6];

  const datos = useConsulta(alcances.length ? () => consultarCalendario(desde, hasta, alcance, departamentoId || undefined) : null, [desde, hasta, alcance, departamentoId]);
  const tipos = useConsulta(consultarTiposDeSolicitud, []).datos ?? [];
  const departamentos = useConsulta(alcance === 'todos' && tienePermisos('funcionarios.ver') ? consultarOpcionesDeFuncionario : null, [alcance]).datos?.departamentos ?? [];

  // Tipos que se ocultaron tocando la leyenda.
  const [ocultos, setOcultos] = useState<string[]>([]);
  const solicitudes = useMemo(
    () => {
      const palabras = quien.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
      return (datos.datos?.eventos ?? []).filter((s) => {
        if (s.estado === 'rechazada' || s.estado === 'cancelada' || ocultos.includes(s.tipo.id)) return false;
        if (filtroDeEstado && s.estado !== filtroDeEstado) return false;
        if (palabras.length) {
          const nombre = s.funcionario.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (!palabras.every((p) => nombre.includes(p))) return false;
        }
        return true;
      });
    },
    [datos.datos, ocultos, filtroDeEstado, quien],
  );
  const feriados = useMemo(() => new Map((datos.datos?.feriados ?? []).map((f) => [f.fecha, f.nombre])), [datos.datos]);

  // Dia elegido: en celular siempre hay uno (hoy, o el primero del mes); en escritorio solo al tocar.
  const [elegido, setElegido] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<SolicitudDeLista | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // En celular, al llegar con una solicitud resaltada se muestra el dia en que empieza.
  const solicitudResaltada = resaltar ? (datos.datos?.eventos ?? []).find((s) => s.id === resaltar) : undefined;
  const diaDeInicio = esMovil && vista === 'mes' ? (solicitudResaltada && solicitudResaltada.fechaInicio.slice(0, 7) === textoDeMes(anio, mes) ? solicitudResaltada.fechaInicio : anioDe(hoy) === anio && mesDe(hoy) === mes ? hoy : primeroDelMes(anio, mes)) : null;
  const diaVisible = elegido ?? diaDeInicio;
  // La barra resaltada se trae a la vista (en la vista por persona puede quedar fuera, de lado).
  useEffect(() => {
    if (!resaltar || !datos.datos) return;
    const espera = window.setTimeout(() => document.querySelector('[data-resaltada="si"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }), 200);
    return () => window.clearTimeout(espera);
  }, [resaltar, datos.datos, vista]);

  function irAlMes(n: number) {
    const nuevo = moverMes(anio, mes, n);
    setElegido(null);
    cambiar({ mes: textoDeMes(nuevo.anio, nuevo.mes), resaltar: '' });
  }
  function irAHoy() {
    setElegido(null);
    cambiar({ mes: '', resaltar: '' });
  }
  const modoPara = (s: SolicitudDeLista): 'propia' | 'jefatura' | 'rrhh' =>
    s.aprobador?.id === usuario?.id && s.estado === 'pendiente' && s.funcionario.id !== usuario?.funcionarioId
      ? 'jefatura'
      : s.funcionario.id === usuario?.funcionarioId
        ? 'propia'
        : 'rrhh';

  const mostrarPersona = alcance !== 'propio';
  const panel = diaVisible && (
    <PanelDelDia
      fecha={diaVisible}
      solicitudes={solicitudesDelDia(diaVisible, solicitudes)}
      feriado={feriados.get(diaVisible)}
      mostrarPersona={mostrarPersona}
      alAbrir={(s) => {
        setElegido(null);
        setAbierta(s);
      }}
    />
  );

  if (alcances.length === 0) {
    return (
      <section className="pagina">
        <div className="pagina-cab">
          <h1>Calendario</h1>
        </div>
        <Mensaje tipo="info">Su cuenta no está ligada a un funcionario, por eso no tiene calendario propio.</Mensaje>
      </section>
    );
  }

  return (
    <section className="pagina pagina-calendario">
      <div className="pagina-cab">
        <div>
          <h1>Calendario</h1>
          <p>Vacaciones y permisos de un vistazo. Toque un día o una barra para ver el detalle.</p>
        </div>
        <div className="acc acc-principal">
          {usuario?.funcionarioId && (
            <Link className="btn btn-primario" to="/mis-vacaciones/nueva" data-ayuda="Pedir vacaciones o un permiso">
              <Icono nombre="mas" /> Solicitar
            </Link>
          )}
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}

      <div className="cal-controles">
        {alcances.length > 1 && (
          <div className="segmentado" role="group" aria-label="Qué calendario ver">
            {alcances.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={alcance === a}
                data-ayuda={a === 'propio' ? 'Solo sus solicitudes' : a === 'equipo' ? 'Usted y el personal a su cargo' : 'Todo el personal de la Municipalidad'}
                onClick={() => { setElegido(null); cambiar({ alcance: a, vista: a === 'propio' && pedidaLaVista === 'persona' ? '' : pedidaLaVista ?? '', departamento: '', persona: '', resaltar: '' }); }}
              >
                {TEXTO_DE_ALCANCE[a]}
              </button>
            ))}
          </div>
        )}

        <div className="cal-mes-nav">
          <button type="button" className="icono-btn" onClick={() => irAlMes(-1)} aria-label="Mes anterior" data-ayuda="Mes anterior">
            <Icono nombre="plegar" />
          </button>
          <h2 aria-live="polite">
            {nombreDelMes(mes)} <span>{anio}</span>
          </h2>
          <button type="button" className="icono-btn" onClick={() => irAlMes(1)} aria-label="Mes siguiente" data-ayuda="Mes siguiente">
            <Icono nombre="siguiente" />
          </button>
          <button type="button" className="btn btn-secundario btn-chico" onClick={irAHoy} data-ayuda="Volver al mes actual">
            Hoy
          </button>
        </div>

        <div className="cal-opciones">
          <div className="segmentado segmentado-chico" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vista === 'mes'} onClick={() => cambiar({ vista: '' })} data-ayuda="El mes en cuadrícula, con una barra por solicitud">
              Mes
            </button>
            {alcance !== 'propio' && (
              <button type="button" aria-pressed={vista === 'persona'} onClick={() => { setElegido(null); cambiar({ vista: 'persona' }); }} data-ayuda="Una fila por persona: se ve de un vistazo quién coincide con quién">
                Por persona
              </button>
            )}
            <button type="button" aria-pressed={vista === 'lista'} onClick={() => { setElegido(null); cambiar({ vista: 'lista' }); }} data-ayuda="Lo más liviano: una fila por solicitud, por semana">
              Lista
            </button>
          </div>
        </div>
      </div>

      <div className="cal-filtros">
        <label className="filtro-select">
          <span className="sr">Estado</span>
          <select value={filtroDeEstado} onChange={(e) => cambiar({ estado: e.target.value })} aria-label="Mostrar aprobadas, pendientes o ambas">
            <option value="">Aprobadas y pendientes</option>
            <option value="aprobada">Solo aprobadas</option>
            <option value="pendiente">Solo pendientes</option>
          </select>
        </label>
        {alcance !== 'propio' && (
          <div className="buscador buscador-chico">
            <Icono nombre="buscar" />
            <input type="search" value={quien} onChange={(e) => cambiar({ persona: e.target.value })} placeholder="Buscar persona" aria-label="Mostrar solo a las personas cuyo nombre contenga" />
          </div>
        )}
        {departamentos.length > 0 && (
          <label className="filtro-select">
            <span className="sr">Departamento</span>
            <select aria-label="Filtrar por departamento" value={departamentoId} onChange={(e) => cambiar({ departamento: e.target.value })}>
              <option value="">Todos los departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {(filtroDeEstado || quien || departamentoId || ocultos.length > 0) && (
          <button type="button" className="btn-texto" onClick={() => { setOcultos([]); cambiar({ estado: '', persona: '', departamento: '' }); }} data-ayuda="Mostrar todo otra vez">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="cal-leyenda" role="group" aria-label="Tipos de solicitud (toque uno para ocultarlo)">
        {tipos.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={!ocultos.includes(t.id)}
            onClick={() => setOcultos((o) => (o.includes(t.id) ? o.filter((x) => x !== t.id) : [...o, t.id]))}
            data-ayuda={ocultos.includes(t.id) ? `Volver a mostrar: ${t.nombre}` : `Ocultar: ${t.nombre}`}
          >
            <PuntoDeTipo color={t.colorCalendario} /> {t.nombre}
          </button>
        ))}
        <span className="leyenda-pendiente">
          <i aria-hidden="true" /> Rayado = pendiente de aprobar
        </span>
      </div>

      {datos.error && <Mensaje tipo="error">{datos.error}</Mensaje>}
      {datos.datos?.truncado && <Mensaje tipo="advert">Hay tantas solicitudes en este mes que no se pueden mostrar todas. Filtre por departamento o por tipo.</Mensaje>}

      <div className="cal-cuerpo" data-cargando={datos.cargando ? 'si' : undefined}>
        {vista === 'mes' ? (
          <VistaDeMes
            anio={anio}
            mes={mes}
            solicitudes={solicitudes}
            feriados={feriados}
            hoy={hoy}
            diaElegido={diaVisible}
            esMovil={esMovil}
            mostrarPersona={mostrarPersona}
            alElegirDia={setElegido}
            alAbrir={setAbierta}
            resaltar={resaltar}
          />
        ) : vista === 'persona' ? (
          <VistaPorPersona anio={anio} mes={mes} solicitudes={solicitudes} feriados={feriados} hoy={hoy} alElegirDia={setElegido} alAbrir={setAbierta} resaltar={resaltar} />
        ) : (
          <VistaDeLista primero={primeroDelMes(anio, mes)} ultimo={ultimoDelMes(anio, mes)} solicitudes={solicitudes} mostrarPersona={mostrarPersona} alAbrir={setAbierta} resaltar={resaltar} />
        )}
      </div>

      {/* Celular: la lista del dia va debajo del mes. Escritorio: en una ventana. */}
      {esMovil && vista === 'mes' && diaVisible && <div className="cal-dia-movil">{panel}</div>}
      {!(esMovil && vista === 'mes') && elegido && (
        <Modal titulo="Ausencias del día" icono="calendario" alCerrar={() => setElegido(null)} textoCerrar="Cerrar">
          {panel}
        </Modal>
      )}

      {abierta && (
        <DetalleDeSolicitud
          solicitud={abierta}
          modo={modoPara(abierta)}
          alCerrar={() => setAbierta(null)}
          alCambiar={(mensaje) => {
            setAbierta(null);
            setAviso(mensaje);
            datos.recargar();
          }}
        />
      )}
    </section>
  );
}
