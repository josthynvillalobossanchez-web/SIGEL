import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { Kbd } from '../components/Kbd';
import { formatDate, formatTime } from '../lib/dates';
import { ROLE_LABEL } from '../lib/roles';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import { crumbFor, isActive, NAV } from './nav';
import styles from './ShellLayout.module.css';

/** Estructura de la app autenticada: menú lateral + encabezado superior + contenido (padding 32). */
export function ShellLayout() {
  const { user, cashbox, cashSession, logout } = useSession();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const now = useClock();
  const loadSettings = useSettings((s) => s.load);
  useEffect(() => {
    void loadSettings().catch(() => undefined); // si falla se usan los valores por defecto
  }, [loadSettings]);

  // F1 lleva siempre a Inicio; F2 fuera de "Nuevo recibo" abre una (dentro, enfoca la búsqueda de cliente).
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
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const open = !!cashSession;
  const cashLabel = cashbox ? cashbox.code : null;

  return (
    <div className={styles.shell}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className={styles.sidebar} style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }} aria-label="Menú principal">
        <div className={styles.brand}>
          {collapsed ? (
            <img src="/arca/simbolo-blanco.svg" alt="Municipalidad de Palmares" className={styles.symbol} />
          ) : (
            <>
              <img src="/arca/logo-blanco.svg" alt="Municipalidad de Palmares" className={styles.logo} />
              <span className={styles.divider} />
              <span className={styles.brandName}>ARCA</span>
            </>
          )}
        </div>
        <nav className={styles.nav}>
          {items.map((n) => {
            const active = isActive(n, pathname);
            return (
              <Link
                key={n.to}
                to={n.to}
                title={n.label}
                aria-label={collapsed ? n.label : undefined}
                aria-current={active ? 'page' : undefined}
                data-focus-inset
                className={`${styles.navItem} ${active ? styles.active : ''}`}
              >
                <span className={styles.bar} />
                <Icon name={n.icon} size={20} />
                {!collapsed && (
                  <>
                    <span className={styles.navLabel}>{n.label}</span>
                    {n.key && <Kbd inverse>{n.key}</Kbd>}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={styles.footer}>
          {!collapsed && (
            <>
              <div className={styles.userName}>{user.fullName}</div>
              <div>
                {ROLE_LABEL[user.role]}
                {cashLabel ? ` · ${cashLabel}` : ''}
              </div>
              {/* 23/10: la contrasena y el resto del sistema estan fuera de ARCA. */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link to="/mi-cuenta" className={styles.passLink}>
                  Mi cuenta
                </Link>
                <Link to="/" className={styles.passLink}>
                  Gestión de personal
                </Link>
              </div>
              <div className={styles.cashState}>
                <span className={open ? styles.dotOn : styles.dotOff} aria-hidden="true" />
                {open ? 'Caja abierta' : 'Caja cerrada'}
              </div>
              <div className={styles.footerButtons}>
                <button type="button" className={styles.footBtn} onClick={() => void logout()}>
                  <Icon name="logout" size={16} />
                  Salir
                </button>
                <button type="button" className={styles.iconBtn} onClick={toggle} aria-label="Contraer menú" title="Contraer menú">
                  <Icon name="left" size={16} />
                </button>
              </div>
            </>
          )}
          {collapsed && (
            <div className={styles.collapsedButtons}>
              <button type="button" className={styles.iconBtn} onClick={() => void logout()} aria-label="Salir" title="Salir">
                <Icon name="logout" size={16} />
              </button>
              <button type="button" className={styles.iconBtn} onClick={toggle} aria-label="Expandir menú" title="Expandir menú">
                <Icon name="right" size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.crumb}>
            Municipalidad de Palmares, Alajuela · <strong>{crumbFor(pathname)}</strong>
          </div>
          <div className={styles.headerCash}>
            <span className={open ? styles.dotOn : styles.dotOff} aria-hidden="true" />
            {open ? `Caja abierta · ${cashSession.cashboxCode}` : 'Caja cerrada'}
          </div>
          <div>
            {formatDate(now)} · {formatTime(now)}
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
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
