/*
 * La contrasena temporal de una cuenta recien creada, grande y facil de
 * dictar, con boton para copiarla. Se muestra UNA sola vez.
 */
import { useState } from 'react';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';

export function ContrasenaTemporal({ contrasena }: { contrasena: string }) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(contrasena);
      setCopiada(true);
    } catch {
      // Sin permiso de portapapeles: la persona la copia a mano (el texto se
      // selecciona entero con un clic).
    }
  }

  return (
    <div>
      <span className="etiqueta-campo" id="etqTemporal">
        Contraseña temporal
      </span>
      <div className="contrasena-temporal">
        <code aria-labelledby="etqTemporal">{contrasena}</code>
        <button className="btn btn-secundario" type="button" onClick={copiar} data-ayuda="Copiar la contraseña temporal al portapapeles">
          <Icono nombre="copiar" /> {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <Mensaje tipo="advert" icono="candado">
        También se envió al correo de la cuenta. Entréguela solo si el correo no llega: esta es la única vez que se
        muestra, y la persona deberá cambiarla en su primer ingreso.
      </Mensaje>
    </div>
  );
}
