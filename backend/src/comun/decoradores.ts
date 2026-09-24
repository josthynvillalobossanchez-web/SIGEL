import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Entrega la direccion IP desde la que llego la peticion, para guardarla en
 * la bitacora.
 *
 *   registrar(@DireccionIp() ip: string) { ... }
 *
 * Ojo para el despliegue: si SIGEL queda detras de un proxy inverso, hay que
 * habilitar "trust proxy" en main.ts. Sin eso, todas las peticiones se ven
 * como si vinieran del proxy y la bitacora guardaria siempre la misma IP.
 */
export const DireccionIp = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): string | undefined => {
    const peticion = contexto.switchToHttp().getRequest<Request>();
    return peticion.ip;
  },
);
