/*
 * Ventanas de la pagina "Tipos de documento" (mdTipoDoc del prototipo).
 *   - ModalTipoDeDocumento: crear o editar. Cada tipo elige cuales formatos
 *     acepta (PDF, JPG, PNG; al menos uno). Los tipos que genera SINERGIA
 *     (constancia, curriculum) solo cambian de nombre: su formato es PDF y
 *     lo produce el sistema.
 *   - ModalEstadoDeTipo: inactivar o reactivar (no se borra nada: los
 *     documentos ya subidos conservan su tipo).
 */
import { useEffect, useRef, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import {
  cambiarEstadoDeTipoDeDocumento,
  crearTipoDeDocumento,
  editarTipoDeDocumento,
  type Formato,
  type TipoDeDocumento,
} from '../../api/documentos';
import { BotonConAyuda } from '../../componentes/Botones';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { describirFormatos, NOMBRE_DE_FORMATO, TODOS_LOS_FORMATOS } from '../../utilidades/archivos';

const DESCRIPCION_DE_FORMATO: Record<Formato, string> = {
  pdf: 'Documento (escaneado o digital)',
  jpg: 'Fotografía o escaneo como imagen',
  png: 'Captura o escaneo como imagen',
};

const mismosFormatos = (a: Formato[], b: Formato[]) => a.length === b.length && a.every((f) => b.includes(f));

/* ================================================================== */
/* Crear / editar                                                      */
/* ================================================================== */

export function ModalTipoDeDocumento({
  tipo,
  alCerrar,
  alGuardar,
}: {
  /** Sin tipo es crear. */
  tipo?: TipoDeDocumento;
  alCerrar: () => void;
  alGuardar: (guardado: TipoDeDocumento, sigueAbierta: boolean) => void;
}) {
  const editando = Boolean(tipo);
  const deSistema = tipo?.generadoPorSistema ?? false;
  const [nombre, setNombre] = useState(tipo?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(tipo?.descripcion ?? '');
  const [formatos, setFormatos] = useState<Formato[]>(tipo?.formatos ?? ['pdf']);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creadoAntes, setCreadoAntes] = useState<string | null>(null);
  const campoNombre = useRef<HTMLInputElement>(null);

  useEffect(() => campoNombre.current?.focus(), []);

  const limpio = nombre.trim();
  const sinCambios =
    editando && limpio === tipo!.nombre && descripcion.trim() === (tipo!.descripcion ?? '') && mismosFormatos(formatos, tipo!.formatos);

  function alternar(formato: Formato) {
    setError(null);
    setFormatos((actuales) => (actuales.includes(formato) ? actuales.filter((f) => f !== formato) : [...actuales, formato]));
  }

  function revisar(): string | null {
    if (limpio.length < 2) return 'Escriba el nombre (al menos 2 caracteres).';
    if (limpio.length > 120) return 'El nombre no puede pasar de 120 caracteres.';
    if (formatos.length === 0) return 'Elija al menos un formato de archivo.';
    return null;
  }

  async function guardar(crearOtro: boolean) {
    const problema = revisar();
    if (problema) {
      setError(problema);
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      if (!tipo) {
        const creado = await crearTipoDeDocumento({ nombre: limpio, descripcion: descripcion.trim() || undefined, formatos });
        alGuardar(creado, crearOtro);
        if (crearOtro) {
          setCreadoAntes(creado.nombre);
          setNombre('');
          setDescripcion('');
          setFormatos(['pdf']);
          campoNombre.current?.focus();
        }
      } else {
        const editado = await editarTipoDeDocumento(tipo.id, {
          nombre: limpio !== tipo.nombre ? limpio : undefined,
          // Los tipos de SINERGIA solo cambian de nombre (el backend tambien lo exige).
          descripcion: !deSistema && descripcion.trim() !== (tipo.descripcion ?? '') ? descripcion.trim() : undefined,
          formatos: !deSistema && !mismosFormatos(formatos, tipo.formatos) ? formatos : undefined,
        });
        alGuardar(editado, false);
      }
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={editando ? 'Editar tipo de documento' : 'Crear tipo de documento'}
      icono="documento"
      descripcion="Los tipos ordenan el expediente y dicen qué formatos de archivo se aceptan al subir un documento."
      alCerrar={alCerrar}
      alEnviar={() => void guardar(false)}
      ocupado={ocupado}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado} data-ayuda={creadoAntes ? 'Cerrar esta ventana' : 'Cerrar sin guardar'}>
            {creadoAntes ? 'Cerrar' : 'Cancelar'}
          </button>
          {!editando && (
            <button
              className="btn btn-secundario"
              type="button"
              data-ayuda="Guardar y dejar la ventana lista para otro tipo más"
              onClick={() => void guardar(true)}
              disabled={ocupado}
            >
              Guardar y crear otro
            </button>
          )}
          <BotonConAyuda
            tipo="submit"
            clase="btn btn-primario"
            texto={ocupado ? 'Guardando…' : 'Guardar'}
            ayuda={editando ? 'Guardar los cambios' : 'Guardar el tipo y cerrar'}
            bloqueadoPor={sinCambios ? 'no hay cambios que guardar.' : null}
            ocupado={ocupado}
          />
        </>
      }
    >
      <div aria-live="polite">{creadoAntes && !error && <Mensaje tipo="exito">Se creó «{creadoAntes}». Puede escribir el siguiente.</Mensaje>}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {deSistema && (
        <Mensaje tipo="info">
          Este documento lo genera SINERGIA en PDF: aquí solo se puede cambiar su nombre. No se puede inactivar.
        </Mensaje>
      )}
      <div className="campo">
        <label htmlFor="tdNombre">
          Nombre <span className="obligatorio">*</span>
        </label>
        <input
          id="tdNombre"
          ref={campoNombre}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setError(null);
          }}
          maxLength={120}
          placeholder="Ej.: Título profesional"
          aria-required="true"
          aria-describedby="tdNombre-ayuda"
          autoComplete="off"
        />
        <span className="ayuda" id="tdNombre-ayuda">
          No se puede repetir (sin importar mayúsculas ni tildes).
        </span>
      </div>
      <div className="campo">
        <label htmlFor="tdDescripcion">Descripción</label>
        <textarea id="tdDescripcion" rows={2} maxLength={255} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={deSistema} />
        <span className="ayuda">Opcional. {255 - descripcion.length} caracteres disponibles.</span>
      </div>
      <fieldset className="campo grupo-formatos" disabled={deSistema}>
        <legend>
          Formatos que acepta <span className="obligatorio">*</span>
        </legend>
        {TODOS_LOS_FORMATOS.map((f) => (
          <label className="check" key={f}>
            <input type="checkbox" checked={formatos.includes(f)} onChange={() => alternar(f)} />
            <span className="txt">
              <b>{NOMBRE_DE_FORMATO[f]}</b>
              <span>{DESCRIPCION_DE_FORMATO[f]}</span>
            </span>
          </label>
        ))}
        <span className="ayuda">Máximo 25 MB por archivo. Se revisa también el contenido real del archivo, no solo su nombre.</span>
      </fieldset>
      {editando && tipo!.cantidadDocumentos > 0 && !deSistema && (
        <Mensaje tipo="info">
          Ya hay {tipo!.cantidadDocumentos} documento{tipo!.cantidadDocumentos === 1 ? '' : 's'} de este tipo. Los formatos que elija solo
          aplican a los que se suban de ahora en adelante.
        </Mensaje>
      )}
    </Modal>
  );
}

