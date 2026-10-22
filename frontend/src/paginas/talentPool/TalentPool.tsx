/*
 * Talent Pool para Recursos Humanos (/talent-pool). Unico lugar donde se ven
 * los perfiles (Ficha 34): nunca son publicos.
 *
 *   - Pestañas por estado (los inactivos no salen en la busqueda normal).
 *   - Buscador (cedula, nombre, correo, profesion, estudios, experiencia,
 *     habilidades) y filtros: profesion, nivel de estudio minimo, habilidades
 *     (todas las elegidas), años de experiencia y si tiene curriculum.
 *   - Perfil en una ventana: datos, estudios, experiencia, habilidades,
 *     curriculum, nota interna y acciones (estado, contratar, eliminar).
 *   - Contratar (Ficha 41): doble confirmacion y se abre "Registrar
 *     funcionario" con sus datos personales; RRHH completa los laborales y
 *     decide si tendra cuenta. El curriculum se copia al expediente.
 *   - Habilidades: catalogo que RRHH va ampliando.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { textoDelError } from '../../api/cliente';
import {
  cambiarCandidato,
  consultarCandidato,
  consultarCandidatos,
  consultarOpcionesDeTalentPool,
  consultarResumenDeCandidatos,
  eliminarCandidato,
  NOMBRE_DE_ESTADO,
  NOMBRE_DE_NIVEL,
  NOMBRE_DE_NIVEL_DE_HABILIDAD,
  traerCurriculum,
  type CandidatoDeLista,
  type DetalleDeCandidato,
  type EstadoDeCandidato,
  type NivelEducativo,
} from '../../api/talentPool';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { Paginacion } from '../../componentes/Paginacion';
import { VisorDeArchivo } from '../../componentes/VisorDeArchivo';
import { useSesion } from '../../sesion/SesionProveedor';
import { formatearFecha, formatearFechaHora } from '../../utilidades/fechas';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { useAbrirDesdeEnlace } from '../../utilidades/useAbrirDesdeEnlace';
import { useBusquedaDiferida } from '../../utilidades/useBusquedaDiferida';
import { useConsulta } from '../../utilidades/useConsulta';
import { Habilidades } from './Habilidades';

const PESTANAS: { valor: EstadoDeCandidato | 'todos'; texto: string; ayuda: string }[] = [
  { valor: 'activo', texto: 'Disponibles', ayuda: 'Candidatos activos: los que salen en la búsqueda normal' },
  { valor: 'inactivo', texto: 'Inactivos', ayuda: 'Pidieron no ser considerados por ahora, o RRHH los inactivó' },
  { valor: 'descartado', texto: 'Descartados', ayuda: 'No cumplen el perfil para la Municipalidad' },
  { valor: 'contratado', texto: 'Contratados', ayuda: 'Ya son funcionarios (se contrataron desde aquí)' },
  { valor: 'todos', texto: 'Todos', ayuda: 'Todos los candidatos, en cualquier estado' },
];
const CHIP_DE_ESTADO: Record<EstadoDeCandidato, string> = { activo: 'chip-exito', inactivo: 'chip-neutro', descartado: 'chip-advert', contratado: 'chip-info' };
const ENLACE_PUBLICO = `${window.location.origin}/trabaje-con-nosotros`;

export function TalentPool() {
  const { tienePermisos } = useSesion();
  const administra = tienePermisos('talentPool.administrar');
  const [parametros, cambiar] = useParametrosEnUrl({ reiniciaPagina: true });
  const estado = (parametros.get('estado') as EstadoDeCandidato | 'todos' | null) ?? 'activo';
  const busqueda = parametros.get('busqueda') ?? '';
  const profesionId = parametros.get('profesion') ?? '';
  const nivel = (parametros.get('nivel') ?? '') as NivelEducativo | '';
  const habilidades = (parametros.get('habilidades') ?? '').split(',').filter(Boolean);
  const anios = parametros.get('anios') ?? '';
  const conCv = (parametros.get('cv') ?? '') as 'si' | 'no' | '';
  // Fecha del ultimo envio del formulario (21/10): p. ej. los curriculums que llegaron del 3 al 5 de octubre.
  const enviadoDesde = parametros.get('desde') ?? '';
  const enviadoHasta = parametros.get('hasta') ?? '';
  const orden = parametros.get('orden') === 'nombre' ? 'nombre' : 'recientes';
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const hayFiltros = Boolean(busqueda || profesionId || nivel || habilidades.length || anios || conCv || enviadoDesde || enviadoHasta);
  const [texto, setTexto] = useBusquedaDiferida(busqueda, (t) => cambiar({ busqueda: t }));

  const opciones = useConsulta(consultarOpcionesDeTalentPool, []).datos;
  const resumen = useConsulta(consultarResumenDeCandidatos, []);
  const lista = useConsulta(
    () =>
      consultarCandidatos({
        estado,
        busqueda: busqueda || undefined,
        profesionId: profesionId || undefined,
        nivel: nivel || undefined,
        habilidades: habilidades.length ? habilidades.join(',') : undefined,
        aniosExperiencia: anios ? Number(anios) : undefined,
        conCurriculum: conCv || undefined,
        enviadoDesde: enviadoDesde || undefined,
        enviadoHasta: enviadoHasta || undefined,
        orden,
        pagina,
        tamano: 12,
      }),
    [estado, busqueda, profesionId, nivel, habilidades.join(','), anios, conCv, enviadoDesde, enviadoHasta, orden, pagina],
  );
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHabilidades, setVerHabilidades] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  useAbrirDesdeEnlace(consultarCandidato, (c) => setAbierto(c.id));

  const recargar = () => {
    lista.recargar();
    resumen.recargar();
  };
  const nombreDeHabilidad = (id: string) => opciones?.habilidades.find((h) => h.id === id)?.nombre ?? 'Habilidad';

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Talent Pool</h1>
          <p>Personas que se registraron en el formulario público «Trabaje con nosotros». Solo Recursos Humanos ve estos perfiles.</p>
        </div>
        <div className="acc">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => {
              void navigator.clipboard?.writeText(ENLACE_PUBLICO).then(() => setCopiado(true));
              window.setTimeout(() => setCopiado(false), 2500);
            }}
            data-ayuda={`Copiar el enlace del formulario público para compartirlo: ${ENLACE_PUBLICO}`}
          >
            <Icono nombre={copiado ? 'check' : 'copiar'} /> {copiado ? 'Enlace copiado' : 'Copiar enlace del formulario'}
          </button>
          <button type="button" className="btn btn-secundario" onClick={() => setVerHabilidades(true)} data-ayuda="Ver y administrar el catálogo de habilidades que eligen los candidatos">
            <Icono nombre="lista" /> Habilidades
          </button>
        </div>
      </div>

      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}

      <div className="segmentado tp-pestanas" role="group" aria-label="Estado de los candidatos">
        {PESTANAS.map((p) => (
          <button key={p.valor} type="button" aria-pressed={estado === p.valor} onClick={() => cambiar({ estado: p.valor === 'activo' ? '' : p.valor })} data-ayuda={p.ayuda}>
            {p.texto}
            {resumen.datos && p.valor !== 'todos' && <span className="segmentado-cuenta">{resumen.datos[p.valor]}</span>}
          </button>
        ))}
      </div>

      <div className="herramientas">
        <div className="buscador">
          <Icono nombre="buscar" />
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, cédula, profesión, estudio, puesto…" aria-label="Buscar candidatos" />
        </div>
        <label className="filtro-select">
          <span className="sr">Profesión</span>
          <select value={profesionId} onChange={(e) => cambiar({ profesion: e.target.value })}>
            <option value="">Todas las profesiones</option>
            {opciones?.profesiones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Nivel de estudio</span>
          <select value={nivel} onChange={(e) => cambiar({ nivel: e.target.value })}>
            <option value="">Cualquier estudio</option>
            {opciones?.niveles
              .filter((n) => n.valor !== 'curso')
              .map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.texto} o más
                </option>
              ))}
            <option value="curso">Con cursos o capacitaciones</option>
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Años de experiencia</span>
          <select value={anios} onChange={(e) => cambiar({ anios: e.target.value })}>
            <option value="">Cualquier experiencia</option>
            {[1, 3, 5, 10].map((a) => (
              <option key={a} value={a}>
                {a} {a === 1 ? 'año' : 'años'} o más
              </option>
            ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Habilidad</span>
          <select
            value=""
            onChange={(e) => e.target.value && cambiar({ habilidades: [...habilidades, e.target.value].join(',') })}
          >
            <option value="">{habilidades.length ? 'Agregar otra habilidad…' : 'Con la habilidad…'}</option>
            {opciones?.habilidades
              .filter((h) => !habilidades.includes(h.id))
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.nombre}
                </option>
              ))}
          </select>
        </label>
        <label className="filtro-select">
          <span className="sr">Currículum</span>
          <select value={conCv} onChange={(e) => cambiar({ cv: e.target.value })}>
            <option value="">Con o sin currículum</option>
            <option value="si">Con currículum</option>
            <option value="no">Sin currículum</option>
          </select>
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Enviado desde</span>
          <input type="date" value={enviadoDesde} max={enviadoHasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} aria-label="Candidatos que enviaron el formulario desde esta fecha" />
        </label>
        <label className="filtro-select filtro-fecha">
          <span>Hasta</span>
          <input type="date" value={enviadoHasta} min={enviadoDesde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} aria-label="Candidatos que enviaron el formulario hasta esta fecha" />
        </label>
        <label className="filtro-select">
          <span className="sr">Orden</span>
          <select value={orden} onChange={(e) => cambiar({ orden: e.target.value === 'nombre' ? 'nombre' : '' })}>
            <option value="recientes">Más recientes primero</option>
            <option value="nombre">Por apellido</option>
          </select>
        </label>
        {hayFiltros && (
          <button
            type="button"
            className="btn-texto"
            onClick={() => {
              setTexto('');
              cambiar({ busqueda: '', profesion: '', nivel: '', habilidades: '', anios: '', cv: '', desde: '', hasta: '' });
            }}
            data-ayuda="Quitar todos los filtros y la búsqueda"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      {habilidades.length > 0 && (
        <div className="chips-filtro" aria-label="Habilidades que deben tener">
          {habilidades.map((h) => (
            <span key={h} className="chip chip-info">
              {nombreDeHabilidad(h)}
              <button type="button" aria-label={`Quitar el filtro ${nombreDeHabilidad(h)}`} onClick={() => cambiar({ habilidades: habilidades.filter((x) => x !== h).join(',') })}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="bloque-lista">
        {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
        {lista.cargando && !lista.datos && <p className="ayuda-detalle">Cargando…</p>}
        {lista.datos && lista.datos.datos.length === 0 && (
          <div className="vacio">
            <Icono nombre="personas" tamano={34} />
            <h3>{hayFiltros ? 'No hay candidatos con esos filtros' : 'No hay candidatos en esta pestaña'}</h3>
            <p>{hayFiltros ? 'Pruebe con otra búsqueda o quite algún filtro.' : 'Comparta el enlace del formulario público para recibir candidatos.'}</p>
          </div>
        )}
        {lista.datos && lista.datos.datos.length > 0 && (
          <>
            <ul className="tp-lista-candidatos">
              {lista.datos.datos.map((c) => (
                <li key={c.id}>
                  <TarjetaDeCandidato c={c} alAbrir={() => setAbierto(c.id)} />
                </li>
              ))}
            </ul>
            <Paginacion resultado={lista.datos} nombre={['candidato', 'candidatos']} alCambiar={(p) => cambiar({ pagina: String(p) })} />
          </>
        )}
      </div>

      {abierto && (
        <PerfilDeCandidato
          id={abierto}
          administra={administra}
          alCerrar={() => setAbierto(null)}
          alCambiar={(texto) => {
            setAviso(texto);
            recargar();
          }}
          alEliminar={(texto) => {
            setAbierto(null);
            setAviso(texto);
            recargar();
          }}
        />
      )}
      {verHabilidades && <Habilidades administra={administra} alCerrar={() => setVerHabilidades(false)} />}
    </section>
  );
}

function TarjetaDeCandidato({ c, alAbrir }: { c: CandidatoDeLista; alAbrir: () => void }) {
  const iniciales = c.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <button type="button" className="tp-candidato" onClick={alAbrir} data-ayuda="Ver el perfil completo">
      <span className="avatar" aria-hidden="true">
        {iniciales}
      </span>
      <span className="tp-candidato-cuerpo">
        <span className="tp-candidato-cab">
          <b>{c.nombre}</b>
          <span className={`chip ${CHIP_DE_ESTADO[c.estado]}`}>{NOMBRE_DE_ESTADO[c.estado]}</span>
        </span>
        <span className="tp-candidato-sub">
          {c.profesion ?? 'Sin profesión indicada'}
          {c.profesionDigitada && <small title="La escribió el candidato: no está en el catálogo"> (digitada)</small>}
          {c.nivelMaximo && <> · {NOMBRE_DE_NIVEL[c.nivelMaximo]}</>}
          {' · '}
          {c.aniosExperiencia === 0 ? 'Sin experiencia registrada' : `${c.aniosExperiencia} ${c.aniosExperiencia === 1 ? 'año' : 'años'} de experiencia`}
        </span>
        {c.habilidades.length > 0 && (
          <span className="tp-candidato-hab">
            {c.habilidades.slice(0, 5).map((h) => (
              <span key={h} className="chip chip-neutro">
                {h}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="tp-candidato-fin">
        <small>Cédula {c.cedula}</small>
        <small>Actualizado el {formatearFecha(c.fechaActualizacion)}</small>
        {c.tieneCurriculum && (
          <small className="tp-cv">
            <Icono nombre="documento" tamano={14} /> Currículum
          </small>
        )}
      </span>
    </button>
  );
}

/* ================================================================== */
/* Perfil                                                              */
/* ================================================================== */

