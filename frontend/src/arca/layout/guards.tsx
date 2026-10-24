import { Link, Navigate, Outlet } from 'react-router';
import type { Role } from '../lib/roles';
import { useSession } from '../store/session';

/**
 * Rutas de ARCA. La sesion ya la exige el sistema (RutaProtegida); aqui se
 * espera a saber el rol de cobro y se explica si la cuenta no tiene acceso.
 */
export function RequireAuth() {
  const { status, user } = useSession();
  if (status === 'loading') return <div role="status" style={{ padding: 32 }}>Cargando…</div>;
  if (status === 'sinAcceso') {
    return (
      <div role="alert" style={{ padding: 32, maxWidth: 560 }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Sin acceso al cobro</h1>
        <p style={{ marginBottom: 12 }}>Su cuenta no tiene permiso para el cobro de las piscinas. Si lo necesita, pídale a un administrador el rol Cajero o Supervisor de caja.</p>
        <p>
          <Link to="/">Volver al inicio</Link>
        </p>
      </div>
    );
  }
  if (status === 'anon' || !user) return <Navigate to="/iniciar-sesion" replace />;
  return <Outlet />;
}

/** Restringe una ruta a ciertos roles; los demás vuelven al inicio de ARCA. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const role = useSession((s) => s.user?.role);
  if (!role || !roles.includes(role)) return <Navigate to="/cobro" replace />;
  return <Outlet />;
}
