/*
 * Estado de una cuenta en palabras, con los colores del prototipo.
 * Se usa en la lista y en el detalle, para que digan exactamente lo mismo.
 */
import type { EstadoDeCuenta } from '../../api/usuarios';

interface CuentaConEstado {
  estado: EstadoDeCuenta;
  bloqueadoHasta: string | null;
  debeCambiarContrasena: boolean;
}

export function ChipDeEstadoDeCuenta({ cuenta }: { cuenta: CuentaConEstado }) {
  if (cuenta.estado === 'inactivo') return <span className="chip chip-neutro">● Inactiva</span>;
  if (cuenta.estado === 'bloqueado') return <span className="chip chip-advert">● Bloqueada</span>;
  // Activa pero dentro de los 3 minutos de bloqueo por intentos fallidos.
  if (cuenta.bloqueadoHasta && new Date(cuenta.bloqueadoHasta) > new Date()) {
    return <span className="chip chip-advert">● Bloqueo temporal</span>;
  }
  if (cuenta.debeCambiarContrasena) return <span className="chip chip-info">● Pendiente primer ingreso</span>;
  return <span className="chip chip-exito">● Activa</span>;
}
