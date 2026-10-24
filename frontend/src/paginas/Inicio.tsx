/*
 * Pagina de inicio.
 *
 *   - Saludo con el nombre de la persona.
 *   - Si le faltan datos personales (nacimiento, telefono...), un aviso con
 *     el enlace a Mi cuenta para completarlos.
 *   - Para quien ve funcionarios o usuarios, un resumen con cifras que
 *     llevan a la lista ya filtrada (p. ej. las cuentas bloqueadas).
 *   - Paneles (rediseno del 12/10, pedido de Josthyn: "mas estetica, sin
 *     saturar ni cargar mas la BD"):
 *       * Mis vacaciones: anillo del saldo y las proximas 3 ausencias.
 *       * Fuera esta semana (jefatura: su equipo; RRHH: todo el personal):
 *         lunes a viernes con las iniciales de quien no esta.
 *       * Ausencias del mes por tipo (solo RRHH), en barras.
 *     Todo sale de consultas que ya existian: el saldo y el calendario
 *     (como mucho dos llamadas: el propio y el del equipo/todos). Los
 *     graficos son HTML y CSS, sin librerias.
 *   - Accesos directos compactos, agrupados como el menu lateral (MENU +
 *     puedeVerOpcion). La descripcion queda en la ayuda emergente. Al
 *     agregar una pagina al menu aparece aqui sola.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { consultarFuncionarios } from '../api/funcionarios';
import { consultarMiCuenta } from '../api/miCuenta';
import {
  consultarBandeja,
  consultarCalendario,
  consultarMiSaldo,
  type AlcanceDeCalendario,
  type CalendarioDeSolicitudes,
  type ResumenDeSaldo,
  type SolicitudDeLista,
} from '../api/vacaciones';
import { consultarCuentas } from '../api/usuarios';
import { Icono } from '../componentes/Icono';
import { Mensaje } from '../componentes/Mensaje';
import { MENU, puedeVerOpcion, textoDeOpcion } from '../diseno/menu';
import { useSesion } from '../sesion/SesionProveedor';
import {
  anioDe,
  diaDelMes,
  esFinDeSemana,
  fechasDelRango,
  hoyEnCostaRica,
  mesDe,
  nombreDelMes,
  NOMBRES_DE_DIAS_CORTOS,
  posicionEnSemana,
  primeroDelMes,
  sumarDias,
  textoDeRango,
  ultimoDelMes,
} from '../utilidades/calendario';
import { useConsulta } from '../utilidades/useConsulta';
import { Anillo } from './vacaciones/SaldoDeVacaciones';

/** "Buenos dias" / "Buenas tardes" / "Buenas noches" segun la hora de Costa Rica. */
function saludo(): string {
  const hora = Number(new Intl.DateTimeFormat('es-CR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Costa_Rica' }).format(new Date()));
  return hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
}

/** Tono de cada grupo del menu en los accesos directos (colores del tema: funcionan en modo oscuro). */
const TONO_DE_GRUPO: Record<string, [string, string]> = {
  'Vacaciones y permisos': ['var(--accion-tinte)', 'var(--accion-sobre-claro)'],
  Personal: ['var(--info-bg)', 'var(--info-fg)'],
  Seguridad: ['var(--advert-bg)', 'var(--advert-fg)'],
  Catálogos: ['var(--neutro-bg)', 'var(--neutro-fg)'],
  'Mi acceso': ['var(--exito-bg)', 'var(--exito-fg)'],
};

/** Cuantos dias hacia adelante se buscan las proximas ausencias propias. */
const DIAS_HACIA_ADELANTE = 180;

