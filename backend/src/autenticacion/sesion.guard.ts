import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AutenticacionService } from './autenticacion.service.js';
import { CLAVE_CONTRASENA_TEMPORAL, CLAVE_PUBLICO } from './decoradores.js';
import { COOKIE_SESION } from './cookie-sesion.js';
import type { ContenidoToken } from './autenticacion.service.js';
import type { PeticionAutenticada } from './tipos.js';

/**
 * Deja pasar solo a quien trae una sesion valida.
 *
 * Se registra de forma global, asi que protege toda la API salvo lo marcado
 * con @Publico().
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly autenticacion: AutenticacionService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    const token = peticion.cookies?.[COOKIE_SESION] as string | undefined;

    if (!token) {
      throw this.sinSesion('No hay una sesión activa.');
    }

    let contenido: ContenidoToken;
    try {
      contenido = await this.jwt.verifyAsync<ContenidoToken>(token);
    } catch {
      // Token vencido, alterado o firmado con otro secreto.
      throw this.sinSesion('La sesión expiró o no es válida.');
    }

    /**
     * Se vuelve a consultar el usuario en cada peticion, en lugar de confiar
     * en lo que diga el token. Cuesta una consulta, pero a cambio los cambios
     * surten efecto de inmediato: si Recursos Humanos inactiva una cuenta o
     * le quita un permiso a un rol, se aplica en la siguiente peticion y no
     * hasta que venza la sesion.
     */
    const usuario = await this.autenticacion.cargarUsuarioAutenticado(contenido.sub);

    if (!usuario) {
      throw this.sinSesion('La cuenta ya no está disponible.');
    }

    /**
     * Primer ingreso: mientras la contrasena siga siendo la temporal que le
     * entrego Recursos Humanos, la persona no puede usar el sistema. Solo se
     * le permiten los endpoints marcados con @PermitirConContrasenaTemporal,
     * que son ver su sesion y cambiar la contrasena.
     *
     * Se comprueba aqui, en un solo lugar, en vez de andar acordandose en
     * cada modulo nuevo.
     */
    if (usuario.debeCambiarContrasena) {
      const permitido = this.reflector.getAllAndOverride<boolean>(CLAVE_CONTRASENA_TEMPORAL, [
        contexto.getHandler(),
        contexto.getClass(),
      ]);

      if (!permitido) {
        throw new ForbiddenException({
          codigo: 'CONTRASENA_TEMPORAL',
          message: 'Debe cambiar su contraseña antes de usar el sistema.',
        });
      }
    }

    peticion.usuario = usuario;
    return true;
  }

  private sinSesion(mensaje: string): UnauthorizedException {
    return new UnauthorizedException({ codigo: 'SIN_SESION', message: mensaje });
  }
}
