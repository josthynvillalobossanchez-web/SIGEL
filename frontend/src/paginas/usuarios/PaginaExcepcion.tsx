/*
 * Paginas "Agregar excepcion" (/usuarios/:id/excepciones/nueva) y
 * "Editar excepcion" (/usuarios/:id/excepciones/:permisoId/editar).
 * En el menu: Usuarios -> Agregar excepcion / Editar excepcion.
 *
 * Una excepcion es un permiso individual: se CONCEDE algo que los roles de
 * la cuenta no dan, o se QUITA algo que si dan. Son muchos permisos y cada
 * uno lleva fecha y motivo, asi que no cabe comodo en una ventana.
 *
 * Agregar (4 pasos, en orden):
 *   1. Que hacer        dar o quitar.
 *   2. Permisos         por modulo (izquierda) con sus casillas (derecha).
 *                       Solo se pueden marcar los que tienen sentido: al dar,
 *                       los que la cuenta no tiene; al quitar, los que tiene.
 *                       Los demas se ven atenuados con el motivo.
 *   3. Duracion y motivo  permanente o hasta una fecha; motivo obligatorio.
 *   4. Revisar          tabla "hoy / despues de guardar" por permiso.
 * Se guardan todos juntos (POST /usuarios/:id/permisos); cada permiso queda
 * en la bitacora.
 *
 * Editar (2 pasos): efecto, duracion y motivo de UNA excepcion; revisar.
 *
 * Al terminar: ventana de exito -> Aceptar -> vuelve a la lista con la
 * ventana "Permisos individuales" de esa cuenta abierta (de donde vino).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { textoDelError } from '../../api/cliente';
import { ajustarVariosPermisos, consultarCuenta, type DetalleDeCuenta, type PermisoIndividual } from '../../api/usuarios';
import { consultarCatalogoDePermisos, type ModuloDePermisos } from '../../api/roles';
import { useSesion } from '../../sesion/SesionProveedor';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { SelectorPorModulos, type PermisoParaElegir } from '../../componentes/SelectorPorModulos';
import { CampoFechaDeVencimiento } from '../../componentes/CampoFechaDeVencimiento';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { Migas } from '../../componentes/Migas';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { Icono } from '../../componentes/Icono';
import { aFechaDeCampo, formatearFecha, problemaDeFechaDeVencimiento } from '../../utilidades/fechas';
import { nombreCompleto, nombreDeModulo } from '../../utilidades/texto';
import { motivoDeBloqueo } from './motivos';

type Efecto = 'dar' | 'quitar';

export function PaginaExcepcion() {
  const { id = '', permisoId } = useParams();
  const { tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [cuenta, setCuenta] = useState<DetalleDeCuenta | null>(null);
  const [catalogo, setCatalogo] = useState<ModuloDePermisos[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([consultarCuenta(id), consultarCatalogoDePermisos()])
      .then(([c, cat]) => {
        setCuenta(c);
        setCatalogo(cat);
      })
      .catch((e) => setError(textoDelError(e)));
  }, [id]);

  const editando = Boolean(permisoId);
  const existente = cuenta?.permisos.find((p) => p.id === permisoId && p.vigente) ?? null;
  const bloqueo = cuenta ? motivoDeBloqueo('permisos', cuenta.motivoNoModificable, tienePermisos) : null;
  const noEncontrada = Boolean(cuenta && editando && !existente);
  const titulo = editando ? 'Editar excepción' : 'Agregar excepción';

  if (error || !cuenta || !catalogo || bloqueo || noEncontrada) {
    return (
      <section className="pagina">
        <Migas migas={[{ texto: 'Usuarios', a: '/usuarios' }, { texto: titulo }]} />
        <div className="pagina-cab">
          <div>
            <h1>{titulo}</h1>
            {cuenta && <p>{nombreCompleto(cuenta.funcionario)} · {cuenta.correo}</p>}
          </div>
        </div>
        {!error && !cuenta && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {bloqueo && <Mensaje tipo="info">No puede cambiar los permisos de esta cuenta: {bloqueo}</Mensaje>}
        {noEncontrada && !bloqueo && (
          <Mensaje tipo="info">Esa excepción ya no está vigente (venció o la eliminaron). Puede agregar una nueva.</Mensaje>
        )}
        {(error || bloqueo || noEncontrada) && (
          <button className="volver" type="button" onClick={() => navegar(`/usuarios?permisos=${id}`)}>
            <Icono nombre="volver" tamano={17} /> Volver a los permisos individuales
          </button>
        )}
      </section>
    );
  }

  return <FormularioDeExcepcion cuenta={cuenta} catalogo={catalogo} existente={existente} />;
}

/* ================================================================== */

