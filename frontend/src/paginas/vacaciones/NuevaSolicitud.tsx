/*
 * Nueva solicitud, por pasos (decision de Josthyn, 01/10: "por secciones,
 * sin scroll"). Dos entradas:
 *
 *   /mis-vacaciones/nueva    la propia:              Qué -> Cuándo -> Revisar
 *   /registrar-solicitud     a nombre de otra persona: Quién -> Qué -> Cuándo -> Revisar
 *                            (RRHH, de cualquiera; la jefatura, de su personal
 *                            a cargo: el backend decide y la lista ya viene filtrada)
 *
 * Es la funcion principal del sistema, asi que esta pensada primero para
 * celular: cada paso cabe en la pantalla, opciones grandes para tocar y una
 * barra fija abajo con "Atras" y "Siguiente". En pantalla ancha el resumen va
 * en una columna lateral.
 *
 * Mientras se eligen las fechas se llama a /solicitudes/calcular para mostrar
 * en vivo los dias habiles y el efecto en el saldo. Si algo falta o no es
 * valido, "Siguiente" o "Enviar" abren una ventana con la lista de problemas
 * (y un boton para ir al paso donde se corrige). El backend vuelve a validar
 * todo al enviar.
 *
 * Los dias de vacaciones se descuentan SOLO al aprobarse; los permisos y las
 * capacitaciones no descuentan nunca. Los textos lo dicen segun el tipo.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { consultarFuncionarios, type FuncionarioEnLista } from '../../api/funcionarios';
import {
  calcularSolicitud,
  consultarCalendario,
  consultarFeriados,
  consultarMiSaldo,
  consultarSaldoDe,
  consultarTiposDeSolicitud,
  crearSolicitud,
  type SolicitudDeLista,
  type TipoDeSolicitud,
  type VistaPrevia,
} from '../../api/vacaciones';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { ModalExito } from '../../componentes/ModalExito';
import { Paginacion } from '../../componentes/Paginacion';
import { Pasos } from '../../componentes/Pasos';
import { useSesion } from '../../sesion/SesionProveedor';
import { anioDe, fechaCorta, fechasDelRango, hoyEnCostaRica, mesDe, primeroDelMes, textoDeRango, ultimoDelMes } from '../../utilidades/calendario';
import { nombreCompleto } from '../../utilidades/texto';
import { useConsulta } from '../../utilidades/useConsulta';
import { Avatar, PuntoDeTipo } from './comunes';
import { SelectorDeRango } from './SelectorDeRango';

const ESPERA_DE_VISTA_PREVIA_MS = 350;

type ClaveDePaso = 'persona' | 'tipo' | 'fechas' | 'revisar';
const PASOS: Record<ClaveDePaso, { titulo: string; sub: string }> = {
  persona: { titulo: '¿Para quién?', sub: 'La persona' },
  tipo: { titulo: '¿Qué necesita?', sub: 'Vacaciones o permiso' },
  fechas: { titulo: '¿Cuándo?', sub: 'Primer y último día' },
  revisar: { titulo: 'Revisar y enviar', sub: 'Resumen y motivo' },
};

interface Problema {
  texto: string;
  paso: ClaveDePaso;
}

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** Que pasa con el saldo segun el tipo (para no decir "se descuenta" de un permiso o una capacitacion). */
function textoDelTipo(t: TipoDeSolicitud): string {
  if (t.requiereJustificante) return 'Requiere adjuntar un justificante: muy pronto se podrá desde aquí.';
  if (t.descuentaVacaciones) return 'Se descuenta de las vacaciones cuando se aprueba.';
  return `${t.descripcion ? `${t.descripcion}. ` : ''}No descuenta vacaciones.`;
}

