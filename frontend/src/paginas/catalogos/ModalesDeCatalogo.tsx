/*
 * Ventanas de la pagina "Catalogos de personal" (mdTipoDoc del prototipo).
 * Son procesos CORTOS (uno o dos campos), por eso van en ventana y no en
 * una pagina aparte:
 *   - ModalElemento: crear o editar un departamento, puesto o profesion.
 *     Al crear hay "Guardar y crear otro" para la carga inicial, cuando RRHH
 *     registra muchos seguidos.
 *   - ModalEstadoDeElemento: inactivar o reactivar (confirmacion).
 */
import { useEffect, useRef, useState } from 'react';
import { textoDelError } from '../../api/cliente';
import {
  cambiarEstadoDeElemento,
  crearElemento,
  editarElemento,
  type ElementoDeCatalogo,
  type TipoDeCatalogo,
} from '../../api/catalogos';
import { Modal } from '../../componentes/Modal';
import { Mensaje } from '../../componentes/Mensaje';
import { BotonConAyuda } from '../../componentes/Botones';
import { TEXTOS } from './textos';

/* ================================================================== */
/* Crear / editar                                                      */
/* ================================================================== */

export function ModalElemento({
  tipo,
  elemento,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoDeCatalogo;
  /** Sin elemento es crear. */
  elemento?: ElementoDeCatalogo;
  alCerrar: () => void;
  /**
   * Se guardo. "sigueAbierta" = se uso "Guardar y crear otro": la ventana
   * queda abierta y la pagina solo recarga la lista.
   */
  alGuardar: (guardado: ElementoDeCatalogo, sigueAbierta: boolean) => void;
}) {
  const t = TEXTOS[tipo];
  const editando = Boolean(elemento);
  const [nombre, setNombre] = useState(elemento?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(elemento?.descripcion ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creadoAntes, setCreadoAntes] = useState<string | null>(null);
  const campoNombre = useRef<HTMLInputElement>(null);

  useEffect(() => campoNombre.current?.focus(), []);

  const limpio = nombre.trim();
  const sinCambios = editando && limpio === elemento!.nombre && descripcion.trim() === (elemento!.descripcion ?? '');

  function revisar(): string | null {
    if (limpio.length < 2) return 'Escriba el nombre (al menos 2 caracteres).';
    if (limpio.length > t.largoMaximo) return `El nombre no puede pasar de ${t.largoMaximo} caracteres.`;
    return null;
  }

  async function guardar(crearOtro: boolean) {
    const problema = revisar();
    if (problema) {
      setError(problema);
      campoNombre.current?.focus();
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      if (!elemento) {
        const creado = await crearElemento(tipo, { nombre: limpio, descripcion: descripcion.trim() || undefined });
        alGuardar(creado, crearOtro);
        if (crearOtro) {
          setCreadoAntes(creado.nombre);
          setNombre('');
          setDescripcion('');
          campoNombre.current?.focus();
        }
      } else {
        const editado = await editarElemento(tipo, elemento.id, {
          nombre: limpio !== elemento.nombre ? limpio : undefined,
          descripcion: descripcion.trim() !== (elemento.descripcion ?? '') ? descripcion.trim() : undefined,
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
      titulo={editando ? `Editar ${t.singular}` : `Crear ${t.singular}`}
      icono="carpeta"
      descripcion={t.explicacion}
      alCerrar={alCerrar}
      alEnviar={() => void guardar(false)}
      ocupado={ocupado}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado}>
            {creadoAntes ? 'Cerrar' : 'Cancelar'}
          </button>
          {!editando && (
            <button
              className="btn btn-secundario"
              type="button"
              onClick={() => void guardar(true)}
              disabled={ocupado}
              data-ayuda={`Guardar y dejar la ventana lista para ${t.un} ${t.singular} más`}
            >
              Guardar y crear otr{t.o}
            </button>
          )}
          <BotonConAyuda
            tipo="submit"
            clase="btn btn-primario"
            texto={ocupado ? 'Guardando…' : 'Guardar'}
            ayuda={editando ? 'Guardar los cambios' : `Guardar ${t.el} ${t.singular} y cerrar`}
            bloqueadoPor={sinCambios ? 'no hay cambios que guardar.' : null}
            ocupado={ocupado}
          />
        </>
      }
    >
      <div aria-live="polite">
        {creadoAntes && !error && (
          <Mensaje tipo="exito">
            Se creó «{creadoAntes}». Puede escribir {t.el === 'la' ? 'la siguiente' : 'el siguiente'}.
          </Mensaje>
        )}
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="campo">
        <label htmlFor="catNombre">
          Nombre <span className="obligatorio">*</span>
        </label>
        <input
          id="catNombre"
          ref={campoNombre}
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            setError(null);
          }}
          maxLength={t.largoMaximo}
          placeholder={t.ejemplo}
          aria-required="true"
          autoComplete="off"
        />
        <span className="ayuda">No se puede repetir (sin importar mayúsculas ni tildes).</span>
      </div>
      <div className="campo">
        <label htmlFor="catDescripcion">Descripción</label>
        <textarea id="catDescripcion" rows={3} maxLength={255} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <span className="ayuda">Opcional. {255 - descripcion.length} caracteres disponibles.</span>
      </div>
      {editando && elemento!.cantidadFuncionarios > 0 && (
        <Mensaje tipo="info">
          {elemento!.cantidadFuncionarios} funcionario{elemento!.cantidadFuncionarios === 1 ? ' activo lo tiene' : 's activos lo tienen'}: el
          nombre nuevo se verá en su expediente.
        </Mensaje>
      )}
    </Modal>
  );
}

/* ================================================================== */
/* Inactivar / reactivar                                               */
/* ================================================================== */

export function ModalEstadoDeElemento({
  tipo,
  elemento,
  alCerrar,
  alGuardar,
}: {
  tipo: TipoDeCatalogo;
  elemento: ElementoDeCatalogo;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const t = TEXTOS[tipo];
  const activar = !elemento.activo;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enUso = elemento.cantidadFuncionarios;

  async function confirmar() {
    setOcupado(true);
    setError(null);
    try {
      await cambiarEstadoDeElemento(tipo, elemento.id, activar);
      alGuardar(
        activar
          ? `Se reactivó ${t.el} ${t.singular} «${elemento.nombre}»: ya se puede elegir otra vez.`
          : `Se inactivó ${t.el} ${t.singular} «${elemento.nombre}».`,
      );
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={activar ? `Reactivar «${elemento.nombre}»` : `Inactivar «${elemento.nombre}»`}
      icono={activar ? 'reactivar' : 'desactivar'}
      descripcion={
        activar
          ? `${cap(t.el)} ${t.singular} vuelve a aparecer en las listas para elegir.`
          : `${cap(t.el)} ${t.singular} deja de aparecer en las listas para elegir. No se borra: queda en el historial y se puede reactivar.`
      }
      alCerrar={alCerrar}
      alEnviar={() => void confirmar()}
      ocupado={ocupado}
      peligro={!activar}
      textoConfirmar={activar ? 'Reactivar' : 'Inactivar'}
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!activar && enUso > 0 ? (
        <Mensaje tipo="advert" icono="info">
          {enUso} funcionario{enUso === 1 ? ' activo lo tiene' : 's activos lo tienen'} hoy. Lo conservan, pero no se podrá
          elegir para nadie más hasta que lo reactive.
        </Mensaje>
      ) : (
        <p className="modal-doc" style={{ margin: 0 }}>
          {elemento.nombre} · {enUso} funcionario{enUso === 1 ? '' : 's'} activo{enUso === 1 ? '' : 's'}
        </p>
      )}
    </Modal>
  );
}

function cap(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
