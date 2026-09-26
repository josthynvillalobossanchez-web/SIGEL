/*
 * Ventanas de las acciones de fila de la lista de usuarios (prototipo):
 *   - ModalPermisosIndividuales (mdPermisos): consulta de las excepciones
 *     de la cuenta (agregar o editar una se hace en PaginaExcepcion.tsx).
 *   - ModalCambiarEstado (mdEstado): activar, inactivar o bloquear. Es una
 *     confirmacion corta (estado + motivo), por eso se queda en ventana.
 * "Editar usuario" es una pagina: PaginaUsuario.tsx.
 *
 * Cada ventana carga lo que necesita al abrirse, valida lo basico antes de
 * enviar (el backend valida todo otra vez), muestra el error sin cerrarse y
 * al salir bien llama alGuardar(textoDelAviso).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { textoDelError } from '../../api/cliente';
import {
  cambiarEstadoDeCuenta,
  consultarCuenta,
  quitarPermisoIndividual,
  type DetalleDeCuenta,
  type EstadoDeCuenta,
  type PermisoIndividual,
} from '../../api/usuarios';
import { consultarCatalogoDePermisos, type ModuloDePermisos } from '../../api/roles';
import { Modal } from '../../componentes/Modal';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda, BotonIcono } from '../../componentes/Botones';
import { useSesion } from '../../sesion/SesionProveedor';
import { formatearFecha } from '../../utilidades/fechas';
import { nombreCompleto } from '../../utilidades/texto';
import { motivoDeBloqueo } from './motivos';

/** Datos minimos de la cuenta sobre la que se actua (vienen de la fila). */
export interface CuentaDeFila {
  id: string;
  correo: string;
  estado: EstadoDeCuenta;
  nombre: string;
}

interface PropiedadesBase {
  cuenta: CuentaDeFila;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}

/** Linea gris con la persona afectada, arriba de cada formulario. */
function Afectada({ cuenta }: { cuenta: CuentaDeFila }) {
  return (
    <p className="modal-doc" style={{ marginTop: 0 }}>
      {cuenta.nombre} · {cuenta.correo}
    </p>
  );
}

/* ================================================================== */
/* Cambiar estado (mdEstado)                                           */
/* ================================================================== */

const OPCIONES_DE_ESTADO: { valor: EstadoDeCuenta; titulo: string; texto: string }[] = [
  { valor: 'activo', titulo: 'Activa', texto: 'Puede ingresar con normalidad.' },
  { valor: 'inactivo', titulo: 'Inactiva', texto: 'La persona dejó de trabajar en la Municipalidad.' },
  {
    valor: 'bloqueado',
    titulo: 'Bloqueada',
    texto:
      'Suspensión del acceso que decide Recursos Humanos, por ejemplo durante una investigación o una licencia larga. Se levanta volviendo a marcar Activa.',
  },
];

