/*
 * Marco de la aplicacion una vez adentro: barra superior, menu lateral y
 * el area de contenido donde se dibuja cada pagina (<Outlet />).
 * Mismo HTML y clases que el prototipo (topbar, layout, lateral, contenido).
 *
 * Comportamiento del menu lateral (igual que el prototipo):
 *   - Pantalla ancha: se puede plegar con el boton redondo (".tirador").
 *     La eleccion se recuerda en localStorage ("sigel-lateral").
 *   - Celular/tableta (< 1024 px): se abre con el boton de hamburguesa y se
 *     cierra al tocar fuera (".velo-nav") o al elegir una opcion.
 *   - Subsecciones ("nav-sub"): las paginas de crear y editar aparecen
 *     debajo de su seccion (ver diseno/menu.ts). La seccion queda marcada
 *     como "en esta seccion" y la subseccion como pagina actual.
 *   - Si la pagina tiene cambios sin guardar, el menu y "Salir" preguntan
 *     antes (componentes/CambiosSinGuardar.tsx).
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { ProveedorDeCambiosSinGuardar, useClicSeguro, useSalirSiSePuede } from '../componentes/CambiosSinGuardar';
import { useSesion } from '../sesion/SesionProveedor';
import { Icono } from '../componentes/Icono';
import { BotonTema } from '../componentes/BotonTema';
import { MENU } from './menu';
import { inicialesDesdeCorreo } from '../utilidades/texto';
import logoParaBarra from '../recursos/logo-oscuro.png';

const CLAVE_LATERAL = 'sigel-lateral';

function lateralGuardadoOculto(): boolean {
  try {
    return localStorage.getItem(CLAVE_LATERAL) === 'oculto';
  } catch {
    return false;
  }
}

/** El marco completo, dentro del proveedor de "cambios sin guardar". */
export function Marco() {
  return (
    <ProveedorDeCambiosSinGuardar>
      <MarcoInterno />
    </ProveedorDeCambiosSinGuardar>
  );
}

