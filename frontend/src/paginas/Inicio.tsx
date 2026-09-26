/*
 * Pagina de inicio: bienvenida y accesos directos a lo que la cuenta puede
 * abrir. Las tarjetas salen del mismo MENU que la barra lateral, asi que
 * al agregar una pagina al menu aparece aqui sola.
 */
import { Link } from 'react-router';
import { useSesion } from '../sesion/SesionProveedor';
import { MENU } from '../diseno/menu';
import { Icono } from '../componentes/Icono';

/** Descripcion corta de cada acceso directo (por ruta). */
const DESCRIPCIONES: Record<string, string> = {
  '/usuarios': 'Cuentas de acceso: crear, editar roles y suplencias, permisos individuales y estado.',
  '/roles': 'Qué permisos da cada rol, roles propios de la Municipalidad y catálogo de permisos.',
  '/catalogos': 'Departamentos, puestos y profesiones que se eligen al registrar a un funcionario.',
  '/mi-cuenta': 'Sus datos personales, sus roles y su contraseña.',
};

export function Inicio() {
  const { usuario, tienePermisos } = useSesion();
  if (!usuario) return null;

  const accesos = MENU.flatMap((grupo) => grupo.opciones).filter(
    (opcion) => opcion.ruta !== '/' && tienePermisos(...opcion.permisos),
  );

  return (
    <section className="pagina">
      <div className="pagina-cab">
        <div>
          <h1>Bienvenido a SIGEL</h1>
          <p>Sistema Integral de Gestión Laboral de la Municipalidad de Palmares.</p>
        </div>
      </div>

      <div className="inicio-rejilla">
        {accesos.map((opcion) => (
          <Link className="inicio-tarjeta" to={opcion.ruta} key={opcion.ruta}>
            <span className="ico-grande">
              <Icono nombre={opcion.icono} tamano={20} />
            </span>
            <b>{opcion.texto}</b>
            <span>{DESCRIPCIONES[opcion.ruta] ?? ''}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
