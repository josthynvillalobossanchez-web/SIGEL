/*
 * Mapa de rutas de la aplicacion.
 *
 *   Sin sesion:           /iniciar-sesion, /recuperar-contrasena
 *   Contrasena temporal:  /primer-ingreso
 *   Con sesion (marco):   /, /mi-cuenta y "no encontrada", mas:
 *     /usuarios                                  lista (ventanas: ver, permisos, estado)
 *     /usuarios/nuevo                            Crear usuario
 *     /usuarios/:id/editar                       Editar usuario
 *     /usuarios/:id/excepciones/nueva            Agregar excepcion
 *     /usuarios/:id/excepciones/:permisoId/editar  Editar excepcion
 *     /roles                                     roles y catalogo (ventanas: ver, estado)
 *     /roles/nuevo, /roles/:id/editar            Crear rol / Editar rol
 *     /catalogos                                 departamentos, puestos, profesiones (ventanas cortas)
 *
 * Regla (26/09): consultar = ventana; crear o editar = pagina aparte por
 * pasos, con su subseccion en el menu (diseno/menu.ts).
 * /usuarios/:id y /roles/:id (sin "editar") abren la ventana de consulta
 * (?ver=<id> o ?rol=<id>) para que ningun enlace se rompa.
 *
 * Para agregar una pagina: crearla en src/paginas, agregar aqui su <Route>
 * (con <ConPermisos> si pide permisos) y agregarla a src/diseno/menu.ts con
 * los MISMOS permisos.
 */
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import { SesionProveedor } from './sesion/SesionProveedor';
import { ConPermisos, RutaDePrimerIngreso, RutaProtegida, RutaSinSesion } from './sesion/Guardias';
import { IniciarSesion } from './paginas/acceso/IniciarSesion';
import { RecuperarContrasena } from './paginas/acceso/RecuperarContrasena';
import { PrimerIngreso } from './paginas/acceso/PrimerIngreso';
import { Marco } from './diseno/Marco';
import { Inicio } from './paginas/Inicio';
import { ListaDeUsuarios } from './paginas/usuarios/ListaDeUsuarios';
import { PaginaCrearUsuario, PaginaEditarUsuario } from './paginas/usuarios/PaginaUsuario';
import { PaginaExcepcion } from './paginas/usuarios/PaginaExcepcion';
import { RolesYPermisos } from './paginas/roles/RolesYPermisos';
import { PaginaRol } from './paginas/roles/PaginaRol';
import { MiCuenta } from './paginas/cuenta/MiCuenta';
import { Catalogos } from './paginas/catalogos/Catalogos';
import { PaginaNoEncontrada } from './paginas/SinPermiso';
import { GestorDeAyudas } from './componentes/Ayudas';

/** /usuarios/:id -> /usuarios?ver=:id  y  /roles/:id -> /roles?rol=:id */
function Redirigir({ a, parametro }: { a: string; parametro: string }) {
  const { id } = useParams();
  return <Navigate to={`${a}?${parametro}=${encodeURIComponent(id ?? '')}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <SesionProveedor>
        <GestorDeAyudas />
        <Routes>
          <Route element={<RutaSinSesion />}>
            <Route path="/iniciar-sesion" element={<IniciarSesion />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
          </Route>

          <Route element={<RutaDePrimerIngreso />}>
            <Route path="/primer-ingreso" element={<PrimerIngreso />} />
          </Route>

          <Route element={<RutaProtegida />}>
            <Route element={<Marco />}>
              <Route index element={<Inicio />} />
              <Route
                path="/usuarios"
                element={
                  <ConPermisos permisos={['usuarios.ver']}>
                    <ListaDeUsuarios />
                  </ConPermisos>
                }
              />
              <Route
                path="/usuarios/nuevo"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'usuarios.crear']}>
                    <PaginaCrearUsuario />
                  </ConPermisos>
                }
              />
              <Route
                path="/usuarios/:id/editar"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'usuarios.editar']}>
                    <PaginaEditarUsuario />
                  </ConPermisos>
                }
              />
              <Route
                path="/usuarios/:id/excepciones/nueva"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'usuarios.editar']}>
                    <PaginaExcepcion />
                  </ConPermisos>
                }
              />
              <Route
                path="/usuarios/:id/excepciones/:permisoId/editar"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'usuarios.editar']}>
                    <PaginaExcepcion />
                  </ConPermisos>
                }
              />
              <Route path="/usuarios/:id" element={<Redirigir a="/usuarios" parametro="ver" />} />
              <Route
                path="/roles"
                element={
                  <ConPermisos permisos={['usuarios.ver']}>
                    <RolesYPermisos />
                  </ConPermisos>
                }
              />
              <Route
                path="/roles/nuevo"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'roles.editar']}>
                    <PaginaRol />
                  </ConPermisos>
                }
              />
              <Route
                path="/roles/:id/editar"
                element={
                  <ConPermisos permisos={['usuarios.ver', 'roles.editar']}>
                    <PaginaRol />
                  </ConPermisos>
                }
              />
              <Route path="/roles/:id" element={<Redirigir a="/roles" parametro="rol" />} />
              <Route
                path="/catalogos"
                element={
                  <ConPermisos permisos={['catalogos.editar']}>
                    <Catalogos />
                  </ConPermisos>
                }
              />
              <Route path="/mi-cuenta" element={<MiCuenta />} />
              <Route path="*" element={<PaginaNoEncontrada />} />
            </Route>
          </Route>
        </Routes>
      </SesionProveedor>
    </BrowserRouter>
  );
}
