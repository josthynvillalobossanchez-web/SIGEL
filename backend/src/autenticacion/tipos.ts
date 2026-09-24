import type { Request } from 'express';

/**
 * El usuario que ya paso por el guard de sesion.
 *
 * Los permisos vienen resueltos: los del rol, mas los concedidos de forma
 * individual, menos los revocados de forma individual.
 */
export interface UsuarioAutenticado {
  id: string;
  correo: string;
  funcionarioId: string | null;
  debeCambiarContrasena: boolean;
  roles: string[];
  permisos: string[];
}

/** Peticion a la que el guard ya le adjunto el usuario. */
export interface PeticionAutenticada extends Request {
  usuario?: UsuarioAutenticado;
}
