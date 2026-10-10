/*
 * Pestana "Capacitaciones" del expediente: los cursos de la persona, con su
 * certificado. Registra la propia persona o Recursos Humanos. Si el curso
 * choca con el horario, el backend crea la solicitud para la jefatura (para
 * eso tambien sirve "Nueva solicitud" > Capacitacion).
 * Quien la registro (o RRHH) adjunta el certificado despues o la da de baja.
 * Filtros (HU 35 CA03, 10/10): texto (nombre o institucion), anio, modalidad
 * y si tiene certificado. Se filtra en el navegador: son pocas por persona.
 */
import { useState } from 'react';
import {
  adjuntarCertificado,
  consultarCapacitaciones,
  darDeBajaCapacitacion,
  registrarCapacitacion,
  type Capacitacion,
  type Modalidad,
} from '../../api/ausencias';
import { abrirArchivoDeDocumento } from '../../api/documentos';
import { textoDelError } from '../../api/cliente';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { VisorDeArchivo } from '../../componentes/VisorDeArchivo';
import { ZonaDeArchivo } from '../../componentes/ZonaDeArchivo';
import { useSesion } from '../../sesion/SesionProveedor';
import { problemaDeArchivo, TAMANO_MAXIMO_DOCUMENTO, TODOS_LOS_FORMATOS } from '../../utilidades/archivos';
import { hoyEnCostaRica, textoDeRango } from '../../utilidades/calendario';
import { useConsulta } from '../../utilidades/useConsulta';

const MODALIDAD: Record<Modalidad, string> = { presencial: 'Presencial', virtual: 'Virtual', mixta: 'Mixta' };