function FormularioDeExcepcion({
  cuenta,
  catalogo,
  existente,
}: {
  cuenta: DetalleDeCuenta;
  catalogo: ModuloDePermisos[];
  /** Con valor: se edita esa excepcion. Sin valor: se agregan nuevas. */
  existente: PermisoIndividual | null;
}) {
  const editando = Boolean(existente);
  const irSeguro = useIrSeguro();
  const navegar = useNavigate();
  const volverA = `/usuarios?permisos=${cuenta.id}`;
  const nombre = nombreCompleto(cuenta.funcionario);

  const inicial = {
    efecto: existente ? ((existente.otorgado ? 'dar' : 'quitar') as Efecto) : null,
    conFecha: Boolean(existente?.fechaVencimiento),
    fecha: aFechaDeCampo(existente?.fechaVencimiento),
    motivo: existente?.observacion ?? '',
  };
  const [paso, setPaso] = useState(0);
  const [efecto, setEfecto] = useState<Efecto | null>(inicial.efecto);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set(existente ? [existente.id] : []));
  const [conFecha, setConFecha] = useState(inicial.conFecha);
  const [fecha, setFecha] = useState(inicial.fecha);
  const [motivo, setMotivo] = useState(inicial.motivo);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);

  /* ---------------- Situacion de cada permiso hoy ---------------- */
  const efectivos = useMemo(() => new Set(cuenta.permisosEfectivos), [cuenta]);
  const excepcionDe = useMemo(() => new Map(cuenta.permisos.filter((p) => p.vigente).map((p) => [p.clave, p])), [cuenta]);
  const asignables = useMemo(() => new Set(catalogo.flatMap((m) => m.permisos.filter((p) => p.asignable).map((p) => p.id))), [catalogo]);
  const todos = useMemo(() => catalogo.flatMap((m) => m.permisos.map((p) => ({ ...p, modulo: m.modulo }))), [catalogo]);

  /** Por que no se puede elegir este permiso con el efecto elegido (null = si se puede). */
  function bloqueoDe(permiso: PermisoParaElegir, conEfecto: Efecto | null = efecto): string | null {
    if (!asignables.has(permiso.id)) return 'usted no tiene este permiso: nadie da ni quita lo que no tiene.';
    const excepcion = excepcionDe.get(permiso.clave);
    if (conEfecto === 'dar' && efectivos.has(permiso.clave)) {
      return excepcion?.otorgado
        ? 'ya se lo concede una excepción vigente (se edita desde "Permisos individuales").'
        : 'la cuenta ya lo tiene por sus roles.';
    }
    if (conEfecto === 'quitar' && !efectivos.has(permiso.clave)) {
      return excepcion && !excepcion.otorgado
        ? 'ya está quitado por una excepción vigente (se edita desde "Permisos individuales").'
        : 'la cuenta no lo tiene: no hay nada que quitar.';
    }
    return null;
  }

  function detalleDe(permiso: PermisoParaElegir) {
    const loTiene = efectivos.has(permiso.clave);
    const excepcion = excepcionDe.get(permiso.clave);
    return (
      <span className="estado-permiso">
        <span className={`chip ${loTiene ? 'chip-exito' : 'chip-neutro'}`}>{loTiene ? 'Hoy lo tiene' : 'Hoy no lo tiene'}</span>
        {excepcion && (
          <span className="sec-dato">
            Excepción: {excepcion.otorgado ? 'concedido' : 'quitado'}
            {excepcion.fechaVencimiento ? ` hasta ${formatearFecha(excepcion.fechaVencimiento)}` : ''}
          </span>
        )}
      </span>
    );
  }

  /** Cambiar de "dar" a "quitar" (o al reves) suelta los que ya no tienen sentido. */
  function elegirEfecto(nuevo: Efecto) {
    setEfecto(nuevo);
    if (!editando) setElegidos(new Set([...elegidos].filter((idP) => !bloqueoDe(todos.find((p) => p.id === idP)!, nuevo))));
  }

  const hayCambios = editando
    ? efecto !== inicial.efecto || conFecha !== inicial.conFecha || (conFecha && fecha !== inicial.fecha) || motivo.trim() !== inicial.motivo.trim()
    : Boolean(efecto || elegidos.size || motivo.trim());
  useCambiosSinGuardar(hayCambios && !guardada);

  /* ---------------- Pasos ---------------- */
  // Al editar, efecto y condiciones van juntos en el paso 0.
  const pasoEfecto = 0;
  const pasoPermisos = editando ? -1 : 1;
  const pasoCondiciones = editando ? 0 : 2;

  function revisarPaso(indice: number): string | null {
    if (indice === pasoEfecto && !efecto) return 'Elija si va a dar o a quitar permisos.';
    if (indice === pasoPermisos && elegidos.size === 0) return 'Marque al menos un permiso.';
    if (indice === pasoCondiciones) {
      if (conFecha) {
        if (!fecha) return 'Elija la fecha límite, o marque "Permanente".';
        const problema = problemaDeFechaDeVencimiento(fecha);
        if (problema) return problema;
      }
      if (!motivo.trim()) return 'Escriba el motivo: queda en la bitácora y explica después por qué se hizo la excepción.';
    }
    return null;
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      await ajustarVariosPermisos(cuenta.id, {
        permisoIds: [...elegidos],
        otorgado: efecto === 'dar',
        fechaVencimiento: conFecha ? fecha : undefined,
        observacion: motivo.trim(),
      });
      setGuardada(true);
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  const PASO_EFECTO: PasoDeFormulario = {
    titulo: 'Qué hacer',
    sub: 'Dar o quitar',
    descripcion: 'Una excepción cambia lo que la cuenta puede hacer sin tocar sus roles. Si varias personas necesitan lo mismo, conviene crear un rol.',
  };
  const PASO_PERMISOS: PasoDeFormulario = {
    titulo: 'Permisos',
    sub: 'Cuáles, por módulo',
    descripcion:
      efecto === 'dar'
        ? 'Elija un módulo a la izquierda y marque los permisos que va a conceder. Los que la cuenta ya tiene se ven atenuados.'
        : 'Elija un módulo a la izquierda y marque los permisos que va a quitar. Los que la cuenta no tiene se ven atenuados.',
  };
  const PASO_CONDICIONES: PasoDeFormulario = {
    titulo: editando ? 'Efecto, duración y motivo' : 'Duración y motivo',
    sub: 'Hasta cuándo y por qué',
    descripcion: editando
      ? 'Puede cambiar si el permiso se concede o se quita, hasta cuándo dura y el motivo.'
      : 'Aplica a todos los permisos elegidos. Con fecha, la excepción deja de contar sola al terminar ese día.',
  };
  const PASO_REVISAR: PasoDeFormulario = {
    titulo: 'Revisar y guardar',
    sub: 'Hoy y después',
    descripcion: 'Así queda la cuenta después de guardar. Se guarda todo junto y cada permiso queda en la bitácora.',
  };
  const PASOS = editando ? [PASO_CONDICIONES, PASO_REVISAR] : [PASO_EFECTO, PASO_PERMISOS, PASO_CONDICIONES, PASO_REVISAR];
  const enRevisar = paso === PASOS.length - 1;

  const opcionesDeEfecto = (
    <fieldset className="grupo-opciones opciones-grandes">
      <legend className={editando ? 'etiqueta-grupo' : 'solo-lector'}>Efecto de la excepción</legend>
      <label className="check" data-elegido={efecto === 'dar' ? 'si' : 'no'}>
        <input type="radio" name="efecto" checked={efecto === 'dar'} onChange={() => elegirEfecto('dar')} />
        <span className="txt">
          <b>Dar permisos</b>
          <span>Se conceden aunque ningún rol de la cuenta los incluya. Ejemplo: que cubra a su jefatura unos días.</span>
        </span>
      </label>
      <label className="check" data-elegido={efecto === 'quitar' ? 'si' : 'no'}>
        <input type="radio" name="efecto" checked={efecto === 'quitar'} onChange={() => elegirEfecto('quitar')} />
        <span className="txt">
          <b>Quitar permisos</b>
          <span>Se quitan aunque su rol sí los dé. Ejemplo: mientras dura una investigación.</span>
        </span>
      </label>
    </fieldset>
  );

  const permisosElegidos = todos.filter((p) => elegidos.has(p.id));

  return (
    <>
      <FormularioPorPasos
        migas={[{ texto: 'Usuarios', a: '/usuarios' }, { texto: nombre, a: volverA }, { texto: editando ? 'Editar excepción' : 'Agregar excepción' }]}
        titulo={editando ? 'Editar excepción' : 'Agregar excepción'}
        descripcion={
          <>
            Permisos individuales de <b>{nombre}</b> · {cuenta.correo}
          </>
        }
        pasos={PASOS}
        actual={paso}
        alCambiarPaso={setPaso}
        revisarPaso={revisarPaso}
        libre={editando}
        alCancelar={() => irSeguro(volverA)}
        alGuardar={() => void guardar()}
        textoGuardar={editando ? 'Guardar cambios' : elegidos.size > 1 ? `Guardar ${elegidos.size} excepciones` : 'Guardar excepción'}
        bloqueoGuardar={editando && !hayCambios ? 'no hay cambios que guardar.' : null}
        ocupado={ocupado}
        error={error}
        claveDeDatos={JSON.stringify([efecto, [...elegidos], conFecha, fecha, motivo])}
      >
        {!editando && paso === 0 && opcionesDeEfecto}

        {!editando && paso === 1 && (
          <SelectorPorModulos
            etiqueta="permisos para la excepción"
            modulos={catalogo}
            marcados={elegidos}
            alCambiar={setElegidos}
            bloqueoDe={(p) => bloqueoDe(p)}
            detalleDe={detalleDe}
          />
        )}

        {paso === pasoCondiciones && (
          <div className="dos-campos campo-fila">
            <div>
              {editando && existente && (
                <div className="campo">
                  <span className="etiqueta-campo">Permiso</span>
                  <div className="elegido">
                    <span>
                      <span className="clave">{existente.clave}</span>
                      <span className="sec-dato">{existente.descripcion}</span>
                    </span>
                  </div>
                </div>
              )}
              {editando && opcionesDeEfecto}
              <fieldset className="grupo-opciones">
                <legend className="etiqueta-grupo">Duración</legend>
                <div className="opciones-en-linea">
                  <label className="opcion-chica">
                    <input type="radio" name="duracion" checked={!conFecha} onChange={() => setConFecha(false)} />
                    Permanente
                  </label>
                  <label className="opcion-chica">
                    <input type="radio" name="duracion" checked={conFecha} onChange={() => setConFecha(true)} />
                    Hasta una fecha
                  </label>
                </div>
                {conFecha && (
                  <CampoFechaDeVencimiento
                    id="excFecha"
                    etiqueta="Fecha límite"
                    deQue="de la excepción"
                    valor={fecha}
                    alCambiar={setFecha}
                    ayuda="La excepción deja de contar sola al terminar ese día."
                  />
                )}
              </fieldset>
            </div>
            <div className="campo">
              <label htmlFor="excMotivo">
                Motivo <span className="obligatorio">*</span>
              </label>
              <textarea
                id="excMotivo"
                rows={5}
                maxLength={255}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por ejemplo: cubre a la jefatura durante sus vacaciones."
                aria-required="true"
              />
              <span className="ayuda">Queda en la bitácora junto con quién hizo la excepción. {255 - motivo.length} caracteres disponibles.</span>
            </div>
          </div>
        )}

        {enRevisar && (
          <>
            <dl className="info-rejilla resumen-paso">
              <div className="dato">
                <dt>Efecto</dt>
                <dd>{efecto === 'dar' ? 'Dar (conceder)' : 'Quitar'}</dd>
              </div>
              <div className="dato">
                <dt>Duración</dt>
                <dd>{conFecha && fecha ? `Hasta el ${fecha.split('-').reverse().join('/')}` : 'Permanente'}</dd>
              </div>
              <div className="dato" style={{ gridColumn: 'span 2' }}>
                <dt>Motivo</dt>
                <dd>{motivo.trim() || '—'}</dd>
              </div>
            </dl>
            <div className="tabla-envoltura tabla-compacta tabla-alta">
              <table>
                <caption className="solo-lector">Permisos y cómo quedan</caption>
                <thead>
                  <tr>
                    <th scope="col">Permiso</th>
                    <th scope="col">Módulo</th>
                    <th scope="col">Hoy</th>
                    <th scope="col">Después de guardar</th>
                  </tr>
                </thead>
                <tbody>
                  {permisosElegidos.map((p) => (
                    <tr key={p.id}>
                      <td data-etiqueta="Permiso">
                        <span className="clave">{p.clave}</span>
                      </td>
                      <td data-etiqueta="Módulo">{nombreDeModulo(p.modulo)}</td>
                      <td data-etiqueta="Hoy">{efectivos.has(p.clave) ? 'Lo tiene' : 'No lo tiene'}</td>
                      <td data-etiqueta="Después">
                        <span className={`chip ${efecto === 'dar' ? 'chip-exito' : 'chip-advert'}`}>{efecto === 'dar' ? 'Lo tiene' : 'No lo tiene'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </FormularioPorPasos>

      {guardada && (
        <ModalExito titulo={editando ? 'Excepción actualizada con éxito' : 'Excepción guardada con éxito'} alAceptar={() => navegar(volverA)}>
          <p>
            {efecto === 'dar' ? 'Se concedió' : 'Se quitó'}{' '}
            {permisosElegidos.length === 1 ? (
              <>
                el permiso <b>{permisosElegidos[0].clave}</b>
              </>
            ) : (
              <>
                <b>{permisosElegidos.length} permisos</b>
              </>
            )}{' '}
            a <b>{nombre}</b>
            {conFecha && fecha ? ` hasta el ${fecha.split('-').reverse().join('/')}` : ' de forma permanente'}. Quedó registrado en la
            bitácora.
          </p>
        </ModalExito>
      )}
    </>
  );
}
