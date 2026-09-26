/*
 * Ventanas de la pantalla "Roles y permisos":
 *   - ModalVerRol: consulta de un rol (se abre al tocar su fila), en
 *     pestanas Resumen / Permisos, con el boton "Editar rol" que lleva a la
 *     pagina de edicion (o explica por que no se puede).
 *   - ModalEstadoDeRol: activar o inactivar (confirmacion corta).
 * Crear y editar un rol son PAGINAS aparte: PaginaRol.tsx.
 */
import { useEffect, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { cambiarEstadoDeRol, consultarRol, type DetalleDeRol, type ModuloDePermisos, type RolResumido } from '../../api/roles';
import { Modal } from '../../componentes/Modal';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda } from '../../componentes/Botones';
import { PanelDePestana, Pestanas, usePrefijoDePestanas } from '../../componentes/Pestanas';
import { SelectorPorModulos } from '../../componentes/SelectorPorModulos';

/* ================================================================== */
/* Ver rol                                                             */
/* ================================================================== */

export function ModalVerRol({
  rolId,
  catalogo,
  bloqueoEditar,
  alCerrar,
  alEditar,
}: {
  rolId: string;
  catalogo: ModuloDePermisos[];
  /** Por que no se puede editar (null = si se puede). */
  bloqueoEditar: string | null;
  alCerrar: () => void;
  alEditar: () => void;
}) {
  const prefijo = usePrefijoDePestanas();
  const [rol, setRol] = useState<DetalleDeRol | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState('resumen');

  useEffect(() => {
    consultarRol(rolId)
      .then(setRol)
      .catch((e) => setError(textoDelError(e)));
  }, [rolId]);

  const marcados = new Set(rol?.permisos.filter((p) => p.activo).map((p) => p.id) ?? []);

  return (
    <Modal
      titulo={rol?.nombre ?? 'Rol'}
      icono="roles"
      descripcion="Consulta del rol. Para cambiarlo use el botón de editar."
      alCerrar={alCerrar}
      ancho
      cabeceraExtra={
        rol && (
          <div style={{ marginTop: 14 }}>
            <Pestanas
              prefijo={prefijo}
              etiqueta="Información del rol"
              actual={pestana}
              alCambiar={setPestana}
              opciones={[
                { id: 'resumen', texto: 'Resumen' },
                { id: 'permisos', texto: 'Permisos', cuenta: marcados.size },
              ]}
            />
          </div>
        )
      }
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar}>
            Cerrar
          </button>
          {rol && (
            <BotonConAyuda
              clase="btn btn-primario"
              icono="editar"
              texto="Editar rol"
              ayuda="Cambiar el nombre, la descripción y los permisos del rol (se abre la página de edición)"
              bloqueadoPor={bloqueoEditar}
              alHacerClic={alEditar}
            />
          )}
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!rol && !error && <p style={{ color: 'var(--texto-sec)' }}>Cargando…</p>}
      {rol && (
        <>
          <PanelDePestana id="resumen" actual={pestana} prefijo={prefijo}>
            {bloqueoEditar && <Mensaje tipo="info">Solo consulta: {bloqueoEditar}</Mensaje>}
            <dl className="info-rejilla" style={{ padding: 0 }}>
              <div className="dato" style={{ gridColumn: '1/-1' }}>
                <dt>Descripción</dt>
                <dd>{rol.descripcion ?? 'Sin descripción.'}</dd>
              </div>
              <div className="dato">
                <dt>Tipo</dt>
                <dd>{rol.esSistema ? <span className="chip chip-info">De sistema</span> : <span className="chip chip-neutro">Propio</span>}</dd>
              </div>
              <div className="dato">
                <dt>Estado</dt>
                <dd>{rol.activo ? <span className="chip chip-exito">● Activo</span> : <span className="chip chip-neutro">● Inactivo</span>}</dd>
              </div>
              <div className="dato">
                <dt>Permisos</dt>
                <dd className="num">{marcados.size}</dd>
              </div>
              <div className="dato">
                <dt>Cuentas que lo tienen</dt>
                <dd className="num">{rol.cantidadUsuarios}</dd>
              </div>
            </dl>
            <p className="nota-modal" style={{ marginTop: 12 }}>
              {rol.esSistema
                ? 'Los roles de sistema los define la instalación y no se modifican. Si necesita otra combinación de permisos, cree un rol nuevo.'
                : 'Un cambio en los permisos de este rol se aplica de inmediato a todas las cuentas que lo tienen.'}
            </p>
          </PanelDePestana>
          <PanelDePestana id="permisos" actual={pestana} prefijo={prefijo}>
            <SelectorPorModulos etiqueta={`permisos del rol ${rol.nombre}`} modulos={catalogo} marcados={marcados} soloMarcados />
          </PanelDePestana>
        </>
      )}
    </Modal>
  );
}

/* ================================================================== */
/* Activar / inactivar                                                 */
/* ================================================================== */

export function ModalEstadoDeRol({
  rol,
  alCerrar,
  alGuardar,
}: {
  rol: RolResumido;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activar = !rol.activo;

  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await cambiarEstadoDeRol(rol.id, activar);
      alGuardar(activar ? `Rol "${rol.nombre}" activado.` : `Rol "${rol.nombre}" inactivado.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={activar ? `Activar "${rol.nombre}"` : `Inactivar "${rol.nombre}"`}
      icono="candado"
      descripcion={
        activar
          ? 'El rol vuelve a dar sus permisos y se puede asignar otra vez.'
          : 'Un rol inactivo no da permisos y no se puede asignar. No se borra: queda en el historial y se puede reactivar.'
      }
      alCerrar={alCerrar}
      alEnviar={confirmar}
      ocupado={ocupado}
      peligro={!activar}
      textoConfirmar={activar ? 'Activar' : 'Inactivar'}
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <p className="modal-doc" style={{ margin: 0 }}>
        {rol.nombre} · {rol.cantidadPermisos} permisos · {rol.cantidadUsuarios} cuentas
      </p>
    </Modal>
  );
}
