/*
 * Ventana de confirmacion "se hizo con exito" con un solo boton: Aceptar.
 * Se usa despues de crear un usuario o un rol; al Aceptar, la pantalla
 * vuelve a la lista correspondiente.
 */
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { Icono } from './Icono';

export function ModalExito({
  titulo,
  children,
  alAceptar,
}: {
  titulo: string;
  children?: ReactNode;
  alAceptar: () => void;
}) {
  return (
    <Modal
      titulo={titulo}
      icono="exito"
      alCerrar={alAceptar}
      pie={
        <button className="btn btn-primario" type="button" onClick={alAceptar} data-ayuda="Cerrar y volver a la lista">
          <Icono nombre="check" /> Aceptar
        </button>
      }
    >
      <div role="status">{children}</div>
    </Modal>
  );
}