function MarcoInterno() {
  const { usuario, salir, tienePermisos } = useSesion();
  const clicSeguro = useClicSeguro();
  const salirSiSePuede = useSalirSiSePuede();
  const ubicacion = useLocation();

  const [lateralOculto, setLateralOculto] = useState(lateralGuardadoOculto);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  // Al cambiar de pagina se cierra el menu del celular.
  useEffect(() => setMenuMovilAbierto(false), [ubicacion.pathname]);

  // Tecla Escape cierra el menu del celular.
  useEffect(() => {
    if (!menuMovilAbierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setMenuMovilAbierto(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [menuMovilAbierto]);

  function plegarLateral() {
    const nuevo = !lateralOculto;
    setLateralOculto(nuevo);
    try {
      localStorage.setItem(CLAVE_LATERAL, nuevo ? 'oculto' : 'visible');
    } catch {
      // Sin almacenamiento: la preferencia dura solo esta visita.
    }
  }

  if (!usuario) return null; // RutaProtegida ya garantiza que hay usuario.

  // Solo los grupos con al menos una opcion permitida, y en cada opcion
  // solo las subsecciones permitidas (las de contexto, si se esta en ellas).
  const ruta = ubicacion.pathname;
  const gruposVisibles = MENU.map((grupo) => ({
    ...grupo,
    opciones: grupo.opciones
      .filter((o) => tienePermisos(...o.permisos))
      .map((o) => ({
        ...o,
        subopciones: (o.subopciones ?? [])
          .filter((sub) => tienePermisos(...sub.permisos))
          .filter((sub) => sub.ruta || sub.patron?.test(ruta))
          .map((sub) => ({ texto: sub.texto, ruta: sub.ruta ?? ruta })),
      })),
  })).filter((grupo) => grupo.opciones.length > 0);

  const textoTirador = lateralOculto ? 'Mostrar el menú lateral' : 'Ocultar el menú lateral';
  // Los roles solo se muestran como informacion (no deciden nada en pantalla).
  const textoRoles = usuario.roles.length ? usuario.roles.join(' · ') : 'Sin roles vigentes';

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>

      <header className="topbar">
        <button
          className="menu-btn"
          type="button"
          aria-label={menuMovilAbierto ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={menuMovilAbierto}
          aria-controls="lateral"
          data-ayuda={menuMovilAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
          onClick={() => setMenuMovilAbierto((v) => !v)}
        >
          <Icono nombre="menu" tamano={24} />
        </button>

        <div className="marca">
          <img src={logoParaBarra} alt="Municipalidad de Palmares" />
          <div className="marca-txt">
            <b>SIGEL</b>
            <small>Municipalidad de Palmares</small>
          </div>
        </div>

        <div className="topbar-fin">
          <BotonTema clase="tb-btn" />
          <div className="usuario">
            <div className="usuario-inicial" aria-hidden="true">
              {inicialesDesdeCorreo(usuario.correo)}
            </div>
            <div className="usuario-txt">
              <b>{usuario.correo}</b>
              <span>{textoRoles}</span>
            </div>
          </div>
          <button className="tb-btn" type="button" onClick={() => salirSiSePuede(() => void salir())} aria-label="Cerrar sesión" data-ayuda="Cerrar sesión y volver al inicio de sesión">
            <Icono nombre="salir" />
            <span className="solo-ancho">Salir</span>
          </button>
        </div>
      </header>

      <div
        className="velo-nav"
        data-abierto={menuMovilAbierto ? 'si' : 'no'}
        onClick={() => setMenuMovilAbierto(false)}
        aria-hidden="true"
      />

      <div className="layout" data-lateral={lateralOculto ? 'oculto' : 'visible'}>
        <nav className="lateral" id="lateral" aria-label="Navegación principal" data-abierto={menuMovilAbierto ? 'si' : 'no'}>
          {gruposVisibles.map((grupo) => (
            <div className="nav-grupo" key={grupo.titulo}>
              <p className="nav-titulo">{grupo.titulo}</p>
              {grupo.opciones.map((opcion) => (
                <div key={opcion.ruta} style={{ display: 'contents' }}>
                  {/* NavLink pone aria-current="page" en la opcion activa (el CSS la resalta).
                      "end": la seccion solo es "la pagina actual" en su propia direccion; en
                      sus subpaginas queda marcada con data-en-seccion. */}
                  <NavLink
                    className="nav-item"
                    to={opcion.ruta}
                    end
                    data-en-seccion={ruta.startsWith(`${opcion.ruta}/`) && opcion.ruta !== '/' ? 'si' : undefined}
                    onClick={(e) => clicSeguro(e, opcion.ruta)}
                  >
                    <Icono nombre={opcion.icono} clase="ico" />
                    {opcion.texto}
                  </NavLink>
                  {opcion.subopciones.length > 0 && (
                    <div className="nav-sub" role="group" aria-label={`Subsecciones de ${opcion.texto}`}>
                      {opcion.subopciones.map((sub) => (
                        <NavLink className="nav-sub-item" to={sub.ruta} end key={sub.texto} onClick={(e) => clicSeguro(e, sub.ruta)}>
                          {sub.texto}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          <p style={{ marginTop: 'auto', padding: 12, fontSize: 11.5, color: 'var(--texto-sec)', lineHeight: 1.5 }}>
            Los módulos de funcionarios, expediente, vacaciones, incapacidades, horas extra y Talent Pool se irán
            agregando en los próximos sprints.
          </p>
        </nav>

        <main className="contenido" id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <button
        className="tirador"
        type="button"
        onClick={plegarLateral}
        data-ayuda={textoTirador}
        aria-label={textoTirador}
        aria-expanded={!lateralOculto}
        aria-controls="lateral"
        style={{ left: lateralOculto ? 8 : 236 }}
      >
        <span style={{ display: 'grid', transform: lateralOculto ? 'rotate(180deg)' : 'none' }}>
          <Icono nombre="plegar" tamano={15} grosor={2.4} />
        </span>
      </button>
    </>
  );
}
