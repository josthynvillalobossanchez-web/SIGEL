import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { Response } from 'express';
import { ApiError } from './api-error.js';

export interface FieldError {
  field: string;
  message: string;
}

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  423: 'Locked',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Todas las respuestas de error salen como application/problem+json (RFC 7807) con `code` y `fieldErrors`. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toProblem(exception);
    res.status(body.status as number).type('application/problem+json').json(body);
  }

  private toProblem(ex: unknown): Record<string, unknown> {
    if (ex instanceof ApiError) {
      return problem(ex.status, ex.code, ex.message, ex.extras);
    }
    if (ex instanceof HttpException) {
      const status = ex.getStatus();
      const response = ex.getResponse() as { message?: unknown; code?: string; fieldErrors?: FieldError[] } | string;
      if (typeof response === 'object' && response?.fieldErrors) {
        return problem(status, response.code ?? 'VALIDATION_ERROR', 'Hay datos inválidos en la solicitud.', {
          fieldErrors: response.fieldErrors,
        });
      }
      if (status === 429) {
        return problem(429, 'RATE_LIMITED', 'Demasiados intentos. Espere un minuto e intente de nuevo.');
      }
      if (status === 401) return problem(401, 'UNAUTHENTICATED', 'Debe iniciar sesión.');
      if (status === 403) return problem(403, 'FORBIDDEN', 'No tiene permiso para realizar esta acción.');
      if (status === 404) return problem(404, 'NOT_FOUND', 'Recurso no encontrado.');
      return problem(status, 'BAD_REQUEST', 'La solicitud no es válida.');
    }
    if (ex instanceof Prisma.PrismaClientKnownRequestError) {
      if (ex.code === 'P2002') {
        return problem(409, 'DATA_INTEGRITY', 'La operación entra en conflicto con datos existentes.');
      }
      if (ex.code === 'P2025') return problem(404, 'NOT_FOUND', 'Registro no encontrado.');
    }
    this.log.error(ex instanceof Error ? (ex.stack ?? ex.message) : String(ex));
    return problem(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
  }
}

function problem(status: number, code: string, detail: string, extras: Record<string, unknown> = {}) {
  return { type: 'about:blank', title: TITLES[status] ?? 'Error', status, detail, code, ...extras };
}
