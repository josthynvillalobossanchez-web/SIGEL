import { create } from 'zustand';
import { cerrarSesion } from '../../api/autenticacion';
import { authApi } from '../api/endpoints';
import { ApiProblem, onSessionExpired } from '../api/http';
import type { Cashbox, CashSession, MeResponse, UserInfo } from '../api/types';

/**
 * Sesion de ARCA. Desde el 23/10/2026 no hay login propio: la persona ya entro
 * al sistema; aqui solo se lee quien es en ARCA (rol de cobro, caja y sesion de
 * caja abierta) con GET /api/v1/auth/me.
 *
 *   loading     leyendo
 *   auth        con acceso al cobro
 *   sinAcceso   la cuenta no tiene ningun permiso de cobro (403)
 *   anon        la sesion del sistema termino (401): se vuelve a iniciar sesion
 */
interface SessionState {
  status: 'loading' | 'anon' | 'sinAcceso' | 'auth';
  user: UserInfo | null;
  /** Caja de la sesion de caja abierta. */
  cashbox: Cashbox | null;
  /** Sesion de caja abierta del usuario (null: caja cerrada). */
  cashSession: CashSession | null;

  bootstrap: () => Promise<void>;
  /** Cierra la sesion del sistema (es la misma). */
  logout: () => Promise<void>;
  /** Vuelve a leer usuario, caja y sesion de caja (tras abrir o cerrar caja). */
  reload: () => Promise<void>;
  setCashSession: (s: CashSession | null) => void;
}

function applyAuth(data: MeResponse) {
  return { status: 'auth' as const, user: data.user, cashbox: data.cashbox, cashSession: data.session };
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  cashbox: null,
  cashSession: null,

  async bootstrap() {
    try {
      set(applyAuth(await authApi.me()));
    } catch (e) {
      const sinAcceso = e instanceof ApiProblem && e.status === 403;
      set({ status: sinAcceso ? 'sinAcceso' : 'anon', user: null, cashbox: null, cashSession: null });
    }
  },

  async logout() {
    try {
      await cerrarSesion();
    } finally {
      set({ status: 'anon', user: null, cashbox: null, cashSession: null });
      window.location.assign('/iniciar-sesion');
    }
  },

  async reload() {
    set(applyAuth(await authApi.me()));
  },

  setCashSession: (cashSession) => set({ cashSession }),
}));

// Si cualquier llamada responde 401, la sesion del sistema termino: al inicio de sesion.
onSessionExpired(() => {
  if (useSession.getState().status !== 'anon') {
    useSession.setState({ status: 'anon', user: null, cashbox: null, cashSession: null });
    window.location.assign('/iniciar-sesion');
  }
});

export const selectRole = () => useSession.getState().user?.role;
