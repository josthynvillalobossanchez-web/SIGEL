import type { CookieOptions } from 'express';

/** Nombre de la cookie donde viaja la sesion. */
export const COOKIE_SESION = 'sigel_sesion';

/**
 * Convierte "45s", "30m", "8h" o "7d" a milisegundos. Un numero suelto se
 * interpreta como segundos, igual que lo hace la libreria del token.
 */
export function duracionEnMilisegundos(expresion: string): number {
  const partes = /^(\d+)\s*([smhd]?)$/.exec(expresion.trim());

  if (!partes) {
    throw new Error(`JWT_EXPIRACION no tiene un formato valido: "${expresion}". Use 30m, 8h o 7d.`);
  }

  const unidades: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(partes[1]) * (unidades[partes[2]] ?? 1000);
}

/**
 * Como se guarda la sesion en el navegador.
 *
 * El token NO se devuelve en el cuerpo de la respuesta ni se guarda en
 * localStorage: viaja en esta cookie, que el JavaScript de la pagina no puede
 * leer. Si alguien lograra inyectar codigo en el sistema, no podria robarse
 * la sesion.
 */
export function opcionesCookie(duracionMs: number): CookieOptions {
  return {
    // El JavaScript del navegador no la ve. Esto es lo que frena un XSS.
    httpOnly: true,

    // Solo viaja por HTTPS. En desarrollo va en false porque localhost no lo usa.
    secure: process.env.COOKIE_SEGURA === 'true',

    // El navegador no la manda cuando la peticion nace en otro sitio.
    // Esto es lo que cubre el CSRF sin necesidad de un token aparte.
    sameSite: 'strict',

    // Solo se envia a las rutas de la API.
    path: '/api',

    maxAge: duracionMs,
  };
}
