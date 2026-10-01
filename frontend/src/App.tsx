/*
 * Mapa de rutas de la aplicacion.
 *
 *   Sin sesion:           /iniciar-sesion, /recuperar-contrasena
 *   Contrasena temporal:  /primer-ingreso
 *   Con sesion (marco):   /, /mi-cuenta y "no encontrada", mas:
 *     /funcionarios                              lista (ventanas: ficha, salida, reingreso)
 *     /funcionarios/nuevo, /funcionarios/:id/editar  Registrar / Editar funcionario
 *     /funcionarios/:id/expediente               Expediente laboral (el propio, o RRHH cualquiera)
 *     /mi-expediente                             Mi expediente (solo lectura)
 *     /usuarios                                  lista (ventanas: ver, permisos, estado)
 *     /usuarios/nuevo                            Crear usuario
 *     /usuarios/:id/editar                       Editar usuario
 *     /usuarios/:id/excepciones/nueva            Agregar excepcion
 *     /usuarios/:id/excepciones/:permisoId/editar  Editar excepcion
 *     /roles                                     roles y catalogo (ventanas: ver, estado)
 *     /roles/nuevo, /roles/:id/editar            Crear rol / Editar rol
 *     /funcionarios/:id/expediente/documentos/nuevo  Subir documento al expediente de otra persona (RRHH)
 *     /mi-expediente/documentos/nuevo            Subir documento a mi expediente
 *     /catalogos                                 departamentos, puestos, profesiones (ventanas cortas)
 *     /tipos-documento                           tipos de documento y sus formatos (ventanas cortas)
 *     /calendario                                calendario inteligente (propio, equipo o todos, segun permisos)
 *     /mis-vacaciones, /mis-vacaciones/nueva     saldo y solicitudes propias; pedir vacaciones o permiso
 *     /bandeja                                   solicitudes que le toca resolver a la jefatura
 *     /solicitudes, /solicitudes/nueva           todas las solicitudes y registrar una a nombre de otra persona (RRHH)
 *     /feriados                                  feriados y dias no laborables (RRHH)
 *
 * Regla (26/09): consultar = ventana; crear o editar = pagina aparte por
 * pasos, con su subseccion en el menu (diseno/menu.ts). El expediente es la
 * excepcion de consulta: tiene tantas pestanas que va en pagina propia (como
 * pgExpediente del prototipo).
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
import { PaginaExpediente, PaginaMiExpediente } from './paginas/expediente/Expediente';
import { PaginaSubirDocumentoAjeno, PaginaSubirMiDocumento } from './paginas/expediente/PaginaSubirDocumento';
import { TiposDeDocumento } from './paginas/tiposDocumento/TiposDeDocumento';
import { MiCuenta } from './paginas/cuenta/MiCuenta';
import { Catalogos } from './paginas/catalogos/Catalogos';
import { ListaDeFuncionarios } from './paginas/funcionarios/ListaDeFuncionarios';
import { PaginaEditarFuncionario, PaginaRegistrarFuncionario } from './paginas/funcionarios/PaginaFuncionario';
import { Calendario } from './paginas/calendario/Calendario';
import { MisVacaciones } from './paginas/vacaciones/MisVacaciones';
import { NuevaSolicitud } from './paginas/vacaciones/NuevaSolicitud';
import { BandejaDeJefatura } from './paginas/vacaciones/BandejaDeJefatura';
import { TodasLasSolicitudes } from './paginas/vacaciones/TodasLasSolicitudes';
import { Feriados } from './paginas/vacaciones/Feriados';
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
                path="/funcionarios"
                element={
                  <ConPermisos permisos={['funcionarios.ver']}>
                    <ListaDeFuncionarios />
                  </ConPermisos>
                }
              />
              <Route
                path="/funcionarios/nuevo"
                element={
                  <ConPermisos permisos={['funcionarios.ver', 'funcionarios.crear']}>
                    <PaginaRegistrarFuncionario />
                  </ConPermisos>
                }
              />
              <Route
                path="/funcionarios/:id/editar"
                element={
                  <ConPermisos permisos={['funcionarios.ver', 'funcionarios.editar']}>
                    <PaginaEditarFuncionario />
                  </ConPermisos>
                }
              />
              <Route
                path="/funcionarios/:id/expediente"
                element={
                  <ConPermisos permisos={['expediente.ver']}>
                    <PaginaExpediente />
                  </ConPermisos>
                }
              />
              <Route
                path="/funcionarios/:id/expediente/documentos/nuevo"
                element={
                  <ConPermisos permisos={['expediente.ver', 'documentos.crear']}>
                    <PaginaSubirDocumentoAjeno />
                  </ConPermisos>
                }
              />
              <Route path="/funcionarios/:id" element={<Redirigir a="/funcionarios" parametro="ver" />} />
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
              <Route
                path="/tipos-documento"
                element={
                  <ConPermisos permisos={['tiposDocumento.editar']}>
                    <TiposDeDocumento />
                  </ConPermisos>
                }
              />
              <Route path="/mi-cuenta" element={<MiCuenta />} />
              <Route
                path="/mi-expediente"
                element={
                  <ConPermisos permisos={['expediente.ver']}>
                    <PaginaMiExpediente />
                  </ConPermisos>
                }
              />
              <Route
                path="/mi-expediente/documentos/nuevo"
                element={
                  <ConPermisos permisos={['expediente.ver', 'documentos.crear']}>
                    <PaginaSubirMiDocumento />
                  </ConPermisos>
                }
              />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/mis-vacaciones" element={<MisVacaciones />} />
              <Route
                path="/mis-vacaciones/nueva"
                element={
                  <ConPermisos permisos={['solicitudes.crear']}>
                    <NuevaSolicitud />
                  </ConPermisos>
                }
              />
              <Route
                path="/bandeja"
                element={
                  <ConPermisos permisos={['solicitudes.aprobar']}>
                    <BandejaDeJefatura />
                  </ConPermisos>
                }
              />
              <Route
                path="/solicitudes"
                element={
                  <ConPermisos permisos={['solicitudes.administrar']}>
                    <TodasLasSolicitudes />
                  </ConPermisos>
                }
              />
              <Route
                path="/registrar-solicitud"
                element={
                  <ConPermisos algunoDe={['solicitudes.administrar', 'solicitudes.aprobar']}>
                    <NuevaSolicitud paraOtraPersona />
                  </ConPermisos>
                }
              />
              {/* Direcciones anteriores (01/10): se movieron. */}
              <Route path="/solicitudes/nueva" element={<Navigate to="/registrar-solicitud" replace />} />
              <Route path="/feriados" element={<Navigate to="/calendario/feriados" replace />} />
              <Route
                path="/calendario/feriados"
                element={
                  <ConPermisos permisos={['catalogos.editar']}>
                    <Feriados />
                  </ConPermisos>
                }
              />
              <Route path="*" element={<PaginaNoEncontrada />} />
            </Route>
          </Route>
        </Routes>
      </SesionProveedor>
    </BrowserRouter>
  );
}