function PerfilDeCandidato({
  id,
  administra,
  alCerrar,
  alCambiar,
  alEliminar,
}: {
  id: string;
  administra: boolean;
  alCerrar: () => void;
  alCambiar: (texto: string) => void;
  alEliminar: (texto: string) => void;
}) {
  const navegar = useNavigate();
  const { tienePermisos } = useSesion();
  const consulta = useConsulta(() => consultarCandidato(id), [id]);
  const c = consulta.datos;
  const [nota, setNota] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [viendoCv, setViendoCv] = useState(false);
  const [contratando, setContratando] = useState<0 | 1 | 2>(0);
  const [eliminando, setEliminando] = useState(false);

  async function guardar(cambios: { estado?: 'activo' | 'inactivo' | 'descartado'; notaInterna?: string | null }, texto: string) {
    setOcupado(true);
    setError(null);
    try {
      await cambiarCandidato(id, cambios);
      consulta.recargar();
      setNota(null);
      alCambiar(texto);
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  const puedeContratar = administra && tienePermisos('funcionarios.crear') && c && !c.funcionarioId;
  const notaActual = nota ?? c?.notaInterna ?? '';

  return (
    <>
      <Modal
        titulo={c ? c.nombre : 'Candidato'}
        descripcion={c ? `Cédula ${c.cedula} · registrado el ${formatearFecha(c.fechaRegistro)}${c.vecesEnviado > 1 ? ` · actualizó su registro ${c.vecesEnviado - 1} ${c.vecesEnviado === 2 ? 'vez' : 'veces'}` : ''}` : undefined}
        icono="cuenta"
        alCerrar={alCerrar}
        ancho
        pie={
          <>
            <button type="button" className="btn btn-secundario" onClick={alCerrar}>
              Cerrar
            </button>
            {c?.curriculum && (
              <button type="button" className="btn btn-secundario" onClick={() => setViendoCv(true)} data-ayuda="Ver el currículum que adjuntó (queda en la bitácora)">
                <Icono nombre="documento" /> Ver currículum
              </button>
            )}
            {puedeContratar && (
              <button type="button" className="btn btn-primario" onClick={() => setContratando(1)} data-ayuda="Crear su perfil de funcionario con estos datos personales">
                <Icono nombre="personaMas" /> Contratar
              </button>
            )}
          </>
        }
      >
        {consulta.error && <Mensaje tipo="error">{consulta.error}</Mensaje>}
        {!c && !consulta.error && <p className="ayuda-detalle">Cargando…</p>}
        {c && (
          <div className="tp-perfil">
            {error && <Mensaje tipo="error">{error}</Mensaje>}
            {c.funcionario && (
              <Mensaje tipo="info">
                Contratado: ya es funcionario ({c.funcionario.nombre}).{' '}
                <a href={`/funcionarios?ver=${c.funcionario.id}`} onClick={(e) => { e.preventDefault(); navegar(`/funcionarios?ver=${c.funcionario!.id}`); }}>
                  Ver su ficha
                </a>
              </Mensaje>
            )}
            <div className="tp-perfil-cab">
              <span className={`chip ${CHIP_DE_ESTADO[c.estado]}`}>{NOMBRE_DE_ESTADO[c.estado]}</span>
              {c.cambioDeEstado && (
                <small>
                  desde el {formatearFecha(c.cambioDeEstado.fecha)}
                  {c.cambioDeEstado.por ? ` (lo cambió ${c.cambioDeEstado.por})` : ''}
                </small>
              )}
            </div>
            <dl className="tp-datos">
              <div>
                <dt>Correo</dt>
                <dd>
                  <a href={`mailto:${c.correo}`}>{c.correo}</a>
                </dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{c.telefono ? <a href={`tel:${c.telefono.replace('-', '')}`}>{c.telefono}</a> : '—'}</dd>
              </div>
              <div>
                <dt>Nacimiento</dt>
                <dd>{c.fechaNacimiento ? formatearFecha(c.fechaNacimiento) : '—'}</dd>
              </div>
              <div>
                <dt>Residencia</dt>
                <dd>{c.residencia ?? '—'}</dd>
              </div>
              <div>
                <dt>Profesión</dt>
                <dd>
                  {c.profesion ?? '—'}
                  {c.profesionDigitada && <small className="ayuda-detalle"> (la escribió el candidato; no está en el catálogo)</small>}
                </dd>
              </div>
              <div>
                <dt>Experiencia</dt>
                <dd>{c.aniosExperiencia === 0 ? 'Menos de un año o sin registrar' : `${c.aniosExperiencia} ${c.aniosExperiencia === 1 ? 'año' : 'años'}`}</dd>
              </div>
            </dl>
            {c.descripcion && (
              <section>
                <h3>Resumen</h3>
                <p className="tp-parrafo">{c.descripcion}</p>
              </section>
            )}
            <section>
              <h3>Estudios</h3>
              {c.formacion.length === 0 ? (
                <p className="ayuda-detalle">No indicó estudios.</p>
              ) : (
                <ul className="tp-items">
                  {c.formacion.map((f) => (
                    <li key={f.id}>
                      <b>{f.titulo ?? NOMBRE_DE_NIVEL[f.nivel]}</b>
                      <span>
                        {NOMBRE_DE_NIVEL[f.nivel]}
                        {f.institucion && ` · ${f.institucion}`}
                        {f.anioFinalizacion && ` · ${f.anioFinalizacion}`}
                        {!f.concluido && ' · en curso o sin terminar'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>Experiencia laboral</h3>
              {c.experiencia.length === 0 ? (
                <p className="ayuda-detalle">No indicó experiencia.</p>
              ) : (
                <ul className="tp-items">
                  {c.experiencia.map((e) => (
                    <li key={e.id}>
                      <b>
                        {e.puesto} · {e.empresa}
                      </b>
                      <span>
                        {e.fechaInicio ? mesEnTexto(e.fechaInicio) : '¿?'} – {e.esActual ? 'actualidad' : e.fechaFin ? mesEnTexto(e.fechaFin) : '¿?'}
                      </span>
                      {e.descripcion && <p className="tp-parrafo">{e.descripcion}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3>Habilidades</h3>
              {c.habilidadesDetalle.length === 0 ? (
                <p className="ayuda-detalle">No eligió habilidades.</p>
              ) : (
                <div className="tp-candidato-hab">
                  {c.habilidadesDetalle.map((h) => (
                    <span key={h.id} className={h.propia ? 'chip chip-info' : 'chip chip-neutro'} data-ayuda={h.propia ? 'La escribió el candidato con «Otra»: no está en el catálogo' : undefined}>
                      {h.nombre}
                      {h.nivel && <small> · {NOMBRE_DE_NIVEL_DE_HABILIDAD[h.nivel]}</small>}
                      {h.propia && <small> · propia</small>}
                    </span>
                  ))}
                </div>
              )}
            </section>
            <p className="ayuda-detalle">
              Aceptó el consentimiento informado {c.consentimiento.version} el {formatearFechaHora(c.consentimiento.fecha)}.
            </p>

            {administra && (
              <section className="tp-gestion">
                <h3>Gestión de Recursos Humanos</h3>
                <div className="campo">
                  <label htmlFor="tpNota">Nota interna (no la ve el candidato)</label>
                  <textarea id="tpNota" rows={2} maxLength={1000} value={notaActual} onChange={(e) => setNota(e.target.value)} placeholder="Por ejemplo: entrevistado el 20/10, interesado en plazas de campo." />
                  {nota !== null && nota !== (c.notaInterna ?? '') && (
                    <button type="button" className="btn btn-secundario btn-chico" disabled={ocupado} onClick={() => void guardar({ notaInterna: nota.trim() || null }, 'Se guardó la nota interna.')}>
                      Guardar nota
                    </button>
                  )}
                </div>
                {c.estado !== 'contratado' && (
                  <div className="tp-acciones">
                    {c.estado !== 'activo' && (
                      <button type="button" className="btn btn-secundario btn-chico" disabled={ocupado} onClick={() => void guardar({ estado: 'activo' }, `${c.nombre} quedó disponible otra vez.`)}>
                        Marcar disponible
                      </button>
                    )}
                    {c.estado !== 'inactivo' && (
                      <button type="button" className="btn btn-secundario btn-chico" disabled={ocupado} onClick={() => void guardar({ estado: 'inactivo' }, `${c.nombre} quedó inactivo: ya no sale en la búsqueda normal.`)} data-ayuda="Ya no saldrá en la búsqueda normal (por ejemplo, pidió no ser llamado por ahora)">
                        Marcar inactivo
                      </button>
                    )}
                    {c.estado !== 'descartado' && (
                      <button type="button" className="btn btn-secundario btn-chico" disabled={ocupado} onClick={() => void guardar({ estado: 'descartado' }, `${c.nombre} quedó descartado.`)} data-ayuda="No cumple el perfil para la Municipalidad">
                        Descartar
                      </button>
                    )}
                    <button type="button" className="btn-texto btn-texto-peligro" disabled={ocupado} onClick={() => setEliminando(true)} data-ayuda="Borrar todos sus datos porque la persona lo pidió (Ley 8968)">
                      <Icono nombre="basura" tamano={14} /> Eliminar sus datos…
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </Modal>

      {viendoCv && c && (
        <VisorDeArchivo titulo={`Currículum de ${c.nombre}`} traer={() => traerCurriculum(id)} nombreAlDescargar={c.curriculum?.nombre ?? 'curriculum.pdf'} alCerrar={() => setViendoCv(false)} />
      )}

      {contratando === 1 && c && (
        <Modal titulo="¿Contratar a esta persona?" icono="alerta" alCerrar={() => setContratando(0)} alEnviar={() => setContratando(2)} textoConfirmar="Sí, continuar">
          <p>
            ¿Está seguro de que <b>{c.nombre}</b> pasará a ser funcionario de la Municipalidad?
          </p>
        </Modal>
      )}
      {contratando === 2 && c && (
        <Modal
          titulo="Se creará su perfil de funcionario"
          icono="personaMas"
          alCerrar={() => setContratando(0)}
          alEnviar={() => navegar(`/funcionarios/nuevo?candidato=${encodeURIComponent(id)}`)}
          textoConfirmar="Abrir Registrar funcionario"
        >
          <p>Esta acción creará el perfil del funcionario en el sistema. Se abrirá «Registrar funcionario» con sus datos personales ya llenos:</p>
          <ul>
            <li>usted completa los datos laborales (puesto, departamento, jefatura, ingreso…);</li>
            <li>decide si tendrá cuenta de acceso;</li>
            <li>{c.curriculum ? 'su currículum se copiará a su expediente.' : 'no adjuntó currículum.'}</li>
          </ul>
          <p className="ayuda-detalle">Hasta que registre al funcionario, el candidato no cambia de estado.</p>
        </Modal>
      )}
      {eliminando && c && <EliminarDatos c={c} alCerrar={() => setEliminando(false)} alEliminar={alEliminar} />}
    </>
  );
}

function EliminarDatos({ c, alCerrar, alEliminar }: { c: DetalleDeCandidato; alCerrar: () => void; alEliminar: (texto: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function eliminar() {
    setOcupado(true);
    setError(null);
    try {
      await eliminarCandidato(c.id, motivo.trim());
      alEliminar(`Se eliminaron los datos de ${c.nombre} del Talent Pool.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }
  return (
    <Modal
      titulo="Eliminar sus datos del Talent Pool"
      icono="basura"
      peligro
      alCerrar={alCerrar}
      alEnviar={() => void eliminar()}
      textoConfirmar="Eliminar para siempre"
      ocupado={ocupado}
      confirmarDesactivado={motivo.trim().length < 5}
    >
      <p>
        Se borrarán <b>todos</b> los datos de {c.nombre} y su currículum. No se puede deshacer. Úselo solo cuando la persona lo pida (Ley 8968).
      </p>
      <div className="campo">
        <label htmlFor="tpMotivo">
          Motivo <span className="obligatorio">*</span>
        </label>
        <textarea id="tpMotivo" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Lo pidió por correo el 13/10." />
        <span className="ayuda">Queda en la bitácora, solo con la cédula.</span>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </Modal>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function mesEnTexto(aaaaMm: string): string {
  const [a, m] = aaaaMm.split('-');
  return `${MESES[Number(m) - 1]} ${a}`;
}
