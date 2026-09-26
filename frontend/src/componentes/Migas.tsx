/*
 * Migas de pan del prototipo (clase "migas"): dicen en que parte del
 * sistema esta la persona, por ejemplo  Usuarios > Ana Prueba > Editar usuario.
 * La ultima es la pagina actual (aria-current); las que tienen "a" son
 * enlaces que preguntan antes de salir si hay cambios sin guardar.
 */
import { Fragment } from 'react';
import { EnlaceSeguro } from './CambiosSinGuardar';

export interface Miga {
  texto: string;
  /** Direccion a la que lleva (sin "a" es solo texto). */
  a?: string;
}

export function Migas({ migas }: { migas: Miga[] }) {
  return (
    <nav className="migas" aria-label="Ruta de navegación">
      {migas.map((miga, i) => {
        const ultima = i === migas.length - 1;
        return (
          <Fragment key={i}>
            {ultima ? (
              <span aria-current="page">{miga.texto}</span>
            ) : miga.a ? (
              <EnlaceSeguro a={miga.a}>{miga.texto}</EnlaceSeguro>
            ) : (
              <span>{miga.texto}</span>
            )}
            {!ultima && <span aria-hidden="true">›</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
