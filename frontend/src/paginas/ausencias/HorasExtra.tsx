/*
 * Horas extra (/horas-extra), solo Recursos Humanos (horasExtra.registrar).
 * Es un REGISTRO, sin aprobacion (decision 30/09): la jefatura las autorizo
 * fuera del sistema y RRHH las anota para saber cuantas hizo cada persona
 * por mes. Un error no se borra: se anula con motivo (queda en la bitacora).
 *
 * Arriba el mes (anterior / siguiente), los totales y el reparto por persona
 * (tocar una persona filtra los registros). Registrar va por pasos:
 * primero la persona y luego el dia y las horas (un turno que pasa la
 * medianoche se escribe tal cual, p. ej. 22:00 a 02:00). Todo se cuenta en
 * minutos (17:00 a 19:40 = 2 h 40 min) y la fecha puede estar hasta un anio
 * hacia atras o hacia adelante.
 */
import { useState } from 'react';
import { consultarOpcionesDeFuncionario, type FuncionarioEnLista } from '../../api/funcionarios';
import { anularHoraExtra, consultarHorasExtra, minutosEntre, registrarHoraExtra, textoDeMinutos, type HoraExtra } from '../../api/ausencias';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { Paginacion } from '../../componentes/Paginacion';
import { hoyEnCostaRica, moverMes, nombreDelMes, fechaCorta } from '../../utilidades/calendario';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { nombreCompleto } from '../../utilidades/texto';
import { Avatar } from '../vacaciones/comunes';
import { ElegirPersona } from '../vacaciones/NuevaSolicitud';

/** Un anio hacia atras y hacia adelante: el unico limite de fechas (decision 09/10). */
function limitesDeFecha(hoy: string): { minimo: string; maximo: string } {
  const anio = Number(hoy.slice(0, 4));
  return { minimo: `${anio - 1}${hoy.slice(4)}`, maximo: `${anio + 1}${hoy.slice(4)}` };
}

