/*
 * Estado de la sesion para toda la aplicacion.
 *
 * Como funciona:
 *   1. Al abrir la aplicacion se pregunta al backend "quien soy"
 *      (GET /api/autenticacion/mi-sesion). La cookie viaja sola.
 *   2. Mientras responde, estado = 'cargando' (se muestra "Cargando...").
 *   3. Si responde 200 -> 'con-sesion' y se guarda la cuenta.
 *      Si responde 401 -> 'sin-sesion' y las rutas protegidas mandan al login.
 *   4. Si en cualquier momento otra llamada recibe 401 (la cookie vencio o
 *      desactivaron la cuenta), cliente.ts avisa y aqui se pasa a 'sin-sesion'.
 *
 * IMPORTANTE (seguridad): que el frontend oculte un boton NO protege nada.
 * Quien protege es el backend (PermisosGuard). Aqui los permisos solo sirven
 * para no mostrarle a la persona opciones que igual le van a dar 403.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { alPerderLaSesion, ErrorDeApi } from '../api/cliente';
import * as apiAutenticacion from '../api/autenticacion';
import type { UsuarioDeSesion } from '../api/autenticacion';

type EstadoDeSesion = 'cargando' | 'sin-sesion' | 'con-sesion' | 'sin-servidor';

interface ValorDeSesion {
  estado: EstadoDeSesion;
  /** La cuenta actual; null si no hay sesion. */
  usuario: UsuarioDeSesion | null;
  /** Inicia sesion. Lanza ErrorDeApi si las credenciales no sirven. */
  entrar: (correo: string, contrasena: string) => Promise<UsuarioDeSesion>;
  /** Cierra la sesion en el backend y en pantalla. Nunca falla. */
  salir: () => Promise<void>;
  /** Vuelve a pedir la sesion (p. ej. despues de cambiar la contrasena). */
  recargar: () => Promise<void>;
  /** true si la cuenta tiene TODOS los permisos indicados (igual que @RequierePermisos). */
  tienePermisos: (...codigos: string[]) => boolean;
  /**
   * Motivo por el que se cerro la sesion sin que la persona lo pidiera
   * (para mostrarlo en el login). Se limpia al volver a entrar.
   */
  motivoDeSalida: string | null;
  /**
   * true despues de tocar "Salir". Sirve para que el siguiente inicio de
   * sesion (quiza de otra persona en la misma computadora) no caiga en la
   * pagina donde estaba la anterior, sino en el inicio.
   */
  salioPorSuCuenta: boolean;
}

const ContextoDeSesion = createContext<ValorDeSesion | null>(null);

export function SesionProveedor({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDeSesion>('cargando');
  const [usuario, setUsuario] = useState<UsuarioDeSesion | null>(null);
  const [motivoDeSalida, setMotivoDeSalida] = useState<string | null>(null);
  const [salioPorSuCuenta, setSalioPorSuCuenta] = useState(false);

  /** Pregunta al backend quien es la cuenta de la cookie actual. */
  const recargar = useCallback(async () => {
    try {
      const cuenta = await apiAutenticacion.obtenerMiSesion();
      setUsuario(cuenta);
      setEstado('con-sesion');
    } catch (error) {
      setUsuario(null);
      // Sin conexion es distinto de "no hay sesion": no mandar al login,
      // mostrar que el servidor no responde.
      const sinServidor = error instanceof ErrorDeApi && (error.estado === 0 || error.estado >= 500);
      setEstado(sinServidor ? 'sin-servidor' : 'sin-sesion');
    }
  }, []);

  // 1) Al abrir la aplicacion.
  useEffect(() => {
    void recargar();
  }, [recargar]);

  // 4) Cualquier 401 inesperado de otra pantalla cierra la sesion en pantalla.
  useEffect(() => {
    alPerderLaSesion(() => {
      setUsuario(null);
      setEstado('sin-sesion');
      setMotivoDeSalida('Su sesión terminó. Ingrese de nuevo para continuar.');
    });
    return () => alPerderLaSesion(null);
  }, []);

  const entrar = useCallback(async (correo: string, contrasena: string) => {
    // iniciar-sesion solo devuelve id, correo y debeCambiarContrasena; los
    // roles y permisos se piden enseguida a mi-sesion (la cookie ya viene puesta).
    await apiAutenticacion.iniciarSesion(correo, contrasena);
    const cuenta = await apiAutenticacion.obtenerMiSesion();
    setUsuario(cuenta);
    setEstado('con-sesion');
    setMotivoDeSalida(null);
    setSalioPorSuCuenta(false);
    return cuenta;
  }, []);

  const salir = useCallback(async () => {
    try {
      await apiAutenticacion.cerrarSesion();
    } catch {
      // Aunque el backend no responda, en pantalla se cierra igual.
      // La cookie vence sola (JWT_EXPIRACION).
    }
    setUsuario(null);
    setEstado('sin-sesion');
    setMotivoDeSalida(null);
    setSalioPorSuCuenta(true);
  }, []);

  const tienePermisos = useCallback(
    (...codigos: string[]) => !!usuario && codigos.every((c) => usuario.permisos.includes(c)),
    [usuario],
  );

  const valor = useMemo<ValorDeSesion>(
    () => ({ estado, usuario, entrar, salir, recargar, tienePermisos, motivoDeSalida, salioPorSuCuenta }),
    [estado, usuario, entrar, salir, recargar, tienePermisos, motivoDeSalida, salioPorSuCuenta],
  );

  return <ContextoDeSesion.Provider value={valor}>{children}</ContextoDeSesion.Provider>;
}

/** Hook para usar la sesion en cualquier componente. */
export function useSesion(): ValorDeSesion {
  const valor = useContext(ContextoDeSesion);
  if (!valor) throw new Error('useSesion() se uso fuera de <SesionProveedor>.');
  return valor;
}
