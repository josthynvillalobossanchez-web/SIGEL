/*
 * Paginas "Crear rol" (/roles/nuevo) y "Editar rol" (/roles/:id/editar).
 * En el menu: Roles y permisos -> Crear rol / Editar rol.
 *
 * Por pasos, para no tener que bajar (FormularioPorPasos):
 *   1. Datos      nombre y para que sirve.
 *   2. Permisos   por modulo: modulos a la izquierda (con cuantos van
 *                 marcados), casillas a la derecha, buscador arriba.
 *   3. Revisar    crear: lo que se va a crear; editar: lo que se agrega y
 *                 se quita, y a cuantas cuentas afecta de inmediato.
 *
 * Reglas (el backend las revisa otra vez; ver bloqueos.ts):
 *   - los roles de sistema y los que tienen permisos que uno no tiene no se
 *     editan (la pagina lo explica y no muestra el formulario);
 *   - un rol que uno mismo tiene: se puede renombrar, pero sus permisos no
 *     (quedan de solo lectura, con la explicacion);
 *   - solo se marcan o desmarcan los permisos que uno tiene (regla 5);
 *   - al menos un permiso.
 *
 * Al editar se guarda todo junto (PATCH /roles/:id) o nada.
 * Al terminar: ventana de exito -> Aceptar -> vuelve a la lista de roles.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { textoDelError } from '../../api/cliente';
import { consultarCatalogoDePermisos, consultarRoles, crearRol, editarRol, type ModuloDePermisos, type RolResumido } from '../../api/roles';
import { useSesion } from '../../sesion/SesionProveedor';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { SelectorPorModulos } from '../../componentes/SelectorPorModulos';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { Migas } from '../../componentes/Migas';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { Icono } from '../../componentes/Icono';
import { nombreDeModulo } from '../../utilidades/texto';
import { bloqueosDeRol } from './bloqueos';

const LISTA = '/roles';
const MOTIVO_NO_ASIGNABLE = 'usted no tiene este permiso: no lo puede agregar ni quitar de un rol (solo se da lo que se tiene).';

export function PaginaRol() {
  const { id } = useParams();
  const { usuario, tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [roles, setRoles] = useState<RolResumido[] | null>(null);
  const [catalogo, setCatalogo] = useState<ModuloDePermisos[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([consultarRoles(), consultarCatalogoDePermisos()])
      .then(([r, c]) => {
        setRoles(r);
        setCatalogo(c);
      })
      .catch((e) => setError(textoDelError(e)));
  }, []);

  const bloqueos = useMemo(
    () =>
      bloqueosDeRol(
        new Set(catalogo?.flatMap((m) => m.permisos.filter((p) => p.asignable).map((p) => p.id)) ?? []),
        tienePermisos('roles.editar'),
        usuario?.roles ?? [],
      ),
    [catalogo, tienePermisos, usuario],
  );

  const editando = Boolean(id);
  const rol = editando ? roles?.find((r) => r.id === id) ?? null : null;
  const noExiste = editando && roles !== null && !rol;
  const bloqueo = rol ? bloqueos.edicion(rol) : null;
  const titulo = editando ? 'Editar rol' : 'Crear rol';

  if (error || !roles || !catalogo || noExiste || bloqueo) {
    return (
      <section className="pagina">
        <Migas migas={[{ texto: 'Roles y permisos', a: LISTA }, { texto: titulo }]} />
        <div className="pagina-cab">
          <div>
            <h1>{titulo}</h1>
            {rol && <p>{rol.nombre}</p>}
          </div>
        </div>
        {!error && !roles && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {noExiste && <Mensaje tipo="error">No se encontró el rol indicado.</Mensaje>}
        {bloqueo && <Mensaje tipo="info">No puede editar este rol: {bloqueo}</Mensaje>}
        {(error || noExiste || bloqueo) && (
          <button className="volver" type="button" onClick={() => navegar(LISTA)}>
            <Icono nombre="volver" tamano={17} /> Volver a roles y permisos
          </button>
        )}
      </section>
    );
  }

  return <FormularioDeRol rol={rol} catalogo={catalogo} bloqueoPermisos={rol ? bloqueos.permisos(rol) : null} />;
}

/* ================================================================== */