export function ModalCambiarEstado({ cuenta, alCerrar, alGuardar }: PropiedadesBase) {
  const [estado, setEstado] = useState<EstadoDeCuenta>(cuenta.estado);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pideMotivo = estado !== 'activo';

  async function guardar() {
    if (estado === cuenta.estado) return setError('La cuenta ya está en ese estado: elija otro.');
    if (pideMotivo && !motivo.trim()) {
      return setError('Indique el motivo: queda en la bitácora y explica después por qué se cortó el acceso.');
    }
    setOcupado(true);
    setError(null);
    try {
      await cambiarEstadoDeCuenta(cuenta.id, estado, motivo.trim() || undefined);
      const titulo = OPCIONES_DE_ESTADO.find((o) => o.valor === estado)?.titulo.toLowerCase();
      alGuardar(`La cuenta de ${cuenta.nombre} quedó ${titulo}. El cambio se aplica de inmediato.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Cambiar estado de la cuenta"
      icono="candado"
      descripcion="La cuenta y todo su historial se conservan. Una cuenta que no esté activa simplemente no puede iniciar sesión."
      alCerrar={alCerrar}
      alEnviar={guardar}
      ocupado={ocupado}
    >
      <Afectada cuenta={cuenta} />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <fieldset className="grupo-opciones">
        <legend className="solo-lector">Estado nuevo de la cuenta</legend>
        {OPCIONES_DE_ESTADO.map((opcion) => (
          <label className="check" key={opcion.valor}>
            <input type="radio" name="estadoCuenta" checked={estado === opcion.valor} onChange={() => setEstado(opcion.valor)} />
            <span className="txt">
              <b>
                {opcion.titulo}
                {opcion.valor === cuenta.estado ? ' (actual)' : ''}
              </b>
              <span>{opcion.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {pideMotivo && (
        <div className="campo">
          <label htmlFor="motivoEstado">
            Motivo <span className="obligatorio">*</span>
          </label>
          <textarea
            id="motivoEstado"
            rows={2}
            maxLength={255}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Queda registrado en la bitácora junto con quién hizo el cambio."
            aria-required="true"
          />
        </div>
      )}
      <Mensaje tipo="info">
        No confundir con el bloqueo de tres minutos por intentos fallidos: ese es automático, temporal y no cambia el
        estado de la cuenta. Al marcar Activa también se levanta ese bloqueo.
      </Mensaje>
    </Modal>
  );
}

/* ================================================================== */
/* Permisos individuales (mdPermisos)                                  */
/* ================================================================== */

/**
 * Consulta de las excepciones vigentes de la cuenta. Desde aqui:
 *   - "Agregar excepcion" y el lapiz de cada una llevan a una PAGINA aparte
 *     (son formularios con muchos permisos: no caben comodos en una ventana);
 *   - la papelera elimina la excepcion aqui mismo, con confirmacion.
 */
export function ModalPermisosIndividuales({
  usuarioId,
  alCerrar,
  alCambiar,
}: {
  usuarioId: string;
  alCerrar: () => void;
  /** Se elimino una excepcion (para recargar la lista de fondo). */
  alCambiar: () => void;
}) {
  const { tienePermisos } = useSesion();
  const irA = useNavigate();
  const [detalle, setDetalle] = useState<DetalleDeCuenta | null>(null);
  const [catalogo, setCatalogo] = useState<ModuloDePermisos[] | null>(null);
  const [porEliminar, setPorEliminar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    consultarCuenta(usuarioId)
      .then(setDetalle)
      .catch((e) => setError(textoDelError(e)));
    consultarCatalogoDePermisos()
      .then(setCatalogo)
      .catch((e) => setError(textoDelError(e)));
  }, [usuarioId]);

  const vigentes = detalle?.permisos.filter((p) => p.vigente) ?? [];
  const asignables = useMemo(() => new Set(catalogo?.flatMap((m) => m.permisos.filter((p) => p.asignable).map((p) => p.clave))), [catalogo]);
  const nombre = detalle ? nombreCompleto(detalle.funcionario) : '';
  // Si la cuenta no se puede modificar, todo queda de consulta (y se explica por que).
  const bloqueoCuenta = detalle ? motivoDeBloqueo('permisos', detalle.motivoNoModificable, tienePermisos) : null;

  async function eliminar(p: PermisoIndividual) {
    setOcupado(true);
    setError(null);
    try {
      setDetalle(await quitarPermisoIndividual(usuarioId, p.id));
      setAviso(`Se eliminó la excepción de ${p.clave}: la cuenta vuelve a lo que dan sus roles.`);
      setPorEliminar(null);
      alCambiar();
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Permisos individuales"
      icono="llave"
      descripcion={
        <>
          Excepciones sobre lo que ya otorgan los roles{nombre && <> de <b>{nombre}</b></>}: sirven para conceder algo
          puntual o para quitarlo, aunque el rol lo dé.
        </>
      }
      alCerrar={alCerrar}
      ancho
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado}>
            Cerrar
          </button>
          <BotonConAyuda
            clase="btn btn-primario"
            icono="mas"
            texto="Agregar excepción"
            ayuda="Conceder o quitar uno o varios permisos puntuales a esta cuenta (se abre una página aparte)"
            bloqueadoPor={detalle ? bloqueoCuenta : 'cargando la cuenta…'}
            alHacerClic={() => irA(`/usuarios/${usuarioId}/excepciones/nueva`)}
          />
        </>
      }
    >
      {detalle && (
        <p className="modal-doc" style={{ marginTop: 0 }}>
          {nombre} · {detalle.correo}
        </p>
      )}
      <div aria-live="polite">{aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {bloqueoCuenta && detalle && <Mensaje tipo="info">Solo consulta: {bloqueoCuenta}</Mensaje>}

      <h3 className="subtitulo-modal">Excepciones vigentes ({vigentes.length})</h3>
      {!detalle ? (
        <p className="nota-modal">Cargando…</p>
      ) : vigentes.length === 0 ? (
        <p className="nota-modal">Esta cuenta no tiene excepciones: tiene exactamente lo que dan sus roles.</p>
      ) : (
        <ul className="lista-excepciones">
          {vigentes.map((p) => {
            // Solo se da o quita lo que uno tiene (reglas 1 y 2).
            const bloqueo = bloqueoCuenta ?? (asignables.has(p.clave) ? null : 'usted no tiene este permiso, así que no puede cambiarlo.');
            return (
              <li key={p.id}>
                <span className="clave">{p.clave}</span>
                {p.otorgado ? <span className="chip chip-info">Concedido</span> : <span className="chip chip-advert">Quitado</span>}
                <span className="sec-dato" style={{ flex: '1 1 120px' }}>
                  {p.fechaVencimiento ? `Hasta ${formatearFecha(p.fechaVencimiento)}` : 'Permanente'}
                  {p.observacion ? ` · ${p.observacion}` : ''}
                </span>
                {porEliminar === p.id ? (
                  <span className="confirmar-en-linea" role="group" aria-label={`Confirmar eliminar ${p.clave}`}>
                    ¿Eliminar?
                    <button className="btn btn-peligro btn-chico" type="button" onClick={() => void eliminar(p)} disabled={ocupado}>
                      Sí, eliminar
                    </button>
                    <button className="btn btn-secundario btn-chico" type="button" onClick={() => setPorEliminar(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <span className="acciones">
                    <BotonIcono
                      icono="editar"
                      texto={`Editar la excepción de ${p.clave}`}
                      bloqueadoPor={bloqueo}
                      alHacerClic={() => irA(`/usuarios/${usuarioId}/excepciones/${p.id}/editar`)}
                    />
                    <BotonIcono
                      icono="basura"
                      peligro
                      texto={`Eliminar la excepción de ${p.clave} (vuelve a lo que dan sus roles)`}
                      bloqueadoPor={bloqueo}
                      alHacerClic={() => setPorEliminar(p.id)}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
