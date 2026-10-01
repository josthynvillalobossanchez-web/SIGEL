/*
 * Pantallas de estado general: cargando la sesion, y servidor sin respuesta.
 */
import { useSesion } from '../sesion/SesionProveedor';
import { PantallaDeAcceso } from '../componentes/PantallaDeAcceso';
import { Mensaje } from '../componentes/Mensaje';

/** Se ve un instante al abrir la aplicacion, mientras se pregunta por la sesion. */
export function PantallaDeCarga() {
  return (
    <div className="carga-inicial" role="status" aria-live="polite">
      <span className="girador" aria-hidden="true" />
      <span>Cargando SINERGIA…</span>
    </div>
  );
}

/** El backend no respondio (apagado, sin red, o error 5xx). */
export function SinServidor() {
  const { recargar } = useSesion();
  return (
    <PantallaDeAcceso subtitulo="Sistema Integrado de Nómina, Expediente, Recursos y Gestión de Incapacidades y Ausencias · Municipalidad de Palmares">
      <div className="card">
        <h1>No hay conexión con el sistema</h1>
        <p className="sub">SINERGIA no respondió. Puede ser un problema de red o que el servidor esté en mantenimiento.</p>
        <Mensaje tipo="info">Si el problema continúa, avise al Departamento de TI.</Mensaje>
        <button className="btn btn-primario btn-bloque" type="button" data-ayuda="Volver a intentar la conexión con el sistema" onClick={() => void recargar()}>
          Intentar de nuevo
        </button>
      </div>
    </PantallaDeAcceso>
  );
}