function FormularioDeRol({
  rol,
  catalogo,
  bloqueoPermisos,
}: {
  /** null = crear. */
  rol: RolResumido | null;
  catalogo: ModuloDePermisos[];
  /** Por que no se pueden cambiar sus permisos (p. ej. rol propio). */
  bloqueoPermisos: string | null;
}) {
  const editando = Boolean(rol);
  const irSeguro = useIrSeguro();
  const navegar = useNavigate();

  const inicial = useMemo(
    () => ({ nombre: rol?.nombre ?? '', descripcion: rol?.descripcion ?? '', permisos: new Set(rol?.permisoIds ?? []) }),
    [rol],
  );
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [marcados, setMarcados] = useState<Set<string>>(inicial.permisos);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminado, setTerminado] = useState<string | null>(null);

  const asignables = useMemo(() => new Set(catalogo.flatMap((m) => m.permisos.filter((p) => p.asignable).map((p) => p.id))), [catalogo]);
  const todos = useMemo(() => catalogo.flatMap((m) => m.permisos.map((p) => ({ ...p, modulo: m.modulo }))), [catalogo]);

  const agregados = todos.filter((p) => marcados.has(p.id) && !inicial.permisos.has(p.id));
  const quitados = todos.filter((p) => !marcados.has(p.id) && inicial.permisos.has(p.id));
  const cambioNombre = nombre.trim() !== inicial.nombre;
  const cambioDescripcion = descripcion.trim() !== inicial.descripcion.trim();
  const cambioPermisos = agregados.length > 0 || quitados.length > 0;
  const hayCambios = editando ? cambioNombre || cambioDescripcion || cambioPermisos : Boolean(nombre.trim() || descripcion.trim() || marcados.size);
  useCambiosSinGuardar(hayCambios && !terminado);

  function revisarPaso(indice: number): string | null {
    if (indice === 0) {
      const limpio = nombre.trim();
      if (limpio.length < 3 || limpio.length > 60) return 'El nombre del rol debe tener entre 3 y 60 caracteres.';
    }
    if (indice === 1 && marcados.size === 0) return 'Marque al menos un permiso: un rol sin permisos no le sirve a nadie.';
    return null;
  }

  async function guardar() {
    setOcupado(true);
    setError(null);
    try {
      if (!rol) {
        const creado = await crearRol({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, permisoIds: [...marcados] });
        setTerminado(creado.nombre);
      } else {
        const editado = await editarRol(rol.id, {
          nombre: cambioNombre ? nombre.trim() : undefined,
          descripcion: cambioDescripcion ? descripcion.trim() : undefined,
          permisoIds: cambioPermisos ? [...marcados] : undefined,
        });
        setTerminado(editado.nombre);
      }
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  const PASOS: PasoDeFormulario[] = [
    {
      titulo: 'Datos',
      sub: 'Nombre y para qué sirve',
      descripcion: 'El nombre no se puede repetir (sin importar mayúsculas ni tildes). La descripción ayuda a elegir el rol correcto al asignarlo.',
    },
    {
      titulo: 'Permisos',
      sub: 'Qué podrá hacer',
      descripcion: bloqueoPermisos
        ? 'Los permisos de este rol se muestran de solo lectura.'
        : 'Elija un módulo a la izquierda y marque sus permisos. Solo puede marcar los permisos que usted tiene.',
    },
    {
      titulo: editando ? 'Revisar y guardar' : 'Revisar y crear',
      sub: editando ? 'Lo que va a cambiar' : 'Confirmar los datos',
      descripcion: editando
        ? 'Revise los cambios. Se guardan todos juntos, quedan en la bitácora y los permisos aplican de inmediato a las cuentas que tienen el rol.'
        : 'Revise los datos. Después de crearlo, el rol se puede asignar a las cuentas desde Usuarios.',
    },
  ];

  const porModulo = (lista: typeof todos) =>
    [...new Set(lista.map((p) => p.modulo))].map((modulo) => ({ modulo, permisos: lista.filter((p) => p.modulo === modulo) }));

  return (
    <>
      <FormularioPorPasos
        migas={
          rol
            ? [{ texto: 'Roles y permisos', a: LISTA }, { texto: rol.nombre, a: `${LISTA}?rol=${rol.id}` }, { texto: 'Editar rol' }]
            : [{ texto: 'Roles y permisos', a: LISTA }, { texto: 'Crear rol' }]
        }
        titulo={editando ? 'Editar rol' : 'Crear rol'}
        descripcion={
          rol ? (
            <>
              <b>{rol.nombre}</b> · {rol.cantidadUsuarios} cuenta{rol.cantidadUsuarios === 1 ? '' : 's'} lo tiene
              {rol.cantidadUsuarios === 1 ? '' : 'n'}
            </>
          ) : (
            'Un rol agrupa permisos que varias personas necesitan. Los roles creados aquí se pueden editar e inactivar.'
          )
        }
        pasos={PASOS}
        actual={paso}
        alCambiarPaso={setPaso}
        revisarPaso={revisarPaso}
        libre={editando}
        alCancelar={() => irSeguro(LISTA)}
        alGuardar={() => void guardar()}
        textoGuardar={editando ? 'Guardar cambios' : 'Crear rol'}
        bloqueoGuardar={editando && !hayCambios ? 'no hay cambios que guardar.' : null}
        ocupado={ocupado}
        error={error}
        claveDeDatos={JSON.stringify([nombre, descripcion, [...marcados]])}
      >
        {paso === 0 && (
          <div className="campo-fila dos-campos">
            <div className="campo">
              <label htmlFor="rolNombre">
                Nombre del rol <span className="obligatorio">*</span>
              </label>
              <input
                id="rolNombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={60}
                placeholder="Por ejemplo: Encargado de planillas"
                aria-required="true"
                autoComplete="off"
              />
              <span className="ayuda">Entre 3 y 60 caracteres.</span>
            </div>
            <div className="campo">
              <label htmlFor="rolDescripcion">Descripción</label>
              <textarea
                id="rolDescripcion"
                rows={4}
                maxLength={255}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Para qué sirve y a quién se le asigna."
              />
              <span className="ayuda">{255 - descripcion.length} caracteres disponibles.</span>
            </div>
          </div>
        )}

        {paso === 1 && (
          <>
            {bloqueoPermisos && <Mensaje tipo="info">No se pueden cambiar los permisos de este rol: {bloqueoPermisos}</Mensaje>}
            <SelectorPorModulos
              etiqueta={`permisos del rol${nombre.trim() ? ` ${nombre.trim()}` : ''}`}
              modulos={catalogo}
              marcados={marcados}
              alCambiar={bloqueoPermisos ? undefined : setMarcados}
              bloqueoDe={(p) => (asignables.has(p.id) ? null : MOTIVO_NO_ASIGNABLE)}
            />
          </>
        )}

        {paso === 2 && !editando && (
          <dl className="info-rejilla resumen-paso">
            <div className="dato">
              <dt>Nombre</dt>
              <dd>{nombre.trim() || '—'}</dd>
            </div>
            <div className="dato">
              <dt>Descripción</dt>
              <dd>{descripcion.trim() || 'Sin descripción.'}</dd>
            </div>
            <div className="dato" style={{ gridColumn: '1/-1' }}>
              <dt>Permisos ({marcados.size})</dt>
              <dd>
                <ListaPorModulo grupos={porModulo(todos.filter((p) => marcados.has(p.id)))} />
              </dd>
            </div>
          </dl>
        )}

        {paso === 2 && editando && rol && (
          <>
            {!hayCambios && <Mensaje tipo="info">Todavía no hay cambios. Vaya a "Datos" o "Permisos" para modificar algo.</Mensaje>}
            {hayCambios && (
              <dl className="info-rejilla resumen-paso">
                {cambioNombre && (
                  <div className="dato">
                    <dt>Nombre</dt>
                    <dd>
                      {inicial.nombre} → <b>{nombre.trim()}</b>
                    </dd>
                  </div>
                )}
                {cambioDescripcion && (
                  <div className="dato">
                    <dt>Descripción</dt>
                    <dd>{descripcion.trim() || 'Sin descripción.'}</dd>
                  </div>
                )}
                {agregados.length > 0 && (
                  <div className="dato" style={{ gridColumn: '1/-1' }}>
                    <dt>Permisos que se agregan ({agregados.length})</dt>
                    <dd>
                      <ListaPorModulo grupos={porModulo(agregados)} clase="agregado" />
                    </dd>
                  </div>
                )}
                {quitados.length > 0 && (
                  <div className="dato" style={{ gridColumn: '1/-1' }}>
                    <dt>Permisos que se quitan ({quitados.length})</dt>
                    <dd>
                      <ListaPorModulo grupos={porModulo(quitados)} clase="quitado" />
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {cambioPermisos && (
              <Mensaje tipo="advert" icono="info">
                El cambio de permisos se aplica de inmediato a{' '}
                {rol.cantidadUsuarios === 0
                  ? 'las cuentas que tengan este rol (hoy ninguna)'
                  : `${rol.cantidadUsuarios} cuenta${rol.cantidadUsuarios === 1 ? '' : 's'}`}{' '}
                y queda en la bitácora.
              </Mensaje>
            )}
          </>
        )}
      </FormularioPorPasos>

      {terminado && (
        <ModalExito titulo={editando ? 'Rol actualizado con éxito' : 'Rol creado con éxito'} alAceptar={() => navegar(LISTA)}>
          <p>
            {editando ? (
              <>
                Se guardaron los cambios del rol <b>{terminado}</b>. Quedaron registrados en la bitácora.
              </>
            ) : (
              <>
                El rol <b>{terminado}</b> ya existe y se puede asignar a las cuentas desde Usuarios.
              </>
            )}
          </p>
        </ModalExito>
      )}
    </>
  );
}

/** Permisos agrupados por modulo, como pastillas. */
function ListaPorModulo({ grupos, clase }: { grupos: { modulo: string; permisos: { id: string; clave: string }[] }[]; clase?: string }) {
  if (grupos.length === 0) return <>Ninguno.</>;
  return (
    <div className="permisos-agrupados">
      {grupos.map((g) => (
        <div key={g.modulo}>
          <b className="sec-dato">{nombreDeModulo(g.modulo)}</b>
          <div className="pills">
            {g.permisos.map((p) => (
              <span className={`chip-rol${clase ? ` ${clase}` : ''}`} key={p.id}>
                {p.clave}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
