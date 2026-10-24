import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { formatDate, formatTime } from '../lib/dates';
import { ROLE_LABEL } from '../lib/roles';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import styles from './ShellLayout.module.css';

/**
 * Estructura de las pantallas de cobro (24/10/2026). Antes ARCA traia su propio
 * menu lateral y encabezado; ahora va dentro del Marco del sistema (misma barra
 * superior y mismo menu, grupo "Cobro"). Aqui solo queda la franja con el
 * estado de la caja y la hora, y los atajos de teclado de la ventanilla.
 */
export function ShellLayout() {
  const { user, cashSession } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const now = useClock();
  const loadSettings = useSettings((s) => s.load);
  useEffect(() => {
    void loadSettings().catch(() => undefined); // si falla se usan los valores por defecto
  }, [loadSettings]);

  // F1 lleva al panel del cobro; F2 fuera de "Nuevo recibo" abre uno (dentro, enfoca la búsqueda de cliente).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/cobro');
      } else if (e.key === 'F2' && pathname !== '/cobro/recibos/nuevo') {
        e.preventDefault();
        navigate('/cobro/recibos/nuevo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pathname]);

  if (!user) return null;
  const open = !!cashSession;

  return (
    <>
      <div className={styles.strip}>
        <span className={`${styles.cash} ${open ? styles.cashOpen : ''}`}>
          <span className={open ? styles.dotOn : styles.dotOff} aria-hidden="true" />
          {open ? `Caja abierta · ${cashSession.cashboxCode}` : 'Caja cerrada'}
        </span>
        <span className={styles.role}>Cobro · {ROLE_LABEL[user.role]}</span>
        <span className={styles.keys}>
          <kbd>F1</kbd> Panel <kbd>F2</kbd> Nuevo recibo
        </span>
        <span className={styles.clock}>
          {formatDate(now)} · {formatTime(now)}
        </span>
      </div>
      <Outlet />
    </>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