/* ================================================================== */
/* Inactivar / reactivar                                               */
/* ================================================================== */

export function ModalEstadoDeTipo({
  tipo,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoDeDocumento;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const activar = !tipo.activo;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await cambiarEstadoDeTipoDeDocumento(tipo.id, activar);
      alGuardar(activar ? `Se reactivó el tipo «${tipo.nombre}»: ya se puede elegir al subir documentos.` : `Se inactivó el tipo «${tipo.nombre}».`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={activar ? `Reactivar «${tipo.nombre}»` : `Inactivar «${tipo.nombre}»`}
      icono={activar ? 'reactivar' : 'desactivar'}
      descripcion={
        activar
          ? 'El tipo vuelve a aparecer al subir documentos.'
          : 'El tipo deja de aparecer al subir documentos. No se borra: los documentos ya subidos lo conservan y se puede reactivar.'
      }
      alCerrar={alCerrar}
      alEnviar={() => void confirmar()}
      ocupado={ocupado}
      peligro={!activar}
      textoConfirmar={activar ? 'Reactivar' : 'Inactivar'}
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <p className="modal-doc" style={{ margin: 0 }}>
        {tipo.nombre} · {describirFormatos(tipo.formatos)} · {tipo.cantidadDocumentos} documento{tipo.cantidadDocumentos === 1 ? '' : 's'}
      </p>
    </Modal>
  );
}