export function HorasExtra() {
  const hoy = hoyEnCostaRica();
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(parametros.get('mes') ?? '') ? parametros.get('mes')! : hoy.slice(0, 7);
  const funcionarioId = parametros.get('persona') ?? '';
  const departamentoId = parametros.get('departamento') ?? '';
  const busqueda = parametros.get('busqueda') ?? '';
  const incluirAnuladas = parametros.get('anuladas') === 'si';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const [texto, setTexto] = useBusquedaDiferida(busqueda, (t) => cambiar({ busqueda: t }));

  const departamentos = useConsulta(consultarOpcionesDeFuncionario, []).datos?.departamentos ?? [];
  const datos = useConsulta(
    () =>
      consultarHorasExtra({
        mes,
        funcionarioId: funcionarioId || undefined,
        departamentoId: departamentoId || undefined,
        busqueda: busqueda || undefined,
        incluirAnuladas: incluirAnuladas || undefined,
        pagina,
        tamano: 15,
      }),
    [mes, funcionarioId, departamentoId, busqueda, incluirAnuladas, pagina],
  );
  const [registrando, setRegistrando] = useState(false);
  const [anulando, setAnulando] = useState<HoraExtra | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const anio = Number(mes.slice(0, 4));
  const numeroDeMes = Number(mes.slice(5, 7)) - 1;
  function irAlMes(n: number) {
    const m = moverMes(anio, numeroDeMes, n);
    cambiar({ mes: `${m.anio}-${String(m.mes + 1).padStart(2, '0')}` });
  }
  const esMesActual = mes === hoy.slice(0, 7);
  const { minimo: fechaMinima, maximo: fechaMaxima } = limitesDeFecha(hoy);
  const enElPrimerMes = mes <= fechaMinima.slice(0, 7);
  const enElUltimoMes = mes >= fechaMaxima.slice(0, 7);
  const r = datos.datos;
  const maximo = Math.max(1, ...(r?.porPersona.map((p) => p.minutos) ?? [1]));
  const personaFiltrada = r?.porPersona.find((p) => p.funcionario.id === funcionarioId)?.funcionario.nombre;
  const hayFiltros = Boolean(funcionarioId || departamentoId || busqueda || incluirAnuladas);

  function listo(mensaje: string) {
    setRegistrando(false);
    setAnulando(null);
    setAviso(mensaje);
    datos.recargar();
  }

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Horas extra</h1>
          <p>Registro de las horas extra del personal, con el total de cada persona por mes. No requieren aprobación en el sistema.</p>
        </div>
        <div className="acc acc-principal">
          <button type="button" className="btn btn-primario" onClick={() => setRegistrando(true)} data-ayuda="Registrar las horas extra que hizo una persona">
            <Icono nombre="mas" /> Registrar horas
          </button>
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}

      <div className="herramientas">
        <div className="selector-mes" role="group" aria-label="Mes">
          <button type="button" className="icono-btn" onClick={() => irAlMes(-1)} disabled={enElPrimerMes} aria-label="Mes anterior" data-ayuda={enElPrimerMes ? 'Solo se consulta hasta un año hacia atrás' : 'Mes anterior'}>
            <Icono nombre="plegar" />
          </button>
          <b className="selector-mes-nombre">
            {nombreDelMes(numeroDeMes)} {anio}
          </b>
          <button type="button" className="icono-btn" onClick={() => irAlMes(1)} disabled={enElUltimoMes} aria-label="Mes siguiente" data-ayuda={enElUltimoMes ? 'Solo se consulta hasta un año hacia adelante' : 'Mes siguiente'}>
            <Icono nombre="siguiente" />
          </button>
          {!esMesActual && (
            <button type="button" className="btn btn-secundario btn-chico" onClick={() => cambiar({ mes: '' })} data-ayuda="Volver al mes actual">
              Este mes
            </button>
          )}
        </div>
        <div className="buscador">
          <Icono nombre="buscar" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o cédula" aria-label="Buscar por persona" />
        </div>
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
        <label className="casilla">
          <input type="checkbox" checked={incluirAnuladas} onChange={(e) => cambiar({ anuladas: e.target.checked ? 'si' : '' })} /> Ver anuladas
        </label>
        {hayFiltros && (
          <button type="button" className="btn-texto" onClick={() => { setTexto(''); cambiar({ persona: '', departamento: '', busqueda: '', anuladas: '' }); }} data-ayuda="Quitar todos los filtros">
            Limpiar filtros
          </button>
        )}
      </div>

      {datos.error && <Mensaje tipo="error">{datos.error}</Mensaje>}

      {r && (
        <>
          <div className="totales-horas" aria-live="polite">
            <div className="card total">
              <span>Total del mes</span>
              <b>{textoDeMinutos(r.totalMinutos)}</b>
            </div>
            <div className="card total">
              <span>Registros</span>
              <b>{r.totalRegistros}</b>
            </div>
            <div className="card total">
              <span>Personas</span>
              <b>{r.porPersona.length}</b>
            </div>
          </div>

          <div className="horas-columnas">
            <div className="card horas-por-persona">
              <h2>Por persona</h2>
              {r.porPersona.length === 0 ? (
                <p className="ayuda-detalle">Nadie tiene horas extra en {nombreDelMes(numeroDeMes).toLowerCase()}.</p>
              ) : (
                <ul>
                  {r.porPersona.map((p) => (
                    <li key={p.funcionario.id}>
                      <button
                        type="button"
                        aria-pressed={funcionarioId === p.funcionario.id}
                        onClick={() => cambiar({ persona: funcionarioId === p.funcionario.id ? '' : p.funcionario.id })}
                        data-ayuda={funcionarioId === p.funcionario.id ? 'Ver los registros de todos' : `Ver solo los registros de ${p.funcionario.nombre}`}
                      >
                        <Avatar nombre={p.funcionario.nombre} tamano={28} />
                        <span className="horas-persona">
                          <span>
                            {p.funcionario.nombre}
                            <small> · {p.registros} {p.registros === 1 ? 'registro' : 'registros'}</small>
                          </span>
                          <span className="horas-barra" aria-hidden="true">
                            <i style={{ width: `${(p.minutos / maximo) * 100}%` }} />
                          </span>
                        </span>
                        <b>{textoDeMinutos(p.minutos)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card horas-registros">
              <h2>{personaFiltrada ? `Registros de ${personaFiltrada}` : 'Registros'}</h2>
              {r.registros.datos.length === 0 ? (
                <p className="ayuda-detalle">No hay registros con esos filtros.</p>
              ) : (
                <>
                  <ul className="lista-horas">
                    {r.registros.datos.map((h) => (
                      <li key={h.id} data-anulada={h.vigente ? undefined : 'si'}>
                        <span className="hora-fecha">
                          <b>{fechaCorta(h.fecha)}</b>
                          <small>
                            {h.horaInicio} – {h.horaFin}
                            {h.nocturna ? ' (día siguiente)' : ''}
                          </small>
                        </span>
                        <span className="hora-datos">
                          {!funcionarioId && <span>{h.funcionario.nombre}</span>}
                          {h.motivo && <small>{h.motivo}</small>}
                          {!h.vigente && <small className="anulada">Anulada: {h.motivoAnulacion}</small>}
                        </span>
                        <b className="hora-cantidad">{textoDeMinutos(h.cantidadMinutos)}</b>
                        {h.vigente && (
                          <button type="button" className="btn-texto btn-texto-peligro" onClick={() => setAnulando(h)} data-ayuda="Anular este registro (le pedirá el motivo)">
                            Anular
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Paginacion resultado={r.registros} nombre={['registro', 'registros']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {registrando && <ModalRegistrar hoy={hoy} alCerrar={() => setRegistrando(false)} alTerminar={listo} />}
      {anulando && <ModalAnular hora={anulando} alCerrar={() => setAnulando(null)} alTerminar={listo} />}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ModalRegistrar({ hoy, alCerrar, alTerminar }: { hoy: string; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const [persona, setPersona] = useState<FuncionarioEnLista | null>(null);
  const [fecha, setFecha] = useState(hoy);
  const [inicio, setInicio] = useState('17:00');
  const [fin, setFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duracion = minutosEntre(inicio, fin);
  const nocturna = duracion !== null && fin < inicio;
  const { minimo, maximo } = limitesDeFecha(hoy);

  async function guardar() {
    if (!persona) return;
    const faltan: string[] = [];
    if (!fecha) faltan.push('Indique el día.');
    else if (fecha < minimo || fecha > maximo) faltan.push('La fecha debe estar dentro de un año hacia atrás o hacia adelante.');
    if (duracion === null) faltan.push('Indique la hora de inicio y la de fin (no pueden ser iguales).');
    else if (duracion > 16 * 60) faltan.push(`Un registro no puede pasar de 16 horas (este sería de ${textoDeMinutos(duracion)}).`);
    if (faltan.length) return setError(faltan.join(' '));
    setOcupado(true);
    setError(null);
    try {
      const h = await registrarHoraExtra({ funcionarioId: persona.id, fecha, horaInicio: inicio, horaFin: fin, motivo: motivo.trim() || undefined });
      alTerminar(`Se registraron ${textoDeMinutos(h.cantidadMinutos)} a ${h.funcionario.nombre} (${fechaCorta(h.fecha)}).`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  if (!persona) {
    return (
      <Modal titulo="Registrar horas extra" descripcion="Paso 1 de 2: ¿quién hizo las horas?" icono="reloj" alCerrar={alCerrar} ancho>
        <ElegirPersona elegida={null} soloSuEquipo={false} alElegir={setPersona} />
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Registrar horas extra"
      descripcion="Paso 2 de 2: el día y las horas"
      icono="reloj"
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      textoConfirmar={ocupado ? 'Guardando…' : 'Registrar'}
      ocupado={ocupado}
    >
      <button type="button" className="chip-persona" onClick={() => setPersona(null)} data-ayuda="Cambiar la persona">
        <Avatar nombre={nombreCompleto(persona)} tamano={24} /> {nombreCompleto(persona)}
      </button>
      <div className="detalles-rejilla">
        <div className="campo campo-ancho">
          <label htmlFor="he-fecha">
            Día <span className="obligatorio">*</span>
          </label>
          <input id="he-fecha" type="date" value={fecha} min={minimo} max={maximo} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="he-inicio">
            De <span className="obligatorio">*</span>
          </label>
          <input id="he-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="he-fin">
            A <span className="obligatorio">*</span>
          </label>
          <input id="he-fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>
      <p className="resumen-horas" aria-live="polite">
        {duracion === null ? (
          'Escriba la hora de inicio y la de fin.'
        ) : (
          <>
            Son <b>{textoDeMinutos(duracion)}</b>
            {nocturna ? ', terminando al día siguiente' : ''}.{duracion > 16 * 60 && <span className="msg-error"> Pasa del máximo de 16 horas por registro: revise las horas.</span>}
          </>
        )}
      </p>
      <div className="campo">
        <label htmlFor="he-motivo">
          Motivo <small className="opcional">(opcional)</small>
        </label>
        <input id="he-motivo" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: cierre de presupuesto, emergencia vial…" />
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}

function ModalAnular({ hora, alCerrar, alTerminar }: { hora: HoraExtra; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = motivo.trim().length >= 5;
  async function confirmar() {
    if (!valido) return;
    setOcupado(true);
    setError(null);
    try {
      await anularHoraExtra(hora.id, motivo.trim());
      alTerminar('Registro anulado.');
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }
  return (
    <Modal
      titulo="¿Anular el registro?"
      descripcion={`${hora.funcionario.nombre} · ${fechaCorta(hora.fecha)} · ${hora.horaInicio} – ${hora.horaFin} · ${textoDeMinutos(hora.cantidadMinutos)}`}
      icono="alerta"
      alCerrar={alCerrar}
      alEnviar={() => void confirmar()}
      textoConfirmar="Anular"
      peligro
      ocupado={ocupado}
      confirmarDesactivado={!valido}
    >
      <div className="campo">
        <label htmlFor="he-motivo-anular">
          Motivo <span className="obligatorio">*</span>
        </label>
        <textarea id="he-motivo-anular" rows={3} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por ejemplo: se registró dos veces." />
        <span className="ayuda">Mínimo 5 caracteres. No se borra: queda anulado en la bitácora.</span>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}
