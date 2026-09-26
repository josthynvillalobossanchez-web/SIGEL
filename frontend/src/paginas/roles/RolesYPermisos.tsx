/*
 * Pagina "Roles y permisos" (seccion pgRoles del prototipo). Ver pide
 * "usuarios.ver"; cambiar algo pide "roles.editar".
 *
 * Dos pestanas:
 *   Roles                 Tabla de roles con sus acciones en cada fila
 *                         (Editar rol, Activar/Inactivar). Tocar la fila abre
 *                         la ventana "Ver rol" (solo lectura). Crear y editar
 *                         son paginas aparte (/roles/nuevo, /roles/:id/editar).
 *   Catalogo de permisos  Consulta: que permisos existen, que hace cada uno
 *                         y que roles lo incluyen. No se crean permisos desde
 *                         aqui: cada permiso nace con la funcionalidad que
 *                         protege (un permiso sin codigo detras no hace nada).
 *
 * Que se bloquea y por que: ver bloqueos.ts (el motivo sale al pasar el
 * mouse, al llegar con Tab o al tocar el boton en el celular).
 *
 * La pestana y el rol abierto van en la URL (?pestana=permisos, ?rol=<id>).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { textoDelError } from '../../api/cliente';
import { useParametrosEnUrl } from '../../utilidades/parametrosEnUrl';
import { consultarCatalogoDePermisos, consultarRoles, type ModuloDePermisos, type RolResumido } from '../../api/roles';
import { useSesion } from '../../sesion/SesionProveedor';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { PanelDePestana, Pestanas } from '../../componentes/Pestanas';
import { nombreDeModulo } from '../../utilidades/texto';
import { ModalEstadoDeRol, ModalVerRol } from './ModalesDeRol';
import { bloqueosDeRol } from './bloqueos';

export function RolesYPermisos() {
  const { usuario, tienePermisos } = useSesion();
  const navegar = useNavigate();
  const [parametros, cambiar] = useParametrosEnUrl();
  const pestana = parametros.get('pestana') === 'permisos' ? 'permisos' : 'roles';
  const verId = parametros.get('rol');

  const [roles, setRoles] = useState<RolResumido[] | null>(null);
  const [catalogo, setCatalogo] = useState<ModuloDePermisos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [estadoDe, setEstadoDe] = useState<RolResumido | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [listaDeRoles, cat] = await Promise.all([consultarRoles(), consultarCatalogoDePermisos()]);
      setRoles(listaDeRoles);
      setCatalogo(cat);
    } catch (e) {
      setError(textoDelError(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);


  const puedeAdministrar = tienePermisos('roles.editar');
  const bloqueos = useMemo(
    () =>
      bloqueosDeRol(
        new Set(catalogo?.flatMap((m) => m.permisos.filter((p) => p.asignable).map((p) => p.id)) ?? []),
        puedeAdministrar,
        usuario?.roles ?? [],
      ),
    [catalogo, puedeAdministrar, usuario],
  );

  const rolVisto = roles?.find((r) => r.id === verId) ?? null;

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Roles y permisos</h1>
          <p>
            Pantalla única de configuración de seguridad. Los permisos se definen por clave{' '}
            <span className="clave">módulo.acción</span>, para no amarrar las validaciones a un rol fijo. Toque un rol para
            ver sus permisos.
          </p>
        </div>
        <div className="acc">
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto="Crear rol"
            ayuda="Crear un rol nuevo con la combinación de permisos que necesite"
            bloqueadoPor={puedeAdministrar ? null : 'su cuenta no tiene permiso para administrar roles.'}
            alHacerClic={() => navegar('/roles/nuevo')}
          />
        </div>
      </div>

      <Pestanas
        prefijo="rp"
        etiqueta="Configuración de seguridad"
        actual={pestana}
        alCambiar={(id) => cambiar({ pestana: id === 'permisos' ? 'permisos' : '' })}
        opciones={[
          { id: 'roles', texto: 'Roles', cuenta: roles?.length },
          { id: 'permisos', texto: 'Catálogo de permisos', cuenta: catalogo?.reduce((n, m) => n + m.permisos.length, 0) },
        ]}
      />

      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!roles && !error && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}

      {/* ======================= Pestana Roles ======================= */}
      <PanelDePestana id="roles" actual={pestana} prefijo="rp">
        {roles && catalogo && (
          <div className="tabla-envoltura">
            <table>
              <caption className="solo-lector">Roles. Toque una fila para ver sus permisos; las acciones están en la última columna.</caption>
              <thead>
                <tr>
                  <th scope="col">Rol</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">
                    Permisos
                  </th>
                  <th scope="col" className="num">
                    Cuentas
                  </th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((rol) => (
                  <tr
                    key={rol.id}
                    data-abrible
                    tabIndex={0}
                    onClick={() => cambiar({ rol: rol.id })}
                    onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && cambiar({ rol: rol.id })}
                    aria-label={`${rol.nombre}. Presione Enter para ver sus permisos.`}
                  >
                    <td data-etiqueta="Rol">
                      <span className="nom-rol">{rol.nombre}</span>
                      <span className="desc-rol">{rol.descripcion ?? 'Sin descripción.'}</span>
                    </td>
                    <td data-etiqueta="Tipo">
                      {rol.esSistema ? <span className="chip chip-info">De sistema</span> : <span className="chip chip-neutro">Propio</span>}
                    </td>
                    <td data-etiqueta="Permisos" className="num">
                      {rol.cantidadPermisos}
                    </td>
                    <td data-etiqueta="Cuentas" className="num">
                      {rol.cantidadUsuarios}
                    </td>
                    <td data-etiqueta="Estado">
                      {rol.activo ? <span className="chip chip-exito">● Activo</span> : <span className="chip chip-neutro">● Inactivo</span>}
                    </td>
                    <td className="acciones">
                      <BotonIcono
                        icono="editar"
                        texto="Editar rol"
                        sobre={rol.nombre}
                        bloqueadoPor={bloqueos.edicion(rol)}
                        alHacerClic={() => navegar(`/roles/${rol.id}/editar`)}
                      />
                      <BotonIcono
                        icono="candado"
                        peligro={rol.activo}
                        texto={rol.activo ? 'Inactivar rol' : 'Activar rol'}
                        sobre={rol.nombre}
                        bloqueadoPor={bloqueos.estado(rol)}
                        alHacerClic={() => setEstadoDe(rol)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelDePestana>

      {/* ================= Pestana Catalogo de permisos ================= */}
      <PanelDePestana id="permisos" actual={pestana} prefijo="rp">
        {roles && catalogo && (
          <>
            <p className="nota-pagina">
              Consulta de los permisos que existen y qué roles los incluyen. Los permisos no se crean desde aquí: cada
              uno nace con la funcionalidad que protege (un permiso sin código detrás no haría nada). Para dar un
              permiso a alguien, asígnele un rol que lo incluya o use los permisos individuales de su cuenta.
            </p>
            <div className="tabla-envoltura tabla-alta">
              <table>
                <caption className="solo-lector">Catálogo de permisos y roles que incluyen cada uno</caption>
                <thead>
                  <tr>
                    <th scope="col">Clave</th>
                    <th scope="col">Módulo</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Roles que lo incluyen</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogo.flatMap((modulo) =>
                    modulo.permisos.map((permiso) => {
                      const incluyen = roles.filter((r) => r.permisoIds.includes(permiso.id));
                      return (
                        <tr key={permiso.id}>
                          <td data-etiqueta="Clave">
                            <span className="clave">{permiso.clave}</span>
                          </td>
                          <td data-etiqueta="Módulo">{nombreDeModulo(modulo.modulo)}</td>
                          <td data-etiqueta="Descripción">{permiso.descripcion ?? '—'}</td>
                          <td data-etiqueta="Roles">
                            <div className="pills">
                              {incluyen.length === 0 ? (
                                <span className="chip-rol">Ningún rol</span>
                              ) : (
                                incluyen.map((r) => (
                                  <span className={`chip-rol${r.esSistema ? ' sistema' : ''}`} key={r.id}>
                                    {r.nombre}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelDePestana>

      {/* ---------------- Ventanas ---------------- */}
      {verId && catalogo && (
        <ModalVerRol
          rolId={verId}
          catalogo={catalogo}
          bloqueoEditar={rolVisto ? bloqueos.edicion(rolVisto) : null}
          alCerrar={() => cambiar({ rol: '' })}
          alEditar={() => navegar(`/roles/${verId}/editar`)}
        />
      )}
      {estadoDe && (
        <ModalEstadoDeRol
          rol={estadoDe}
          alCerrar={() => setEstadoDe(null)}
          alGuardar={(texto) => {
            setEstadoDe(null);
            setAviso(texto);
            setError(null);
            void cargar();
          }}
        />
      )}
    </section>
  );
}
