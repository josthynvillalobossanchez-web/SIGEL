/*
 * Ventana para cambiar o quitar la fotografia de perfil.
 *
 * La usan Mi cuenta (cada persona la suya) y el expediente (Recursos
 * Humanos la de cualquiera). Reglas: JPG o PNG, maximo 5 MB. El backend
 * revisa ademas la firma real del archivo y los permisos (nadie cambia la
 * foto de una persona con mas acceso que el).
 *
 * Muestra la foto nueva ANTES de guardar (vista previa con una direccion
 * temporal del navegador, que se libera al cerrar).
 */
import { useEffect, useRef, useState } from 'react';
import { textoDelError } from '../api/cliente';
import { cambiarFoto, quitarFoto } from '../api/documentos';
import { describirFormatos, formatearTamano, problemaDeArchivo, TAMANO_MAXIMO_FOTO } from '../utilidades/archivos';
import { Mensaje } from './Mensaje';
import { Modal } from './Modal';
import { ZonaDeArchivo } from './ZonaDeArchivo';

const FORMATOS_DE_FOTO = ['jpg', 'png'] as const;

export function ModalFoto({
  funcionarioId,
  nombre,
  tieneFoto,
  esPropia,
  alCerrar,
  alGuardar,
}: {
  funcionarioId: string;
  /** Nombre de la persona, para el texto ("Cambiar la fotografía de ..."). */
  nombre: string;
  tieneFoto: boolean;
  esPropia: boolean;
  alCerrar: () => void;
  /** Se guardo o se quito: la pagina recarga la foto y muestra el aviso. */
  alGuardar: (tieneFotoAhora: boolean, aviso: string) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  // La vista previa usa memoria del navegador: se libera al cambiar o cerrar.
  useEffect(() => {
    if (!archivo) return setVista(null);
    const direccion = URL.createObjectURL(archivo);
    setVista(direccion);
    return () => URL.revokeObjectURL(direccion);
  }, [archivo]);

  function elegir(nuevo: File | undefined) {
    setError(null);
    if (!nuevo) return;
    const encontrado = problemaDeArchivo(nuevo, [...FORMATOS_DE_FOTO], TAMANO_MAXIMO_FOTO);
    setProblema(encontrado);
    setArchivo(encontrado ? null : nuevo);
    if (encontrado && entrada.current) entrada.current.value = '';
  }

  async function guardar() {
    if (!archivo) {
      setProblema('Elija la fotografía.');
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await cambiarFoto(funcionarioId, archivo);
      alGuardar(true, esPropia ? 'Se cambió su fotografía.' : `Se cambió la fotografía de ${nombre}.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  async function quitar() {
    setOcupado(true);
    setError(null);
    try {
      await quitarFoto(funcionarioId);
      alGuardar(false, esPropia ? 'Se quitó su fotografía: se muestran sus iniciales.' : `Se quitó la fotografía de ${nombre}.`);
    } catch (e) {
      setError(textoDelError(e));
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={esPropia ? 'Cambiar mi fotografía' : `Cambiar la fotografía de ${nombre}`}
      icono="camara"
      descripcion={`Formato ${describirFormatos([...FORMATOS_DE_FOTO])}, hasta ${formatearTamano(TAMANO_MAXIMO_FOTO)}. Se guarda cifrada en el servidor.`}
      alCerrar={alCerrar}
      alEnviar={() => void guardar()}
      ocupado={ocupado}
      textoConfirmar="Guardar fotografía"
      confirmarDesactivado={!archivo}
      pie={
        <>
          <button className="btn btn-secundario" type="button" onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </button>
          {tieneFoto && (
            <button
              className="btn btn-secundario"
              type="button"
              onClick={() => void quitar()}
              disabled={ocupado}
              data-ayuda="Quitar la fotografía: se vuelven a mostrar las iniciales"
            >
              Quitar fotografía
            </button>
          )}
          <button
            className="btn btn-primario"
            type="submit"
            disabled={ocupado || !archivo}
            aria-busy={ocupado}
            data-ayuda={archivo ? 'Guardar la fotografía elegida' : 'Elija primero una fotografía'}
          >
            {ocupado ? 'Guardando…' : 'Guardar fotografía'}
          </button>
        </>
      }
    >
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="foto-elegir">
        <div className="foto-vista" aria-hidden="true">
          {vista ? <img src={vista} alt="" /> : <span>?</span>}
        </div>
        <div className="campo" style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="fotoArchivo">Fotografía (JPG o PNG)</label>
          <ZonaDeArchivo
            id="fotoArchivo"
            entradaRef={entrada}
            formatos={[...FORMATOS_DE_FOTO]}
            tamanoMaximo={TAMANO_MAXIMO_FOTO}
            archivo={archivo}
            alElegir={elegir}
            invalido={Boolean(problema)}
            descritoPor="fotoArchivo-nota"
          />
          <span className={problema ? 'msg-error' : 'ayuda'} id="fotoArchivo-nota" role={problema ? 'alert' : undefined}>
            {problema ?? (archivo ? `${archivo.name} · ${formatearTamano(archivo.size)}` : 'Se ve mejor una imagen cuadrada.')}
          </span>
        </div>
      </div>
    </Modal>
  );
}
