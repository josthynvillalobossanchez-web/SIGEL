/*
 * Llamadas al modulo de autenticacion del backend (/api/autenticacion/...).
 *
 * Los nombres de los campos que se envian TIENEN que ser iguales a los de
 * los DTO del backend (backend/src/autenticacion/dto/*.dto.ts): el backend
 * rechaza cualquier campo que no conozca (forbidNonWhitelisted).
 */
import { pedirAlServidor } from './cliente';

/**
 * La cuenta con la que se esta trabajando, tal como la devuelve el backend
 * (tipo UsuarioAutenticado en backend/src/autenticacion/tipos.ts).
 */
export interface UsuarioDeSesion {
  id: string;
  correo: string;
  /** null solo para la cuenta tecnica de Informatica (unica sin funcionario). */
  funcionarioId: string | null;
  /** true = entro con contrasena temporal y debe cambiarla antes de seguir. */
  debeCambiarContrasena: boolean;
  /** Nombres de los roles vigentes (solo para mostrar; NO usarlos para decidir). */
  roles: string[];
  /** Codigos de permiso vigentes, p. ej. "usuarios.ver". Esto SI decide que se ve. */
  permisos: string[];
}

/**
 * POST /autenticacion/iniciar-sesion. Si sale bien, el backend deja la cookie
 * puesta y devuelve solo lo basico de la cuenta (sin roles ni permisos).
 */
export function iniciarSesion(correo: string, contrasena: string) {
  return pedirAlServidor<{ usuario: Pick<UsuarioDeSesion, 'id' | 'correo' | 'debeCambiarContrasena'> }>('POST', '/autenticacion/iniciar-sesion', {
    cuerpo: { correo, contrasena },
    el401EsNormal: true,
  });
}

/** POST /autenticacion/cerrar-sesion. Borra la cookie (funciona aunque ya estuviera vencida). */
export function cerrarSesion() {
  return pedirAlServidor<unknown>('POST', '/autenticacion/cerrar-sesion', { el401EsNormal: true });
}

/**
 * GET /autenticacion/mi-sesion. Devuelve la cuenta de la cookie actual.
 * Si no hay sesion responde 401 (y eso es normal al abrir la aplicacion).
 */
export function obtenerMiSesion() {
  return pedirAlServidor<UsuarioDeSesion>('GET', '/autenticacion/mi-sesion', { el401EsNormal: true });
}

/** POST /autenticacion/cambiar-contrasena (primer ingreso y "Mi cuenta"). */
export function cambiarContrasena(contrasenaActual: string, contrasenaNueva: string) {
  return pedirAlServidor<unknown>('POST', '/autenticacion/cambiar-contrasena', {
    cuerpo: { contrasenaActual, contrasenaNueva },
    // Si la contrasena actual esta mal el backend puede responder 401;
    // eso no significa que se perdio la sesion.
    el401EsNormal: true,
  });
}

/**
 * POST /autenticacion/solicitar-recuperacion.
 * El backend responde igual exista o no el correo (para no revelar que
 * cuentas existen), asi que la pantalla siempre muestra "le enviamos un codigo".
 */
export function solicitarRecuperacion(correo: string) {
  return pedirAlServidor<unknown>('POST', '/autenticacion/solicitar-recuperacion', {
    cuerpo: { correo },
    el401EsNormal: true,
  });
}

/** POST /autenticacion/restablecer-contrasena con el codigo de 6 digitos. */
export function restablecerContrasena(correo: string, codigo: string, contrasenaNueva: string) {
  return pedirAlServidor<unknown>('POST', '/autenticacion/restablecer-contrasena', {
    cuerpo: { correo, codigo, contrasenaNueva },
    el401EsNormal: true,
  });
}
