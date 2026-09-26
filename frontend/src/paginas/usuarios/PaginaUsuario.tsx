/*
 * Paginas "Crear usuario" (/usuarios/nuevo) y "Editar usuario"
 * (/usuarios/:id/editar). En el menu: Usuarios -> Crear usuario / Editar usuario.
 *
 * Por pasos, para no tener que bajar (FormularioPorPasos):
 *   1. Cuenta   funcionario y correo de ingreso.
 *   2. Roles    que podra hacer; cada rol permanente o hasta una fecha.
 *   3. Revisar  lo que se va a crear, o la lista de lo que cambia.
 *
 * Crear:  el funcionario se busca entre los activos que aun no tienen
 *         cuenta. La contrasena temporal la genera el sistema y se muestra
 *         UNA vez en la ventana de exito. Pasos en orden.
 * Editar: el funcionario no cambia (la cuenta nace y muere ligada a esa
 *         persona). Se puede ir a cualquier paso. Se guarda todo junto
 *         (correo y roles) o nada; cada cambio queda en la bitacora.
 *
 * Reglas que se revisan aqui (el backend las revisa otra vez):
 *   - al menos un rol, y al menos uno PERMANENTE: si todos vencen,
 *     llegaria el dia en que la cuenta se queda sin acceso;
 *   - "Hasta una fecha" exige una fecha completa, de hoy en adelante y a no
 *     mas de 5 anios (antes una fecha a medio escribir se guardaba como
 *     permanente sin avisar);
 *   - solo se marcan los roles que quien actua puede dar y no se desmarcan
 *     los que no puede quitar (con la explicacion al pasar el mouse);
 *   - la cuenta propia y las de mayor acceso no se editan (se explica).
 *
 * Al terminar: ventana "...con exito" -> Aceptar -> vuelve a la lista.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { textoDelError } from '../../api/cliente';
import {
  buscarFuncionariosDisponibles,
  consultarCuenta,
  crearCuenta,
  editarCuenta,
  type CuentaCreada,
  type DetalleDeCuenta,
  type FuncionarioDisponible,
} from '../../api/usuarios';
import { consultarRoles, type RolResumido } from '../../api/roles';
import { useSesion } from '../../sesion/SesionProveedor';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { Migas } from '../../componentes/Migas';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { Icono } from '../../componentes/Icono';
import { aFechaDeCampo, formatearFecha } from '../../utilidades/fechas';
import { inicialesDeFuncionario, nombreCompleto } from '../../utilidades/texto';
import { ContrasenaTemporal } from './ContrasenaTemporal';
import { aPedidos, revisarRoles, SelectorDeRoles, type RolesMarcados, type Vigencia } from './SelectorDeRoles';
import { motivoDeBloqueo } from './motivos';

const LISTA = '/usuarios';

/* ================================================================== */
/* Crear usuario                                                       */
/* ================================================================== */

export function PaginaCrearUsuario() {
  return <FormularioDeUsuario />;
}

/* ================================================================== */
/* Editar usuario: primero carga la cuenta                             */
/* ================================================================== */

export function PaginaEditarUsuario() {
  const { id = '' } = useParams();
  const { tienePermisos } = useSesion();
  const [cuenta, setCuenta] = useState<DetalleDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    consultarCuenta(id)
      .then(setCuenta)
      .catch((e) => setError(textoDelError(e)));
  }, [id]);

  const bloqueo = cuenta ? motivoDeBloqueo('editar', cuenta.motivoNoModificable, tienePermisos) : null;

  if (error || !cuenta || bloqueo) {
    return (
      <section className="pagina">
        <Migas migas={[{ texto: 'Usuarios', a: LISTA }, { texto: 'Editar usuario' }]} />
        <div className="pagina-cab">
          <div>
            <h1>Editar usuario</h1>
            {cuenta && <p>{nombreCompleto(cuenta.funcionario)} · {cuenta.correo}</p>}
          </div>
        </div>
        {!error && !cuenta && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {bloqueo && <Mensaje tipo="info">No puede editar esta cuenta: {bloqueo}</Mensaje>}
        {(error || bloqueo) && <VolverALaLista />}
      </section>
    );
  }
  return <FormularioDeUsuario cuenta={cuenta} />;
}

