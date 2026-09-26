import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PERMISOS, CLAVE_PUBLICO } from './decoradores.js';
import type { PeticionAutenticada } from './tipos.js';

/**
 * Comprueba que la persona tenga los permisos que el endpoint exige.
 *
 * Corre DESPUES del guard de sesion, que es quien deja dentro de la peticion
 * el usuario con sus permisos ya resueltos. Por eso importa el orden en que
 * los dos guards se registran en autenticacion.module.ts.
 *
 * Que un endpoint no exija permisos no significa que sea publico: significa
 * que basta con tener la sesion abierta. Es el caso, por ejemplo, de
 * consultar los datos de la propia sesion.
 *
 * Este guard resuelve el "que puede hacer". El "sobre cual registro puede
 * hacerlo" NO se decide aqui, porque depende de los datos: eso se verifica
 * dentro de cada servicio. Tener "expediente.ver" habilita a abrir
 * expedientes, no a abrir CUALQUIER expediente.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(CLAVE_PERMISOS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    // El endpoint no pide permisos: alcanza con tener la sesion abierta.
    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    // Marcar una ruta como publica y a la vez exigirle permisos es una
    // contradiccion: sin sesion no hay a quien revisarle nada. Se avisa
    // fuerte, en vez de dejar pasar en silencio.
    if (esPublico) {
      throw new Error(
        'Un endpoint no puede llevar @Publico() y @RequierePermisos() al mismo tiempo. ' +
          `Revise ${contexto.getClass().name}.${contexto.getHandler().name}.`,
      );
    }

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    const permisos = peticion.usuario?.permisos ?? [];
    const faltantes = requeridos.filter((clave) => !permisos.includes(clave));

    if (faltantes.length > 0) {
      // No se le informa al cliente cual permiso le falta: es informacion
      // interna del sistema y no le sirve a quien no deberia estar ahi.
      throw new ForbiddenException({
        codigo: 'SIN_PERMISO',
        message: 'No tiene permisos para realizar esta acción.',
      });
    }

    return true;
  }
}