export function NuevaSolicitud({ paraOtraPersona = false }: { paraOtraPersona?: boolean }) {
  const { usuario, tienePermisos } = useSesion();
  const navegar = useNavigate();
  const volverA = paraOtraPersona ? (tienePermisos('solicitudes.administrar') ? '/solicitudes' : '/bandeja') : '/mis-vacaciones';
  const hoy = hoyEnCostaRica();
  const esRrhh = tienePermisos('solicitudes.administrar');

  const claves: ClaveDePaso[] = paraOtraPersona ? ['persona', 'tipo', 'fechas', 'revisar'] : ['tipo', 'fechas', 'revisar'];
  const [indice, setIndice] = useState(0);
  const paso = claves[indice];
  const tituloDelPaso = useRef<HTMLHeadingElement>(null);
  const pasoAnterior = useRef(indice);
  useEffect(() => {
    // Al CAMBIAR de paso, el foco va al titulo del paso nuevo (lo anuncia el lector de pantalla).
    if (pasoAnterior.current === indice) return;
    pasoAnterior.current = indice;
    tituloDelPaso.current?.focus();
  }, [indice]);

  const tipos = useConsulta(consultarTiposDeSolicitud, []);
  const [persona, setPersona] = useState<FuncionarioEnLista | null>(null);
  const [tipoId, setTipoId] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [motivo, setMotivo] = useState('');

  const tipo = tipos.datos?.find((t) => t.id === tipoId);
  const funcionarioId = paraOtraPersona ? persona?.id : (usuario?.funcionarioId ?? undefined);
  const nombreDeLaPersona = paraOtraPersona ? (persona ? nombreCompleto(persona) : null) : null;
  // Fechas pasadas: solo Recursos Humanos las puede registrar.
  const minimo = paraOtraPersona && esRrhh ? undefined : hoy;

  // Por omision, vacaciones.
  useEffect(() => {
    if (!tipoId && tipos.datos) setTipoId(tipos.datos.find((t) => t.clave === 'vacaciones')?.id ?? tipos.datos.find((t) => !t.requiereJustificante)?.id ?? '');
  }, [tipos.datos, tipoId]);

  /* --- Saldo de la persona (para mostrarlo mientras elige) --- */
  const saldo = useConsulta(
    funcionarioId ? () => (paraOtraPersona ? consultarSaldoDe(funcionarioId) : consultarMiSaldo()) : null,
    [funcionarioId, paraOtraPersona],
  ).datos;

  /* --- Feriados y dias ya pedidos del mes que se ve --- */
  const [mesVisto, setMesVisto] = useState({ anio: anioDe(hoy), mes: mesDe(hoy) });
  const feriadosDelAnio = useConsulta(() => consultarFeriados(mesVisto.anio), [mesVisto.anio]).datos;
  const feriadosVecinos = useConsulta(() => consultarFeriados(mesVisto.anio + (mesVisto.mes === 11 ? 1 : mesVisto.mes === 0 ? -1 : 0)), [mesVisto.anio, mesVisto.mes]).datos;
  const feriados = useMemo(() => new Map([...(feriadosDelAnio ?? []), ...(feriadosVecinos ?? [])].map((f) => [f.fecha, f.nombre])), [feriadosDelAnio, feriadosVecinos]);
  const alcanceDeOcupados = paraOtraPersona ? (esRrhh ? 'todos' : 'equipo') : 'propio';
  const pedidos = useConsulta(
    funcionarioId ? () => consultarCalendario(primeroDelMes(mesVisto.anio, mesVisto.mes), ultimoDelMes(mesVisto.anio, mesVisto.mes), alcanceDeOcupados) : null,
    [mesVisto.anio, mesVisto.mes, funcionarioId, alcanceDeOcupados],
  ).datos;
  const ocupados = useMemo(() => {
    const set = new Set<string>();
    for (const s of pedidos?.eventos ?? []) {
      if (s.funcionario.id === funcionarioId && (s.estado === 'pendiente' || s.estado === 'aprobada')) fechasDelRango(s.fechaInicio, s.fechaFin).forEach((f) => set.add(f));
    }
    return set;
  }, [pedidos, funcionarioId]);

  /* --- Vista previa en vivo --- */
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorDePrevia, setErrorDePrevia] = useState<string | null>(null);
  const turno = useRef(0);
  const fechasListas = Boolean(inicio && fin && fin >= inicio);
  useEffect(() => {
    if (!tipoId || !fechasListas || !funcionarioId) {
      setVista(null);
      setErrorDePrevia(null);
      return;
    }
    const miTurno = ++turno.current;
    setCalculando(true);
    const espera = window.setTimeout(() => {
      calcularSolicitud({ tipoSolicitudId: tipoId, fechaInicio: inicio, fechaFin: fin, funcionarioId: paraOtraPersona ? funcionarioId : undefined })
        .then((r) => {
          if (miTurno !== turno.current) return;
          setVista(r);
          setErrorDePrevia(null);
        })
        .catch((e: unknown) => miTurno === turno.current && (setVista(null), setErrorDePrevia(textoDelError(e))))
        .finally(() => miTurno === turno.current && setCalculando(false));
    }, ESPERA_DE_VISTA_PREVIA_MS);
    return () => window.clearTimeout(espera);
  }, [tipoId, inicio, fin, fechasListas, funcionarioId, paraOtraPersona]);

  /* --- Problemas de cada paso --- */
  function problemasDe(clave: ClaveDePaso): Problema[] {
    const lista: Problema[] = [];
    if (clave === 'persona' && paraOtraPersona && !persona) lista.push({ texto: 'Elija a la persona para quien es la solicitud.', paso: 'persona' });
    if (clave === 'persona' && !paraOtraPersona && !funcionarioId) lista.push({ texto: 'Su cuenta no está ligada a un funcionario: no puede hacer solicitudes propias.', paso: 'tipo' });
    if (clave === 'tipo') {
      if (!tipo) lista.push({ texto: 'Elija qué necesita (vacaciones, permiso...).', paso: 'tipo' });
      else if (tipo.requiereJustificante) lista.push({ texto: `${tipo.nombre} necesita un justificante, y eso todavía no se puede adjuntar aquí.`, paso: 'tipo' });
    }
    if (clave === 'fechas') {
      if (!fechasListas) lista.push({ texto: 'Elija en el calendario el primer y el último día.', paso: 'fechas' });
      else if (calculando) lista.push({ texto: 'Espere un momento: se están calculando los días.', paso: 'fechas' });
      else if (errorDePrevia) lista.push({ texto: errorDePrevia, paso: 'fechas' });
      else if (vista && !vista.valida) lista.push({ texto: vista.problema?.mensaje ?? 'Con esas fechas no se puede hacer la solicitud.', paso: 'fechas' });
    }
    return lista;
  }
  const todosLosProblemas = (): Problema[] => (['persona', 'tipo', 'fechas'] as ClaveDePaso[]).flatMap(problemasDe);

  const [problemas, setProblemas] = useState<Problema[] | null>(null);
  function irA(clave: ClaveDePaso) {
    const i = claves.indexOf(clave);
    if (i >= 0) setIndice(i);
  }
  function siguiente() {
    const encontrados = problemasDe(paso);
    if (encontrados.length) return setProblemas(encontrados);
    setIndice((i) => Math.min(i + 1, claves.length - 1));
  }
  function atras() {
    if (indice === 0) navegar(volverA);
    else setIndice((i) => i - 1);
  }

  /* --- Enviar --- */
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState<SolicitudDeLista | null>(null);
  async function enviar() {
    const encontrados = todosLosProblemas();
    if (encontrados.length) return setProblemas(encontrados);
    setEnviando(true);
    try {
      setCreada(
        await crearSolicitud({
          tipoSolicitudId: tipoId,
          fechaInicio: inicio,
          fechaFin: fin,
          motivo: motivo.trim() || undefined,
          funcionarioId: paraOtraPersona ? funcionarioId : undefined,
        }),
      );
    } catch (e) {
      setProblemas([{ texto: textoDelError(e), paso: 'revisar' }]);
    } finally {
      setEnviando(false);
    }
  }

  const excluidos = (vista?.desglose ?? []).filter((d) => d.tipo !== 'habil');
  const finesDeSemana = excluidos.filter((d) => d.tipo === 'finDeSemana').length;
  const diasFeriados = excluidos.filter((d) => d.tipo === 'feriado');
  const esUltimo = indice === claves.length - 1;
  const quienAprueba = vista?.laApruebaSuJefatura
    ? 'Usted, como su jefatura: queda aprobada al registrarla.'
    : vista?.autoaprobada
      ? 'Se aprueba automáticamente (no tiene una jefatura por encima).'
      : 'Su jefatura inmediata la revisará.';

  // Lo que quedaria DISPONIBLE si se aprueba esta (las otras pendientes no se restan: decision 01/10).
  const quedariaDisponible = saldo?.saldoCargado && vista?.diasHabiles !== undefined ? saldo.disponible - vista.diasHabiles : null;

  /** Efecto en el saldo, en palabras, segun el tipo. */
  function textoDelSaldo(): string | null {
    if (!tipo || !vista?.valida || vista.diasHabiles === undefined) return null;
    if (!tipo.descuentaVacaciones) return 'No se descuenta de las vacaciones.';
    if (!vista.saldo) return null;
    const cuando = vista.autoaprobada ? 'Al quedar aprobada' : 'Cuando se apruebe';
    return `${cuando} se descuentan ${dias(vista.diasHabiles)}: quedarán ${dias(quedariaDisponible ?? vista.saldo.quedaria)} disponibles.`;
  }

  /* ---------------- Resumen (columna lateral y paso "Revisar") ---------------- */
  const resumen = (
    <dl className="resumen-pasos">
      {paraOtraPersona && (
        <div>
          <dt>Para</dt>
          <dd>{persona ? nombreCompleto(persona) : <span className="falta">Sin elegir</span>}</dd>
        </div>
      )}
      <div>
        <dt>Tipo</dt>
        <dd>
          {tipo ? (
            <>
              <PuntoDeTipo color={tipo.colorCalendario} /> {tipo.nombre}
            </>
          ) : (
            <span className="falta">Sin elegir</span>
          )}
        </dd>
      </div>
      <div>
        <dt>Fechas</dt>
        <dd>{fechasListas ? textoDeRango(inicio, fin) : <span className="falta">Sin elegir</span>}</dd>
      </div>
      {fechasListas && (
        <div>
          <dt>Días hábiles</dt>
          <dd aria-live="polite">
            {calculando ? (
              'Calculando…'
            ) : vista?.diasHabiles !== undefined ? (
              <>
                <b className="resumen-numero">{vista.diasHabiles}</b>
                {(finesDeSemana > 0 || diasFeriados.length > 0) && (
                  <small>
                    {' '}
                    (no cuentan{finesDeSemana > 0 ? ` ${dias(finesDeSemana)} de fin de semana` : ''}
                    {finesDeSemana > 0 && diasFeriados.length > 0 ? ' ni' : ''}
                    {diasFeriados.length > 0 ? ` ${diasFeriados.map((d) => `${d.nombreFeriado} (${fechaCorta(d.fecha)})`).join(', ')}` : ''})
                  </small>
                )}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      )}
      {textoDelSaldo() && (
        <div>
          <dt>Saldo</dt>
          <dd>{textoDelSaldo()}</dd>
        </div>
      )}
      {vista?.valida && (
        <div>
          <dt>Aprobación</dt>
          <dd>{quienAprueba}</dd>
        </div>
      )}
      {fechasListas && !calculando && (errorDePrevia || (vista && !vista.valida)) && (
        <div className="resumen-problema" role="alert">
          {errorDePrevia ?? vista?.problema?.mensaje ?? 'Con esas fechas no se puede hacer la solicitud.'}
        </div>
      )}
    </dl>
  );

  /* ---------------- Contenido de cada paso ---------------- */
  let contenido: ReactNode = null;
  if (paso === 'persona') {
    contenido = (
      <ElegirPersona
        elegida={persona}
        soloSuEquipo={!esRrhh}
        alElegir={(f) => {
          setPersona(f);
          setInicio('');
          setFin('');
          setIndice((i) => i + 1);
        }}
      />
    );
  } else if (paso === 'tipo') {
    contenido = (
      <>
        {tipos.error && <Mensaje tipo="error">{tipos.error}</Mensaje>}
        <div className="tipos-solicitud" role="group" aria-label="Tipo de solicitud">
          {[...(tipos.datos ?? [])]
            .sort((a, b) => Number(b.clave === 'vacaciones') - Number(a.clave === 'vacaciones'))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                className="tipo-solicitud"
                aria-pressed={t.id === tipoId}
                aria-disabled={t.requiereJustificante || undefined}
                data-ayuda={t.requiereJustificante ? 'Todavía no se puede: requiere adjuntar un justificante' : `Elegir: ${t.nombre}`}
                onClick={() => !t.requiereJustificante && setTipoId(t.id)}
                onDoubleClick={() => !t.requiereJustificante && (setTipoId(t.id), setIndice((i) => i + 1))}
                style={{ ['--ev' as string]: t.colorCalendario ?? '#6b7780' }}
              >
                <PuntoDeTipo color={t.colorCalendario} />
                <b>{t.nombre}</b>
                <small>{textoDelTipo(t)}</small>
              </button>
            ))}
        </div>
      </>
    );
  } else if (paso === 'fechas') {
    contenido = (
      <div className="paso-fechas">
        <div className="paso-fechas-calendario">
          {tipo?.descuentaVacaciones && saldo?.saldoCargado && (
            <p className="chip-saldo">
              <Icono nombre="sombrilla" tamano={15} /> {nombreDeLaPersona ? `${nombreDeLaPersona.split(' ')[0]} tiene` : 'Tiene'} <b>{dias(saldo.disponible)}</b> disponibles
              {saldo.reservado > 0 ? ` (${saldo.reservado} en solicitudes pendientes)` : ''}
            </p>
          )}
          <SelectorDeRango
            inicio={inicio}
            fin={fin}
            alCambiar={(i, f) => {
              setInicio(i);
              setFin(f);
            }}
            feriados={feriados}
            ocupados={ocupados}
            minimo={minimo}
            hoy={hoy}
            alCambiarDeMes={(anio, mes) => setMesVisto({ anio, mes })}
          />
          <details className="fechas-a-mano">
            <summary data-ayuda="Escribir las fechas en lugar de tocarlas en el calendario">Prefiero escribir las fechas</summary>
            <div className="fechas-escritas">
              <div className="campo">
                <label htmlFor="fecha-inicio">Desde</label>
                <input id="fecha-inicio" type="date" value={inicio} min={minimo} onChange={(e) => { setInicio(e.target.value); if (!fin || fin < e.target.value) setFin(e.target.value); }} />
              </div>
              <div className="campo">
                <label htmlFor="fecha-fin">Hasta</label>
                <input id="fecha-fin" type="date" value={fin} min={inicio || minimo} onChange={(e) => setFin(e.target.value)} />
              </div>
            </div>
          </details>
        </div>
        {/* Celular: el resultado de las fechas, justo debajo del calendario. */}
        <div className="solo-celular resumen-fechas-celular" aria-live="polite">
          {!fechasListas ? (
            <span className="resumen-ayuda">Toque el primer día y luego el último.</span>
          ) : calculando ? (
            <span className="resumen-ayuda">Calculando…</span>
          ) : vista?.valida ? (
            <span>
              <b>{dias(vista.diasHabiles ?? 0)}</b> hábiles · {textoDeRango(inicio, fin)}
              {tipo && !tipo.descuentaVacaciones ? ' · no descuenta vacaciones' : vista.saldo ? ` · si se aprueba le quedan ${quedariaDisponible ?? vista.saldo.quedaria}` : ''}
            </span>
          ) : (
            <span className="problema">{errorDePrevia ?? vista?.problema?.mensaje}</span>
          )}
        </div>
      </div>
    );
  } else {
    contenido = (
      <div className="paso-revisar">
        <div className="card revisar-tarjeta solo-celular">{resumen}</div>
        <div className="campo">
          <label htmlFor="motivo-solicitud">
            Motivo <small className="opcional">(opcional)</small>
          </label>
          <textarea
            id="motivo-solicitud"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={paraOtraPersona ? 'Por ejemplo: lo coordinó por teléfono, incapacidad que llegó tarde…' : 'Si quiere, cuéntele a su jefatura el motivo.'}
          />
          <span className="ayuda">{motivo.length}/500</span>
        </div>
        {tipo?.descuentaVacaciones && !vista?.autoaprobada && (
          <p className="resumen-nota">
            <Icono nombre="info" tamano={15} /> Los días no se descuentan al enviar: solo se reservan, y se descuentan cuando la jefatura la aprueba. Si la rechaza o usted la cancela, no pierde nada.
          </p>
        )}
      </div>
    );
  }

  const textoSiguiente = esUltimo ? (enviando ? 'Enviando…' : paraOtraPersona ? 'Registrar solicitud' : 'Enviar solicitud') : 'Siguiente';
  const ayudaSiguiente = esUltimo ? 'Enviar la solicitud (antes se revisa que no falte nada)' : `Ir al paso siguiente: ${PASOS[claves[indice + 1]].titulo}`;
  const ayudaAtras = indice === 0 ? 'Salir sin enviar nada' : `Volver al paso anterior: ${PASOS[claves[indice - 1]].titulo}`;

  return (
    <section className="pagina pagina-solicitud">
      <div className="pagina-cab pagina-cab-compacta">
        <div>
          <h1>{paraOtraPersona ? 'Solicitud para otra persona' : 'Nueva solicitud'}</h1>
          <p className="solo-escritorio">
            {paraOtraPersona
              ? esRrhh
                ? 'Registre vacaciones o un permiso a nombre de cualquier funcionario. Primero elija la persona.'
                : 'Registre vacaciones o un permiso a nombre de una persona de su equipo. Queda aprobada al registrarla.'
              : 'En tres pasos: qué necesita, cuándo, y revisar. Verá al instante cuántos días hábiles son.'}
          </p>
        </div>
        {paraOtraPersona && persona && paso !== 'persona' && (
          <button type="button" className="chip-persona" onClick={() => irA('persona')} data-ayuda="Cambiar la persona">
            <Avatar nombre={nombreCompleto(persona)} tamano={24} /> {nombreCompleto(persona)}
          </button>
        )}
      </div>

      <div className="pagina-pasos">
        <Pasos
          pasos={claves.map((c) => PASOS[c])}
          actual={indice}
          etiqueta="Pasos de la solicitud"
          enPagina
          alElegir={(i) => {
            // Hacia atras siempre; hacia adelante solo si los pasos de por medio estan bien.
            if (i < indice) return setIndice(i);
            const pendientes = claves.slice(indice, i).flatMap(problemasDe);
            if (pendientes.length) setProblemas(pendientes);
            else setIndice(i);
          }}
        />
      </div>

      <div className="solicitud-columnas">
        <div className="card solicitud-paso">
          <h2 className="paso-titulo" ref={tituloDelPaso} tabIndex={-1}>
            {PASOS[paso].titulo}
          </h2>
          <div className="solicitud-paso-cuerpo">{contenido}</div>

          {/* Escritorio: los botones al pie del paso. */}
          <div className="solicitud-acciones solo-escritorio">
            <button type="button" className="btn btn-secundario" onClick={atras} data-ayuda={ayudaAtras}>
              {indice === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            {paso !== 'persona' && (
              <button type="button" className="btn btn-primario" aria-busy={enviando} onClick={() => void (esUltimo ? enviar() : siguiente())} data-ayuda={ayudaSiguiente}>
                {textoSiguiente} {!esUltimo && <Icono nombre="siguiente" />}
              </button>
            )}
          </div>
        </div>

        <aside className="solicitud-resumen card solo-escritorio" aria-label="Resumen de la solicitud">
          <h2>Resumen</h2>
          {resumen}
        </aside>
      </div>

      {/* Celular: barra fija abajo con Atras y Siguiente. */}
      <div className="barra-enviar solo-celular">
        <button type="button" className="btn btn-secundario" onClick={atras} data-ayuda={ayudaAtras}>
          {indice === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        <span className="barra-paso" aria-hidden="true">
          {indice + 1} / {claves.length}
        </span>
        {paso !== 'persona' && (
          <button type="button" className="btn btn-primario" aria-busy={enviando} onClick={() => void (esUltimo ? enviar() : siguiente())} data-ayuda={ayudaSiguiente}>
            {esUltimo ? (enviando ? 'Enviando…' : 'Enviar') : 'Siguiente'}
          </button>
        )}
      </div>

      {problemas && (
        <Modal titulo="Revise antes de seguir" descripcion="Hay algo que corregir:" icono="alerta" alCerrar={() => setProblemas(null)} textoCerrar="Entendido">
          <ul className="lista-problemas">
            {problemas.map((p) => (
              <li key={p.texto}>
                <span>{p.texto}</span>
                {p.paso !== paso && claves.includes(p.paso) && (
                  <button type="button" className="btn-texto" onClick={() => { setProblemas(null); irA(p.paso); }} data-ayuda={`Ir al paso "${PASOS[p.paso].titulo}" para corregirlo`}>
                    Corregir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {creada && (
        <ModalExito titulo={creada.estado === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud enviada'} alAceptar={() => navegar(volverA)}>
          <p>
            <b>{creada.consecutivo}</b> · {creada.tipo.nombre} · {textoDeRango(creada.fechaInicio, creada.fechaFin)}
            {paraOtraPersona ? ` · ${creada.funcionario.nombre}` : ''}.
          </p>
          <p>
            {creada.estado === 'aprobada'
              ? creada.tipo.descuentaVacaciones
                ? `Quedó aprobada y se descontaron ${dias(creada.cantidadDias ?? 0)} del saldo.`
                : 'Quedó aprobada. No descuenta vacaciones.'
              : `Quedó pendiente: ${creada.aprobador?.nombre ?? 'la jefatura'} la revisará.${creada.tipo.descuentaVacaciones ? ' Los días se descuentan solo cuando se apruebe.' : ''}${paraOtraPersona ? '' : ' Mientras no la abra, puede cancelarla.'}`}
          </p>
        </ModalExito>
      )}

      {!paraOtraPersona && !usuario?.funcionarioId && (
        <Mensaje tipo="info">
          Su cuenta no está ligada a un funcionario. Para registrar a nombre de alguien use <Link to="/registrar-solicitud">Solicitud para otra persona</Link>.
        </Mensaje>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Paso "¿Para quien?"                                                 */
/* ------------------------------------------------------------------ */

const POR_PAGINA = 6;

/**
 * Lista de personas en la que se busca y se toca una. No es un desplegable:
 * es todo el paso, asi no queda una lista "colgando" que no se cierra.
 * La jefatura ve su personal a cargo (el backend ya lo filtra); RRHH, a todo
 * el personal activo.
 */
function ElegirPersona({ elegida, soloSuEquipo, alElegir }: { elegida: FuncionarioEnLista | null; soloSuEquipo: boolean; alElegir: (f: FuncionarioEnLista) => void }) {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    const espera = window.setTimeout(() => {
      setBusqueda(texto.trim());
      setPagina(1);
    }, 300);
    return () => window.clearTimeout(espera);
  }, [texto]);
  const resultados = useConsulta(() => consultarFuncionarios({ busqueda: busqueda || undefined, estado: 'activo', tamano: POR_PAGINA, pagina }), [busqueda, pagina]);
  const lista = (resultados.datos?.datos ?? []).filter((f) => !f.esPropio);

  return (
    <div className="elegir-persona">
      <div className="buscador">
        <Icono nombre="buscar" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={soloSuEquipo ? 'Buscar en su equipo por nombre o cédula' : 'Buscar por nombre o cédula'}
          aria-label="Buscar funcionario por nombre o cédula"
          autoComplete="off"
        />
      </div>
      {resultados.error && <Mensaje tipo="error">{resultados.error}</Mensaje>}
      {resultados.datos && lista.length === 0 && (
        <p className="resumen-ayuda">
          {busqueda ? 'Nadie coincide con esa búsqueda.' : soloSuEquipo ? 'No tiene personal a cargo activo.' : 'No hay funcionarios activos.'}
        </p>
      )}
      <ul className="personas-para-elegir">
        {lista.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-pressed={elegida?.id === f.id}
              onClick={() => alElegir(f)}
              data-ayuda={`Hacer la solicitud a nombre de ${nombreCompleto(f)}`}
            >
              <Avatar nombre={nombreCompleto(f)} tamano={36} />
              <span>
                <b>{nombreCompleto(f)}</b>
                <small>{[f.puesto?.nombre, f.departamento?.nombre].filter(Boolean).join(' · ') || f.cedula}</small>
              </span>
              <Icono nombre="siguiente" />
            </button>
          </li>
        ))}
      </ul>
      {resultados.datos && resultados.datos.totalPaginas > 1 && <Paginacion resultado={resultados.datos} nombre={['persona', 'personas']} alCambiar={setPagina} />}
    </div>
  );
}