export function CapacitacionesDelExpediente({ funcionarioId, propio }: { funcionarioId: string; propio: boolean }) {
  const { tienePermisos } = useSesion();
  const puedeRegistrar = propio ? tienePermisos('solicitudes.crear') : tienePermisos('solicitudes.administrar');
  const lista = useConsulta(() => consultarCapacitaciones(funcionarioId), [funcionarioId]);
  const [registrando, setRegistrando] = useState(false);
  const [adjuntandoA, setAdjuntandoA] = useState<Capacitacion | null>(null);
  const [dandoDeBaja, setDandoDeBaja] = useState<Capacitacion | null>(null);
  const [viendo, setViendo] = useState<Capacitacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function listo(mensaje: string) {
    setRegistrando(false);
    setAdjuntandoA(null);
    setDandoDeBaja(null);
    setAviso(mensaje);
    lista.recargar();
  }

  const totalHoras = (lista.datos ?? []).reduce((t, c) => t + (c.cantidadHoras ?? 0), 0);

  // --- Filtros ---
  const [texto, setTexto] = useState('');
  const [anio, setAnio] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad | ''>('');
  const [certificado, setCertificado] = useState<'' | 'con' | 'sin'>('');
  const hayFiltros = Boolean(texto.trim() || anio || modalidad || certificado);
  const anioDe = (c: Capacitacion) => (c.fechaInicio ?? c.fechaRegistro).slice(0, 4);
  const anios = [...new Set((lista.datos ?? []).map(anioDe))].sort().reverse();
  const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean);
  const visibles = (lista.datos ?? []).filter((c) => {
    if (anio && anioDe(c) !== anio) return false;
    if (modalidad && c.modalidad !== modalidad) return false;
    if (certificado === 'con' && !c.certificadoId) return false;
    if (certificado === 'sin' && c.certificadoId) return false;
    const enTexto = sinTildes(`${c.nombre} ${c.institucion ?? ''}`);
    return palabras.every((p) => enTexto.includes(p));
  });

  return (
    <div className="capacitaciones">
      <div className="fila-acciones">
        <p className="ayuda-detalle">
          {lista.datos?.length
            ? `${lista.datos.length} ${lista.datos.length === 1 ? 'capacitación' : 'capacitaciones'}${totalHoras ? ` · ${totalHoras.toLocaleString('es-CR')} horas en total` : ''}.`
            : 'Cursos, talleres y capacitaciones, con su certificado.'}
        </p>
        {puedeRegistrar && (
          <button type="button" className="btn btn-primario" onClick={() => setRegistrando(true)} data-ayuda="Registrar un curso o capacitación en el expediente">
            <Icono nombre="mas" /> Registrar capacitación
          </button>
        )}
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
      {(lista.datos?.length ?? 0) > 0 && (
        <div className="herramientas filtros-capacitaciones">
          <div className="buscador">
            <Icono nombre="buscar" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre del curso o institución" aria-label="Buscar capacitaciones" />
          </div>
          <label className="filtro-select">
            <span className="sr">Año</span>
            <select value={anio} onChange={(e) => setAnio(e.target.value)}>
              <option value="">Todos los años</option>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro-select">
            <span className="sr">Modalidad</span>
            <select value={modalidad} onChange={(e) => setModalidad(e.target.value as Modalidad | '')}>
              <option value="">Toda modalidad</option>
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta</option>
            </select>
          </label>
          <label className="filtro-select">
            <span className="sr">Certificado</span>
            <select value={certificado} onChange={(e) => setCertificado(e.target.value as '' | 'con' | 'sin')}>
              <option value="">Con o sin certificado</option>
              <option value="con">Con certificado</option>
              <option value="sin">Sin certificado</option>
            </select>
          </label>
          {hayFiltros && (
            <button type="button" className="btn-texto" onClick={() => { setTexto(''); setAnio(''); setModalidad(''); setCertificado(''); }} data-ayuda="Quitar todos los filtros">
              Limpiar filtros
            </button>
          )}
        </div>
      )}
      {lista.datos && lista.datos.length > 0 && visibles.length === 0 && (
        <div className="vacio">
          <h3>Ninguna capacitación coincide con esos filtros</h3>
          <p>Pruebe con otro filtro o quítelos.</p>
        </div>
      )}
      {lista.datos && lista.datos.length === 0 && (
        <div className="vacio">
          <Icono nombre="reloj" tamano={36} />
          <h3>Sin capacitaciones registradas</h3>
          <p>{puedeRegistrar ? 'Registre la primera con el botón de arriba; el certificado se puede adjuntar después.' : 'Cuando se registren, aparecerán aquí con su certificado.'}</p>
        </div>
      )}

      {visibles.length > 0 && (
        <ul className="lista-capacitaciones">
          {visibles.map((c) => (
            <li key={c.id} className="card capacitacion">
              <div className="capacitacion-cab">
                <b>{c.nombre}</b>
                {c.certificadoId ? <span className="chip chip-exito">Con certificado</span> : <span className="chip chip-neutro">Sin certificado</span>}
              </div>
              <p className="capacitacion-datos">
                {[c.institucion, c.modalidad && MODALIDAD[c.modalidad], c.cantidadHoras && `${c.cantidadHoras.toLocaleString('es-CR')} h`, c.fechaInicio && c.fechaFin && textoDeRango(c.fechaInicio, c.fechaFin)]
                  .filter(Boolean)
                  .join(' · ') || 'Sin más datos'}
              </p>
              {c.solicitud && (
                <p className="capacitacion-solicitud">
                  <Icono nombre="calendario" tamano={14} /> Choca con el horario: solicitud {c.solicitud.consecutivo} ({c.solicitud.estado})
                </p>
              )}
              <div className="capacitacion-acciones">
                {c.certificadoId && (
                  <button type="button" className="btn btn-secundario btn-chico" onClick={() => setViendo(c)} data-ayuda="Ver el certificado">
                    <Icono nombre="documento" /> Certificado
                  </button>
                )}
                {c.puedeModificar && !c.certificadoId && (
                  <button type="button" className="btn btn-secundario btn-chico" onClick={() => setAdjuntandoA(c)} data-ayuda="Adjuntar el certificado de esta capacitación">
                    <Icono nombre="subirNube" /> Adjuntar certificado
                  </button>
                )}
                {c.puedeModificar && (
                  <button type="button" className="btn-texto btn-texto-peligro" onClick={() => setDandoDeBaja(c)} data-ayuda="Quitar esta capacitación del expediente (le pedirá confirmar)">
                    Dar de baja
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {registrando && <ModalRegistrar funcionarioId={propio ? undefined : funcionarioId} alCerrar={() => setRegistrando(false)} alTerminar={listo} />}
      {adjuntandoA && <ModalCertificado capacitacion={adjuntandoA} alCerrar={() => setAdjuntandoA(null)} alTerminar={listo} />}
      {dandoDeBaja && <ModalBaja capacitacion={dandoDeBaja} alCerrar={() => setDandoDeBaja(null)} alTerminar={listo} />}
      {viendo?.certificadoId && (
        <VisorDeArchivo
          titulo={`Certificado: ${viendo.nombre}`}
          traer={() => abrirArchivoDeDocumento(viendo.certificadoId!, 'ver')}
          descargar={() => abrirArchivoDeDocumento(viendo.certificadoId!, 'descargar')}
          nombreAlDescargar={`certificado-${viendo.nombre.slice(0, 40)}`}
          alCerrar={() => setViendo(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useArchivo() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  function elegir(a: File | undefined) {
    if (!a) return;
    const p = problemaDeArchivo(a, TODOS_LOS_FORMATOS, TAMANO_MAXIMO_DOCUMENTO);
    setProblema(p);
    setArchivo(p ? null : a);
  }
  const quitar = () => {
    setArchivo(null);
    setProblema(null);
  };
  return { archivo, problema, elegir, quitar };
}

function ModalRegistrar({ funcionarioId, alCerrar, alTerminar }: { funcionarioId?: string; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [institucion, setInstitucion] = useState('');
  const [modalidad, setModalidad] = useState<Modalidad | ''>('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [horas, setHoras] = useState('');
  const [chocaConHorario, setChocaConHorario] = useState(false);
  const { archivo, problema, elegir, quitar } = useArchivo();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const faltan: string[] = [];
    if (nombre.trim().length < 2) faltan.push('Escriba el nombre del curso.');
    if ((inicio && !fin) || (!inicio && fin)) faltan.push('Indique las dos fechas, o ninguna.');
    if (inicio && fin && fin < inicio) faltan.push('La fecha de fin no puede ser antes del inicio.');
    if (chocaConHorario && inicio && inicio < hoyEnCostaRica()) faltan.push('Si choca con el horario se pide permiso a la jefatura, así que las fechas deben ser de hoy en adelante.');
    if (chocaConHorario && !(inicio && fin)) faltan.push('Si choca con el horario, indique las fechas: con ellas se crea la solicitud para la jefatura.');
    if (horas && !(Number(horas.replace(',', '.')) >= 0.5)) faltan.push('Las horas deben ser un número de al menos 0,5.');
    if (faltan.length) return setError(faltan.join(' '));
    setOcupado(true);
    setError(null);
    try {
      const c = await registrarCapacitacion(
        {
          funcionarioId,
          nombre: nombre.trim(),
          institucion: institucion.trim() || undefined,
          modalidad,
          fechaInicio: inicio || undefined,
          fechaFin: fin || undefined,
          cantidadHoras: horas ? Number(horas.replace(',', '.')) : '',
          afectaJornada: chocaConHorario,
        },
        archivo,
      );
      alTerminar(c.solicitud ? `Capacitación registrada. Se creó la solicitud ${c.solicitud.consecutivo} para la jefatura.` : 'Capacitación registrada en el expediente.');
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal titulo="Registrar capacitación" icono="reloj" alCerrar={alCerrar} alEnviar={() => void guardar()} textoConfirmar={ocupado ? 'Guardando…' : 'Registrar'} ocupado={ocupado} ancho>
      <div className="detalles-rejilla">
        <div className="campo campo-ancho">
          <label htmlFor="cap-nombre">
            Nombre del curso <span className="obligatorio">*</span>
          </label>
          <input id="cap-nombre" maxLength={200} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cap-institucion">Institución</label>
          <input id="cap-institucion" maxLength={180} value={institucion} onChange={(e) => setInstitucion(e.target.value)} placeholder="INA, IFAM, UNED…" />
        </div>
        <div className="campo">
          <label htmlFor="cap-modalidad">Modalidad</label>
          <select id="cap-modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value as Modalidad | '')}>
            <option value="">Sin indicar</option>
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
            <option value="mixta">Mixta</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="cap-inicio">Desde</label>
          <input id="cap-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cap-fin">Hasta</label>
          <input id="cap-fin" type="date" value={fin} min={inicio || undefined} onChange={(e) => setFin(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cap-horas">Horas</label>
          <input id="cap-horas" inputMode="decimal" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="40" />
        </div>
      </div>
      <label className="casilla">
        <input type="checkbox" checked={chocaConHorario} onChange={(e) => setChocaConHorario(e.target.checked)} /> Choca con el horario de trabajo (se crea la solicitud para que la jefatura la apruebe)
      </label>
      <div className="campo">
        <span className="etiqueta-campo">Certificado <small className="opcional">(opcional: se puede adjuntar después)</small></span>
        <ZonaDeArchivo id="cap-certificado" formatos={TODOS_LOS_FORMATOS} tamanoMaximo={TAMANO_MAXIMO_DOCUMENTO} archivo={archivo} alElegir={elegir} alQuitar={quitar} invalido={Boolean(problema)} />
        {problema && <span className="msg-error" role="alert">{problema}</span>}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}

function ModalCertificado({ capacitacion, alCerrar, alTerminar }: { capacitacion: Capacitacion; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const { archivo, problema, elegir, quitar } = useArchivo();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    if (!archivo) return setError('Elija el archivo del certificado.');
    setOcupado(true);
    setError(null);
    try {
      await adjuntarCertificado(capacitacion.id, archivo);
      alTerminar('Certificado adjuntado.');
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }
  return (
    <Modal titulo="Adjuntar certificado" descripcion={capacitacion.nombre} icono="subirNube" alCerrar={alCerrar} alEnviar={() => void guardar()} textoConfirmar={ocupado ? 'Subiendo…' : 'Adjuntar'} ocupado={ocupado} confirmarDesactivado={!archivo}>
      <ZonaDeArchivo id="cert-archivo" formatos={TODOS_LOS_FORMATOS} tamanoMaximo={TAMANO_MAXIMO_DOCUMENTO} archivo={archivo} alElegir={elegir} alQuitar={quitar} invalido={Boolean(problema)} obligatorio />
      {problema && <span className="msg-error" role="alert">{problema}</span>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}

function ModalBaja({ capacitacion, alCerrar, alTerminar }: { capacitacion: Capacitacion; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await darDeBajaCapacitacion(capacitacion.id);
      alTerminar('Capacitación dada de baja.');
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }
  return (
    <Modal titulo="¿Dar de baja la capacitación?" descripcion={capacitacion.nombre} icono="alerta" alCerrar={alCerrar} alEnviar={() => void confirmar()} textoConfirmar="Sí, dar de baja" peligro ocupado={ocupado}>
      <p>Deja de aparecer en el expediente. Queda en la bitácora{capacitacion.certificadoId ? '; el certificado se conserva en la pestaña Documentos' : ''}.</p>
      {capacitacion.solicitud?.estado === 'pendiente' && <p>La solicitud {capacitacion.solicitud.consecutivo} sigue pendiente: si ya no aplica, cancélela desde «Mis ausencias».</p>}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}