export function Inicio() {
  const { usuario, tienePermisos } = useSesion();
  const tieneFuncionario = Boolean(usuario?.funcionarioId);
  const perfil = useConsulta(tieneFuncionario ? consultarMiCuenta : null, [tieneFuncionario]).datos;
  if (!usuario) return null;

  const f = perfil?.funcionario;
  const grupos = MENU.filter((g) => !g.sinTitulo)
    .map((g) => ({
      titulo: g.titulo,
      opciones: g.opciones.filter((o) => puedeVerOpcion(o, tienePermisos, tieneFuncionario)).map((o) => ({ ...o, ...textoDeOpcion(o, tienePermisos) })),
    }))
    .filter((g) => g.opciones.length > 0);
  // Datos personales que conviene tener (el correo personal ya es obligatorio).
  const faltan = f
    ? [
        !f.fechaNacimiento && 'fecha de nacimiento',
        !f.telefonoPersonal && 'teléfono',
        !f.direccion && 'dirección',
        !f.profesion && 'profesión',
      ].filter((x): x is string => Boolean(x))
    : [];

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>
            {saludo()}
            {f ? `, ${f.nombre}` : ''}
          </h1>
          <p>Cobro y gestión de personal de las piscinas municipales de Palmares.</p>
        </div>
      </div>

      {perfil?.puedeEditarDatos && faltan.length > 0 && (
        <Mensaje tipo="info">
          A su perfil le falta: {faltan.join(', ')}. <Link to="/mi-cuenta">Complételo en Mi cuenta</Link> (así Recursos Humanos
          tiene sus datos al día).
        </Mensaje>
      )}

      <Resumen />
      <Paneles />

      <h2 className="inicio-titulo">Accesos directos</h2>
      <div className="inicio-grupos">
        {grupos.map((g) => (
          <div className="inicio-grupo" key={g.titulo} style={{ '--tono-bg': TONO_DE_GRUPO[g.titulo]?.[0], '--tono-fg': TONO_DE_GRUPO[g.titulo]?.[1] } as CSSProperties}>
            <h3>{g.titulo}</h3>
            <div className="inicio-rejilla">
              {g.opciones.map((opcion) => (
                <Link className="inicio-tarjeta" to={opcion.ruta} key={opcion.ruta} data-ayuda={opcion.descripcion}>
                  <span className="ico-grande">
                    <Icono nombre={opcion.icono} tamano={18} />
                  </span>
                  <b>{opcion.texto}</b>
                  {opcion.descripcion && <span className="sr">{opcion.descripcion}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Cifras: cada una lleva a la lista ya filtrada. Solo se piden las que la
 * cuenta puede ver (tamano 1: solo interesa el total).
 */
function Resumen() {
  const { tienePermisos } = useSesion();
  const verFuncionarios = tienePermisos('funcionarios.ver');
  const verUsuarios = tienePermisos('usuarios.ver');
  const editarFuncionarios = tienePermisos('funcionarios.editar');
  const activos = useConsulta(verFuncionarios ? () => consultarFuncionarios({ estado: 'activo', tamano: 1 }) : null, []).datos;
  const bloqueadas = useConsulta(verUsuarios ? () => consultarCuentas({ estado: 'bloqueado', tamano: 1 }) : null, []).datos;
  const inactivas = useConsulta(verUsuarios ? () => consultarCuentas({ estado: 'inactivo', tamano: 1 }) : null, []).datos;
  // Personal cuya jefatura salio o dejo de ser Aprobadora (decision del 30/09).
  const porRevisar = useConsulta(editarFuncionarios ? () => consultarFuncionarios({ jefatura: 'revisar', tamano: 1 }) : null, []).datos;
  const porResolver = useConsulta(tienePermisos('solicitudes.aprobar') ? () => consultarBandeja({ estado: 'pendiente', tamano: 1 }) : null, []).datos;

  const cifras = [
    porResolver && { valor: porResolver.total, texto: 'solicitudes por resolver', a: '/bandeja', ayuda: 'Solicitudes de su equipo que esperan su respuesta' },
    verFuncionarios &&
      (tienePermisos('funcionarios.verTodos')
        ? { valor: activos?.total, texto: 'funcionarios activos', a: '/funcionarios?estado=activo', ayuda: 'Ver la lista de funcionarios activos' }
        : { valor: activos?.total, texto: 'personas a su cargo', a: '/funcionarios?estado=activo', ayuda: 'Ver a su personal a cargo' }),
    verUsuarios && {
      valor: bloqueadas?.total,
      texto: 'cuentas bloqueadas',
      a: '/usuarios?estado=bloqueado',
      ayuda: 'Cuentas bloqueadas por intentos fallidos o por Recursos Humanos',
    },
    verUsuarios && { valor: inactivas?.total, texto: 'cuentas inactivas', a: '/usuarios?estado=inactivo', ayuda: 'Cuentas sin acceso (por ejemplo, por salida)' },
    editarFuncionarios && {
      valor: porRevisar?.total,
      texto: 'necesitan nueva jefatura',
      a: '/funcionarios?jefatura=revisar',
      ayuda: 'Personas cuya jefatura salió o dejó de ser Aprobadora: asígneles otra',
    },
  ].filter((c): c is { valor: number | undefined; texto: string; a: string; ayuda: string } => Boolean(c));
  if (cifras.length === 0) return null;

  return (
    <div className="inicio-cifras">
      {cifras.map((c) => (
        <Link className="inicio-cifra" to={c.a} key={c.a} data-ayuda={c.ayuda} data-atencion={c.valor && c.valor > 0 && /bloqueadas|jefatura|resolver/.test(c.texto) ? 'si' : undefined}>
          <b className="num">{c.valor ?? '…'}</b>
          <span>{c.texto}</span>
        </Link>
      ))}
    </div>
  );
}

/* ====================================================================== */
/* Paneles                                                                 */
/* ====================================================================== */

/** Cuenta para la ausencia: aprobada o incapacidad (las pendientes aun no son seguras). */
const esAusenciaFirme = (e: SolicitudDeLista) => e.estado === 'aprobada';
const seMuestra = (e: SolicitudDeLista) => e.estado === 'aprobada' || e.estado === 'pendiente';

function Paneles() {
  const { usuario, tienePermisos } = useSesion();
  const hoy = hoyEnCostaRica();
  const tieneFuncionario = Boolean(usuario?.funcionarioId);
  const alcance: AlcanceDeCalendario | null = tienePermisos('solicitudes.administrar') ? 'todos' : tienePermisos('solicitudes.aprobar') && tieneFuncionario ? 'equipo' : null;

  // Semana actual (lunes a viernes) y mes actual: un solo rango para el calendario.
  const lunes = sumarDias(hoy, -posicionEnSemana(hoy));
  const viernes = sumarDias(lunes, 4);
  const inicioMes = primeroDelMes(anioDe(hoy), mesDe(hoy));
  const finMes = ultimoDelMes(anioDe(hoy), mesDe(hoy));
  const desde = lunes < inicioMes ? lunes : inicioMes;
  const hasta = viernes > finMes ? viernes : finMes;

  const saldo = useConsulta(tieneFuncionario ? consultarMiSaldo : null, [tieneFuncionario]).datos;
  const propio = useConsulta(tieneFuncionario ? () => consultarCalendario(hoy, sumarDias(hoy, DIAS_HACIA_ADELANTE), 'propio') : null, [tieneFuncionario, hoy]).datos;
  const general = useConsulta(alcance ? () => consultarCalendario(desde, hasta, alcance) : null, [alcance, desde, hasta]).datos;

  if (!tieneFuncionario && !alcance) return null;
  return (
    <div className="inicio-paneles">
      {tieneFuncionario && <MisVacaciones saldo={saldo} propio={propio} />}
      {alcance && <FueraEstaSemana datos={general} lunes={lunes} hoy={hoy} alcance={alcance} />}
      {alcance === 'todos' && <AusenciasDelMes datos={general} inicio={inicioMes} fin={finMes} />}
    </div>
  );
}

function Panel({ titulo, enlace, children, clase }: { titulo: string; enlace?: { a: string; texto: string; ayuda: string }; children: ReactNode; clase?: string }) {
  return (
    <article className={`inicio-panel ${clase ?? ''}`}>
      <header>
        <h2>{titulo}</h2>
        {enlace && (
          <Link to={enlace.a} className="btn-texto" data-ayuda={enlace.ayuda}>
            {enlace.texto}
          </Link>
        )}
      </header>
      {children}
    </article>
  );
}

function MisVacaciones({ saldo, propio }: { saldo: ResumenDeSaldo | null | undefined; propio: CalendarioDeSolicitudes | null | undefined }) {
  const proximas = (propio?.eventos ?? []).filter(seMuestra).slice(0, 3);
  return (
    <Panel titulo="Mis vacaciones" clase="panel-mias" enlace={{ a: '/mis-ausencias', texto: 'Ver todo', ayuda: 'Su saldo, sus solicitudes y sus incapacidades' }}>
      <div className="mias-cuerpo">
        {saldo === undefined || saldo === null ? (
          <div className="anillo anillo-chico anillo-cargando" aria-hidden="true" />
        ) : saldo.saldoCargado ? (
          <Anillo libre={saldo.disponible} tope={saldo.regimen.topeEnDias ?? Math.max(saldo.disponible, 1)} chico />
        ) : (
          <p className="ayuda-detalle mias-sin-saldo">Recursos Humanos aún no ha cargado su saldo.</p>
        )}
        <div className="mias-proximas">
          <h3>Próximas ausencias</h3>
          {!propio ? (
            <p className="ayuda-detalle">Cargando…</p>
          ) : proximas.length === 0 ? (
            <p className="ayuda-detalle">No tiene ausencias en los próximos meses.</p>
          ) : (
            <ul>
              {proximas.map((e) => (
                <li key={e.id}>
                  <span className="punto-tipo" style={{ background: e.tipo.color ?? 'var(--accion)' }} aria-hidden="true" />
                  <span>
                    <b>{e.tipo.nombre}</b>
                    <small>{textoDeRango(e.fechaInicio, e.fechaFin)}</small>
                  </span>
                  {e.estado === 'pendiente' && <span className="chip chip-advert">Pendiente</span>}
                </li>
              ))}
            </ul>
          )}
          {saldo?.saldoCargado && saldo.reservado > 0 && (
            <p className="ayuda-detalle">
              {saldo.reservado === 1 ? '1 día reservado' : `${saldo.reservado} días reservados`} en solicitudes pendientes.
            </p>
          )}
        </div>
      </div>
      <Link to="/mis-ausencias/nueva" className="btn btn-primario btn-chico mias-pedir">
        <Icono nombre="mas" /> Pedir vacaciones o permiso
      </Link>
    </Panel>
  );
}

/** Iniciales de un nombre ("Ana Mora Solís" -> "AM"). */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

const MAXIMO_POR_DIA = 5;

function FueraEstaSemana({ datos, lunes, hoy, alcance }: { datos: CalendarioDeSolicitudes | null | undefined; lunes: string; hoy: string; alcance: AlcanceDeCalendario }) {
  const dias = useMemo(() => fechasDelRango(lunes, sumarDias(lunes, 4)), [lunes]);
  const feriados = useMemo(() => new Map((datos?.feriados ?? []).map((f) => [f.fecha, f.nombre])), [datos]);
  const porDia = useMemo(
    () =>
      dias.map((dia) => {
        const vistos = new Set<string>();
        return (datos?.eventos ?? []).filter((e) => {
          if (!esAusenciaFirme(e) || e.fechaInicio > dia || e.fechaFin < dia || vistos.has(e.funcionario.id)) return false;
          vistos.add(e.funcionario.id);
          return true;
        });
      }),
    [datos, dias],
  );
  const total = new Set(porDia.flat().map((e) => e.funcionario.id)).size;

  return (
    <Panel
      titulo={alcance === 'todos' ? 'Fuera esta semana' : 'Su equipo esta semana'}
      clase="panel-semana"
      enlace={{ a: `/calendario?alcance=${alcance}`, texto: 'Calendario', ayuda: 'Abrir el calendario con todos los detalles' }}
    >
      <p className="ayuda-detalle panel-sub">
        {!datos ? 'Cargando…' : total === 0 ? 'Nadie tiene ausencias aprobadas esta semana.' : `${total === 1 ? '1 persona' : `${total} personas`} con vacaciones, permiso o incapacidad.`}
      </p>
      <ol className="semana-tira">
        {dias.map((dia, i) => {
          const gente = porDia[i];
          const feriado = feriados.get(dia);
          return (
            <li key={dia} data-hoy={dia === hoy ? 'si' : undefined} data-pasado={dia < hoy ? 'si' : undefined}>
              <span className="semana-dia">
                {NOMBRES_DE_DIAS_CORTOS[i]} <b>{diaDelMes(dia)}</b>
              </span>
              {feriado ? (
                <span className="semana-feriado" data-ayuda={feriado}>
                  Feriado
                </span>
              ) : (
                <span className="semana-gente">
                  {gente.slice(0, MAXIMO_POR_DIA).map((e) => (
                    <span
                      key={e.funcionario.id}
                      className="semana-persona"
                      style={{ background: e.tipo.color ?? 'var(--accion)' }}
                      data-ayuda={`${e.funcionario.nombre}: ${e.tipo.nombre}`}
                      aria-label={`${e.funcionario.nombre}: ${e.tipo.nombre}`}
                      role="img"
                    >
                      {iniciales(e.funcionario.nombre)}
                    </span>
                  ))}
                  {gente.length > MAXIMO_POR_DIA && (
                    <span className="semana-persona semana-mas" data-ayuda={gente.slice(MAXIMO_POR_DIA).map((e) => e.funcionario.nombre).join(', ')}>
                      +{gente.length - MAXIMO_POR_DIA}
                    </span>
                  )}
                  {datos && gente.length === 0 && !esFinDeSemana(dia) && <span className="semana-nadie">—</span>}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Dias habiles (sin fines de semana ni feriados) de una ausencia dentro del mes. */
function diasHabilesEnMes(e: SolicitudDeLista, inicio: string, fin: string, feriados: Set<string>): number {
  const desde = e.fechaInicio > inicio ? e.fechaInicio : inicio;
  const hasta = e.fechaFin < fin ? e.fechaFin : fin;
  if (desde > hasta) return 0;
  return fechasDelRango(desde, hasta).filter((d) => !esFinDeSemana(d) && !feriados.has(d)).length;
}

function AusenciasDelMes({ datos, inicio, fin }: { datos: CalendarioDeSolicitudes | null | undefined; inicio: string; fin: string }) {
  const barras = useMemo(() => {
    const feriados = new Set((datos?.feriados ?? []).map((f) => f.fecha));
    const porTipo = new Map<string, { nombre: string; color: string; dias: number }>();
    for (const e of datos?.eventos ?? []) {
      if (!esAusenciaFirme(e)) continue;
      const n = diasHabilesEnMes(e, inicio, fin, feriados);
      if (n === 0) continue;
      const fila = porTipo.get(e.tipo.id) ?? { nombre: e.tipo.nombre, color: e.tipo.color ?? 'var(--accion)', dias: 0 };
      fila.dias += n;
      porTipo.set(e.tipo.id, fila);
    }
    return [...porTipo.values()].sort((a, b) => b.dias - a.dias);
  }, [datos, inicio, fin]);
  const mayor = Math.max(1, ...barras.map((b) => b.dias));
  const total = barras.reduce((s, b) => s + b.dias, 0);
  const mes = nombreDelMes(mesDe(inicio));

  return (
    <Panel
      titulo={`Ausencias de ${mes}`}
      clase="panel-mes"
      enlace={{ a: `/calendario?alcance=todos&mes=${inicio.slice(0, 7)}`, texto: 'Ver el mes', ayuda: 'Abrir el calendario de todo el personal en este mes' }}
    >
      <p className="ayuda-detalle panel-sub">
        {!datos ? 'Cargando…' : total === 0 ? 'Sin ausencias aprobadas este mes.' : `${total} ${total === 1 ? 'día hábil' : 'días hábiles'} en total, aprobados o por incapacidad.`}
      </p>
      {barras.length > 0 && (
        <ul className="barras" aria-label={`Días hábiles de ausencia en ${mes}, por tipo`}>
          {barras.map((b) => (
            <li key={b.nombre}>
              <span className="barra-nombre" data-ayuda={b.nombre}>{b.nombre}</span>
              <span className="barra-pista">
                <span className="barra-relleno" style={{ width: `${(b.dias / mayor) * 100}%`, background: b.color }} />
              </span>
              <b className="barra-valor">{b.dias}</b>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
