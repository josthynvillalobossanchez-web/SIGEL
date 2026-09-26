/*
 * "Guardias" de las rutas: deciden si una pagina se puede mostrar.
 *
 *   <RutaProtegida>       Pide sesion. Sin sesion -> /iniciar-sesion.
 *                         Con contrasena temporal -> /primer-ingreso.
 *   <RutaDePrimerIngreso> Solo con sesion Y contrasena temporal.
 *   <RutaSinSesion>       Login y recuperacion: si ya hay sesion, al inicio.
 *   <ConPermisos>         Dentro del sistema: si faltan permisos, muestra
 *                         "No tiene permiso" en vez de la pagina.
 *
 * Recordatorio: esto es comodidad para la persona. La seguridad real la
 * aplica el backend en cada llamada (SesionGuard + PermisosGuard).
 */
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSesion } from './SesionProveedor';
import { PantallaDeCarga, SinServidor } from '../paginas/Estados';
import { SinPermiso } from '../paginas/SinPermiso';

export function RutaProtegida() {
  const { estado, usuario, salioPorSuCuenta } = useSesion();
  const ubicacion = useLocation();

  if (estado === 'cargando') return <PantallaDeCarga />;
  if (estado === 'sin-servidor') return <SinServidor />;
  if (estado === 'sin-sesion' || !usuario) {
    // Se guarda a donde queria ir, para volver ahi despues de iniciar sesion
    // (enlace abierto sin sesion, o sesion vencida). No si toco "Salir".
    const estadoDeNavegacion = salioPorSuCuenta ? undefined : { desde: ubicacion.pathname + ubicacion.search };
    return <Navigate to="/iniciar-sesion" replace state={estadoDeNavegacion} />;
  }
  if (usuario.debeCambiarContrasena) return <Navigate to="/primer-ingreso" replace />;
  return <Outlet />;
}

export function RutaDePrimerIngreso() {
  const { estado, usuario } = useSesion();
  if (estado === 'cargando') return <PantallaDeCarga />;
  if (estado === 'sin-servidor') return <SinServidor />;
  if (!usuario) return <Navigate to="/iniciar-sesion" replace />;
  if (!usuario.debeCambiarContrasena) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RutaSinSesion() {
  const { estado, usuario } = useSesion();
  const ubicacion = useLocation();
  if (estado === 'cargando') return <PantallaDeCarga />;
  if (usuario) {
    // Apenas se inicia sesion, esta guardia es la que redirige. Si venia de
    // una pagina protegida (RutaProtegida guardo "desde"), se vuelve ahi.
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    const destino = usuario.debeCambiarContrasena ? '/primer-ingreso' : (desde ?? '/');
    return <Navigate to={destino} replace />;
  }
  // 'sin-servidor' tambien deja ver el login: al intentar entrar se vera el error de conexion.
  return <Outlet />;
}

export function ConPermisos({ permisos, children }: { permisos: string[]; children: ReactNode }) {
  const { tienePermisos } = useSesion();
  return tienePermisos(...permisos) ? <>{children}</> : <SinPermiso />;
}
