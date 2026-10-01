/*
 * Ventanas cortas de un documento del expediente:
 *   - ModalEditarDocumento: cambiar titulo, tipo, descripcion o fecha. El
 *     archivo NUNCA se reemplaza (si se subio el equivocado: se da de baja y
 *     se sube el correcto). El tipo nuevo tiene que aceptar el formato.
 *   - ModalBajaDeDocumento: baja logica (el archivo se conserva), con motivo
 *     opcional.
 *   - ModalRestaurarDocumento: solo Recursos Humanos.
 * Las reglas de quien puede cada cosa las decide el backend y llegan en
 * documento.acciones; aqui se vuelven a revisar al enviar.
 */
import { useState } from 'react';
import { textoDelError } from '../../api/cliente';
import {
  darDeBajaDocumento,
  editarDocumento,
  restaurarDocumento,
  type DocumentoDeLista,
  type TipoDeDocumento,
} from '../../api/documentos';
import { BotonConAyuda } from '../../componentes/Botones';
import { CampoFecha } from '../../componentes/CampoFecha';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { aFechaDeCampo, hoyEnCostaRica } from '../../utilidades/fechas';
import { describirFormatos } from '../../utilidades/archivos';

/* ================================================================== */
/* Editar                                                              */
/* ================================================================== */

export function ModalEditarDocumento({
  documento,
  tipos,
  alCerrar,
  alGuardar,
}: {
  documento: DocumentoDeLista;
  /** Todos los tipos (activos o no): se ofrecen los manuales activos que aceptan el formato. */
  tipos: TipoDeDocumento[];
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const [titulo, setTitulo] = useState(documento.titulo);
  const [tipoId, setTipoId] = useState(documento.tipo.id);
  const [descripcion, setDescripcion] = useState(documento.descripcion ?? '');
  const [fecha, setFecha] = useState(aFechaDeCampo(documento.fechaDocumento));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyEnCostaRica();

  // Solo tipos que el documento puede tener: manuales, activos y que acepten su formato (mas el que ya tiene).
  const opciones = tipos.filter((t) => t.id === documento.tipo.id || (t.activo && !t.generadoPorSistema && t.formatos.includes(documento.formato)));

  const cambios = {
    titulo: titulo.trim() !== documento.titulo ? titulo.trim() : undefined,
    tipoDocumentoId: tipoId !== documento.tipo.id ? tipoId : undefined,
    descripcion: descripcion.trim() !== (documento.descripcion ?? '') ? descripcion.trim() : undefined,
    fechaDocumento: fecha !== aFechaDeCampo(documento.fechaDocumento) ? fecha : undefined,
  };
  const hayCambios = Object.values(cambios).some((v) => v !== undefined);

  function revisar(): string | null {
    const limpio = titulo.trim();
    if (limpio.length < 2) return 'Escriba el título (al menos 2 caracteres).';
    if (limpio.length > 180) return 'El título no puede pasar de 180 caracteres.';
    if (fecha && fecha > hoy) return 'La fecha del documento no puede ser futura.';
    return null;
  }

  async function guardar() {
    const problema = revisar();
    if (problema) return setError(problema);
    setOcupado(true);
    setError(null);
    try {
      await editarDocumento(documento.id, cambios);
      alGuardar(`Se guardaron los cambios del documento «${titulo.trim()}».`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo="Editar documento"
      icono="editar"
      descripcion={`${documento.nombreArchivo} · ${documento.formato.toUpperCase()}. El archivo no se cambia: solo sus datos.`}
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      ocupado={ocupado}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado} data-ayuda="Cerrar sin guardar los cambios">
            Cancelar
          </button>
          <BotonConAyuda
            tipo="submit"
            clase="btn btn-primario"
            texto={ocupado ? 'Guardando…' : 'Guardar'}
            ayuda="Guardar los cambios del documento"
            bloqueadoPor={hayCambios ? null : 'no hay cambios que guardar.'}
            ocupado={ocupado}
          />
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="campo">
        <label htmlFor="docTitulo">
          Título <span className="obligatorio">*</span>
        </label>
        <input id="docTitulo" value={titulo} onChange={(e) => { setTitulo(e.target.value); setError(null); }} maxLength={180} aria-required="true" autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="docTipo">Tipo de documento</label>
        <select id="docTipo" value={tipoId} onChange={(e) => { setTipoId(e.target.value); setError(null); }} aria-describedby="docTipo-ayuda">
          {opciones.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({describirFormatos(t.formatos)})
            </option>
          ))}
        </select>
        <span className="ayuda" id="docTipo-ayuda">
          Solo aparecen los tipos que aceptan archivos {documento.formato.toUpperCase()}.
        </span>
      </div>
      <div className="campo">
        <label htmlFor="docDescripcion">Descripción</label>
        <textarea id="docDescripcion" rows={2} maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <span className="ayuda">Opcional. {500 - descripcion.length} caracteres disponibles.</span>
      </div>
      <CampoFecha id="docFecha" etiqueta="Fecha del documento" valor={fecha} alCambiar={setFecha} max={hoy} ayuda="Opcional: cuándo se emitió, no cuándo se subió." />
    </Modal>
  );
}

/* ================================================================== */
/* Baja                                                                */
/* ================================================================== */

export function ModalBajaDeDocumento({
  documento,
  esPropio,
  alCerrar,
  alGuardar,
}: {
  documento: DocumentoDeLista;
  /** Es el expediente de quien da de baja (el mensaje cambia). */
  esPropio: boolean;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await darDeBajaDocumento(documento.id, motivo.trim() || undefined);
      alGuardar(`Se dio de baja el documento «${documento.titulo}». No se borró: Recursos Humanos puede restaurarlo.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={`Dar de baja «${documento.titulo}»`}
      icono="desactivar"
      descripcion={
        esPropio
          ? 'Deja de aparecer en su expediente. No se borra: Recursos Humanos lo conserva y puede restaurarlo.'
          : 'Deja de aparecer en el expediente. No se borra: se conserva y se puede restaurar.'
      }
      alCerrar={alCerrar}
      alEnviar={() => void confirmar()}
      ocupado={ocupado}
      peligro
      textoConfirmar="Dar de baja"
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="campo">
        <label htmlFor="bajaMotivo">Motivo</label>
        <textarea id="bajaMotivo" rows={2} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-describedby="bajaMotivo-ayuda" />
        <span className="ayuda" id="bajaMotivo-ayuda">
          Opcional, p. ej. «subí el archivo equivocado». {255 - motivo.length} caracteres disponibles.
        </span>
      </div>
    </Modal>
  );
}

/* ================================================================== */
/* Restaurar                                                           */
/* ================================================================== */

export function ModalRestaurarDocumento({
  documento,
  alCerrar,
  alGuardar,
}: {
  documento: DocumentoDeLista;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await restaurarDocumento(documento.id);
      alGuardar(`Se restauró el documento «${documento.titulo}»: vuelve a aparecer en el expediente.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={`Restaurar «${documento.titulo}»`}
      icono="reactivar"
      descripcion="Vuelve a aparecer en el expediente, tal como estaba."
      alCerrar={alCerrar}
      alEnviar={() => void confirmar()}
      ocupado={ocupado}
      textoConfirmar="Restaurar"
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {documento.baja && (
        <p className="modal-doc" style={{ margin: 0 }}>
          Dado de baja{documento.baja.quien ? ` por ${documento.baja.quien}` : ''}
          {documento.baja.motivo ? `. Motivo: ${documento.baja.motivo}` : '.'}
        </p>
      )}
    </Modal>
  );
}
