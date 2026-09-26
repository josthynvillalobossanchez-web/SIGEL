/*
 * Paginas de "no se puede mostrar": sin permiso y direccion inexistente.
 * Se muestran DENTRO del marco (con menu), para que la persona pueda seguir.
 */
import { Link } from 'react-router';
import { Mensaje } from '../componentes/Mensaje';

export function SinPermiso() {
  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>No tiene permiso para ver esta página</h1>
          <p>Su cuenta no tiene el acceso necesario. Si lo necesita para su trabajo, solicítelo a Recursos Humanos.</p>
        </div>
      </div>
      <Mensaje tipo="info">
        <Link to="/">Volver al inicio</Link>
      </Mensaje>
    </section>
  );
}

export function PaginaNoEncontrada() {
  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Página no encontrada</h1>
          <p>La dirección que abrió no existe en SIGEL. Revise el enlace o use el menú.</p>
        </div>
      </div>
      <Mensaje tipo="info">
        <Link to="/">Volver al inicio</Link>
      </Mensaje>
    </section>
  );
}