function VolverALaLista() {
  const navegar = useNavigate();
  return (
    <button className="volver" type="button" onClick={() => navegar(LISTA)}>
      <Icono nombre="volver" tamano={17} /> Volver a usuarios
    </button>
  );
}

/* ================================================================== */
/* El formulario (crear y editar)                                      */
/* ================================================================== */

function FormularioDeUsuario({ cuenta }: { cuenta?: DetalleDeCuenta }) {
  const editando = Boolean(cuenta);
  const irSeguro = useIrSeguro();
  const navegar = useNavigate();

  // Roles con los que empieza: los vigentes de la cuenta.
  const iniciales = useMemo<RolesMarcados>(() => {
    const r: RolesMarcados = {};
    cuenta?.roles
      .filter((x) => x.vigente)
      .forEach((x) => (r[x.id] = { conFecha: Boolean(x.fechaVencimiento), fecha: aFechaDeCampo(x.fechaVencimiento) }));
    return r;
  }, [cuenta]);

  const [paso, setPaso] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [funcionarios, setFuncionarios] = useState<FuncionarioDisponible[] | null>(null);
  const [elegido, setElegido] = useState<FuncionarioDisponible | null>(null);
  const [correo, setCorreo] = useState(cuenta?.correo ?? '');
  const [roles, setRoles] = useState<RolResumido[] | null>(null);
  const [marcados, setMarcados] = useState<RolesMarcados>(iniciales);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<CuentaCreada | null>(null);
  const [editada, setEditada] = useState<DetalleDeCuenta | null>(null);

  // Crear: buscar funcionarios sin cuenta, un momento despues de escribir.
  useEffect(() => {
    if (editando) return;
    let vigente = true;
    const espera = window.setTimeout(() => {
      buscarFuncionariosDisponibles(busqueda.trim())
        .then((lista) => vigente && setFuncionarios(lista))
        .catch((e) => vigente && setError(textoDelError(e)));
    }, 350);
    return () => {
      vigente = false;
      window.clearTimeout(espera);
    };
  }, [busqueda, editando]);

  useEffect(() => {
    consultarRoles()
      .then(setRoles)
      .catch((e) => setError(textoDelError(e)));
  }, []);

  const nombreDeRol = (id: string) => roles?.find((r) => r.id === id)?.nombre ?? 'Rol';
  const correoLimpio = correo.trim().toLowerCase();
  const cambios = useMemo(() => (cuenta ? calcularCambios(cuenta, correoLimpio, iniciales, marcados) : null), [cuenta, correoLimpio, iniciales, marcados]);
  const hayCambios = editando
    ? Boolean(cambios && (cambios.correo || cambios.agregados.length || cambios.quitados.length || cambios.cambiados.length))
    : Boolean(elegido || correo.trim() || Object.keys(marcados).length);
  const terminado = Boolean(creada || editada);
  useCambiosSinGuardar(hayCambios && !terminado);

  /* ---------------- Revision de cada paso ---------------- */
  function revisarPaso(indice: number): string | null {
    if (indice === 0) {
      if (!editando && !elegido) return 'Elija al funcionario al que le va a crear la cuenta.';
      if (!correoLimpio) return 'Escriba el correo de ingreso.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) return 'El correo de ingreso no tiene un formato válido.';
    }
    if (indice === 1) return revisarRoles(marcados, nombreDeRol);
    return null;
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      if (!cuenta) {
        const resultado = await crearCuenta({
          funcionarioId: elegido!.id,
          // Si es el institucional no hace falta mandarlo: el backend lo usa solo.
          correo: correoLimpio === elegido!.correoInstitucional?.toLowerCase() ? undefined : correoLimpio,
          roles: aPedidos(marcados),
        });
        setCreada(resultado);
      } else {
        const cambioDeRoles = Boolean(cambios && (cambios.agregados.length || cambios.quitados.length || cambios.cambiados.length));
        const resultado = await editarCuenta(cuenta.id, {
          correo: cambios?.correo ? correoLimpio : undefined,
          roles: cambioDeRoles ? aPedidos(marcados) : undefined,
        });
        setEditada(resultado);
      }
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  const persona = editando ? cuenta!.funcionario : elegido;
  const nombre = persona ? nombreCompleto(persona) : '';

  const PASOS: PasoDeFormulario[] = [
    {
      titulo: 'Cuenta',
      sub: 'Funcionario y correo',
      descripcion: editando
        ? 'La cuenta queda ligada siempre a la misma persona. El correo de ingreso es con el que inicia sesión.'
        : 'Elija a la persona y confirme el correo con el que va a iniciar sesión. Solo aparecen funcionarios activos que todavía no tienen cuenta.',
    },
    {
      titulo: 'Roles',
      sub: 'Qué podrá hacer',
      descripcion:
        'Marque los roles. Cada uno es permanente o dura hasta una fecha (suplencias): deja de contar solo al terminar ese día. Debe quedar al menos un rol permanente.',
    },
    {
      titulo: editando ? 'Revisar y guardar' : 'Revisar y crear',
      sub: editando ? 'Lo que va a cambiar' : 'Confirmar los datos',
      descripcion: editando
        ? 'Revise la lista de cambios. Se guardan todos juntos y cada uno queda registrado en la bitácora.'
        : 'Revise los datos. Al crear, el sistema genera una contraseña temporal que se muestra una sola vez y se envía por correo.',
    },
  ];

  return (
    <>
      <FormularioPorPasos
        migas={
          editando
            ? [{ texto: 'Usuarios', a: LISTA }, { texto: nombre || cuenta!.correo, a: `${LISTA}?ver=${cuenta!.id}` }, { texto: 'Editar usuario' }]
            : [{ texto: 'Usuarios', a: LISTA }, { texto: 'Crear usuario' }]
        }
        titulo={editando ? 'Editar usuario' : 'Crear usuario'}
        descripcion={
          editando ? (
            <>
              <b>{nombre}</b> · {cuenta!.correo}
            </>
          ) : (
            'Cuenta de acceso para un funcionario. La contraseña inicial la genera el sistema y se debe cambiar en el primer ingreso.'
          )
        }
        pasos={PASOS}
        actual={paso}
        alCambiarPaso={setPaso}
        revisarPaso={revisarPaso}
        libre={editando}
        alCancelar={() => irSeguro(LISTA)}
        alGuardar={() => void guardar()}
        textoGuardar={editando ? 'Guardar cambios' : 'Crear usuario'}
        bloqueoGuardar={editando && !hayCambios ? 'no hay cambios que guardar.' : null}
        ocupado={ocupado}
        error={error}
        claveDeDatos={JSON.stringify([elegido?.id, correo, marcados])}
      >
        {/* ---------------- Paso 1: cuenta ---------------- */}
        {paso === 0 && (
          <div className="campo-fila dos-campos">
            <div className="campo">
              <span className="etiqueta-campo" id="etqFuncionario">
                Funcionario asociado {!editando && <span className="obligatorio">*</span>}
              </span>
              {persona ? (
                <div className="elegido" aria-labelledby="etqFuncionario">
                  <div className="celda-usuario">
                    <div className="avatar-sm" aria-hidden="true">
                      {inicialesDeFuncionario(persona)}
                    </div>
                    <div>
                      <span className="nom">{nombre}</span>
                      <span className="sec">Cédula {persona.cedula}</span>
                    </div>
                  </div>
                  {!editando && (
                    <button className="btn btn-texto" type="button" onClick={() => setElegido(null)} data-ayuda="Elegir a otra persona">
                      Cambiar
                    </button>
                  )}
                </div>
              ) : editando ? (
                <div className="elegido">Cuenta técnica, sin expediente</div>
              ) : (
                <>
                  <div className="buscador">
                    <Icono nombre="buscar" />
                    <input
                      type="search"
                      placeholder="Buscar por nombre, apellidos, cédula o correo"
                      aria-labelledby="etqFuncionario"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      maxLength={100}
                    />
                  </div>
                  <div className="lista-eleccion lista-eleccion-pagina" role="listbox" aria-labelledby="etqFuncionario" aria-busy={funcionarios === null}>
                    {funcionarios === null ? (
                      <p className="nota-modal">Buscando…</p>
                    ) : funcionarios.length === 0 ? (
                      <p className="nota-modal">
                        No hay funcionarios sin cuenta que coincidan. Si la persona no aparece, puede que ya tenga cuenta o
                        que todavía no esté registrada.
                      </p>
                    ) : (
                      funcionarios.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          role="option"
                          aria-selected="false"
                          className="item-sel"
                          onClick={() => {
                            setElegido(f);
                            setCorreo(f.correoInstitucional ?? '');
                            setError(null);
                          }}
                        >
                          <span className="avatar-sm" aria-hidden="true">
                            {inicialesDeFuncionario(f)}
                          </span>
                          <span>
                            <b style={{ display: 'block' }}>{nombreCompleto(f)}</b>
                            <span className="sec-dato">
                              Cédula {f.cedula}
                              {f.correoInstitucional ? ` · ${f.correoInstitucional}` : ''}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="campo">
              <label htmlFor="usCorreo">
                Correo de ingreso <span className="obligatorio">*</span>
              </label>
              <input
                id="usCorreo"
                type="email"
                placeholder="nombre@munipalmares.go.cr"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                maxLength={150}
                autoComplete="off"
                aria-required="true"
              />
              <span className="ayuda">
                Es el identificador con el que la persona inicia sesión. No se puede repetir.
                {editando && ' Si lo cambia, se avisa a la dirección anterior y a la nueva.'}
                {!editando && ' Al elegir a la persona se propone su correo institucional.'}
              </span>
            </div>
          </div>
        )}

        {/* ---------------- Paso 2: roles ---------------- */}
        {paso === 1 && (
          <SelectorDeRoles roles={roles} iniciales={iniciales} marcados={marcados} alCambiar={setMarcados} />
        )}

        {/* ---------------- Paso 3: revisar ---------------- */}
        {paso === 2 && !editando && (
          <dl className="info-rejilla resumen-paso">
            <div className="dato">
              <dt>Funcionario</dt>
              <dd>
                {nombre || '—'}
                {elegido && <span className="sec-dato">Cédula {elegido.cedula}</span>}
              </dd>
            </div>
            <div className="dato">
              <dt>Correo de ingreso</dt>
              <dd>{correoLimpio || '—'}</dd>
            </div>
            <div className="dato">
              <dt>Contraseña</dt>
              <dd>Temporal, la genera el sistema. Se muestra al crear y se envía por correo.</dd>
            </div>
            <div className="dato" style={{ gridColumn: '1/-1' }}>
              <dt>Roles</dt>
              <dd>
                <div className="pills">
                  {Object.entries(marcados).map(([rolId, v]) => (
                    <span className="chip-rol sistema" key={rolId}>
                      {nombreDeRol(rolId)} · {v.conFecha ? `hasta ${formatearFechaDeCampo(v.fecha)}` : 'permanente'}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
          </dl>
        )}
        {paso === 2 && editando && cambios && <ListaDeCambios cambios={cambios} nombreDeRol={nombreDeRol} />}
      </FormularioPorPasos>

      {/* ---------------- Exito ---------------- */}
      {creada && (
        <ModalExito titulo="Usuario creado con éxito" alAceptar={() => navegar(LISTA)}>
          <p>
            <b>{nombre}</b> ya tiene cuenta en SIGEL con el correo <b>{creada.correo}</b>.
          </p>
          <p className="nota-modal" style={{ margin: '10px 0 6px' }}>
            Roles:{' '}
            {creada.roles
              .map((r) => (r.fechaVencimiento ? `${r.nombre} (hasta ${formatearFecha(r.fechaVencimiento)})` : r.nombre))
              .join(', ')}
          </p>
          <ContrasenaTemporal contrasena={creada.contrasenaTemporal} />
        </ModalExito>
      )}
      {editada && (
        <ModalExito titulo="Usuario actualizado con éxito" alAceptar={() => navegar(LISTA)}>
          <p>
            Se guardaron los cambios de <b>{nombre || editada.correo}</b>. Cada cambio quedó registrado en la bitácora.
          </p>
          <p className="nota-modal" style={{ marginTop: 10 }}>
            Correo de ingreso: {editada.correo}
            <br />
            Roles vigentes:{' '}
            {editada.roles
              .filter((r) => r.vigente)
              .map((r) => (r.fechaVencimiento ? `${r.nombre} (hasta ${formatearFecha(r.fechaVencimiento)})` : r.nombre))
              .join(', ')}
          </p>
        </ModalExito>
      )}
    </>
  );
}

/* ================================================================== */
/* Lista de cambios (paso "Revisar y guardar" al editar)              */
/* ================================================================== */

interface Cambios {
  correo: { antes: string; despues: string } | null;
  agregados: { rolId: string; vigencia: Vigencia }[];
  quitados: { rolId: string; vigencia: Vigencia }[];
  cambiados: { rolId: string; antes: Vigencia; despues: Vigencia }[];
}

function igualVigencia(a: Vigencia, b: Vigencia) {
  return a.conFecha === b.conFecha && (!a.conFecha || a.fecha === b.fecha);
}

function calcularCambios(cuenta: DetalleDeCuenta, correo: string, iniciales: RolesMarcados, marcados: RolesMarcados): Cambios {
  return {
    correo: correo && correo !== cuenta.correo ? { antes: cuenta.correo, despues: correo } : null,
    agregados: Object.entries(marcados)
      .filter(([id]) => !(id in iniciales))
      .map(([rolId, vigencia]) => ({ rolId, vigencia })),
    quitados: Object.entries(iniciales)
      .filter(([id]) => !(id in marcados))
      .map(([rolId, vigencia]) => ({ rolId, vigencia })),
    cambiados: Object.entries(marcados)
      .filter(([id, v]) => id in iniciales && !igualVigencia(iniciales[id], v))
      .map(([rolId, despues]) => ({ rolId, antes: iniciales[rolId], despues })),
  };
}

/** "2026-10-31" -> "31/10/2026" sin pasar por zonas horarias. */
function formatearFechaDeCampo(fecha: string) {
  const [a, m, d] = fecha.split('-');
  return fecha ? `${d}/${m}/${a}` : '—';
}

function textoDeVigencia(v: Vigencia) {
  return v.conFecha ? `Hasta el ${formatearFechaDeCampo(v.fecha)}` : 'Permanente';
}

function ListaDeCambios({ cambios, nombreDeRol }: { cambios: Cambios; nombreDeRol: (id: string) => string }) {
  const filas = [
    ...(cambios.correo ? [{ que: 'Correo de ingreso', tipo: 'Cambia', antes: cambios.correo.antes, despues: cambios.correo.despues }] : []),
    ...cambios.agregados.map((c) => ({ que: `Rol "${nombreDeRol(c.rolId)}"`, tipo: 'Se agrega', antes: '—', despues: textoDeVigencia(c.vigencia) })),
    ...cambios.cambiados.map((c) => ({ que: `Rol "${nombreDeRol(c.rolId)}"`, tipo: 'Cambia la vigencia', antes: textoDeVigencia(c.antes), despues: textoDeVigencia(c.despues) })),
    ...cambios.quitados.map((c) => ({ que: `Rol "${nombreDeRol(c.rolId)}"`, tipo: 'Se quita', antes: textoDeVigencia(c.vigencia), despues: '—' })),
  ];
  if (filas.length === 0) {
    return <Mensaje tipo="info">Todavía no hay cambios. Vaya a "Cuenta" o "Roles" para modificar algo.</Mensaje>;
  }
  return (
    <div className="tabla-envoltura tabla-compacta">
      <table>
        <caption className="solo-lector">Cambios que se van a guardar</caption>
        <thead>
          <tr>
            <th scope="col">Qué</th>
            <th scope="col">Cambio</th>
            <th scope="col">Antes</th>
            <th scope="col">Después</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td data-etiqueta="Qué">{f.que}</td>
              <td data-etiqueta="Cambio">
                <span className={`chip ${f.tipo === 'Se quita' ? 'chip-advert' : f.tipo === 'Se agrega' ? 'chip-exito' : 'chip-info'}`}>{f.tipo}</span>
              </td>
              <td data-etiqueta="Antes">{f.antes}</td>
              <td data-etiqueta="Después">{f.despues}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
