import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AutenticacionController } from './autenticacion.controller.js';
import { AutenticacionService } from './autenticacion.service.js';
import { PermisosGuard } from './permisos.guard.js';
import { SesionGuard } from './sesion.guard.js';

/**
 * Tipo que @nestjs/jwt acepta para la duracion del token ("8h", "30m", 3600...).
 * Se deriva del propio modulo para no inventar un tipo propio ni usar "any".
 */
type DuracionToken = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Module({
  imports: [
    // El secreto y la duracion salen de backend/.env, nunca del codigo.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService): JwtModuleOptions => {
        const secreto = configuracion.get<string>('JWT_SECRETO');

        // Si falta, la aplicacion no arranca. Vale mas fallar aqui que
        // firmar tokens con un secreto vacio.
        if (!secreto || secreto.length < 32) {
          throw new Error(
            'JWT_SECRETO falta en backend/.env o es demasiado corto. Genere uno con: ' +
              'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
          );
        }

        const duracion = (configuracion.get<string>('JWT_EXPIRACION') ?? '8h') as DuracionToken;

        return {
          secret: secreto,
          signOptions: { expiresIn: duracion },
        };
      },
    }),
  ],
  controllers: [AutenticacionController],
  providers: [
    AutenticacionService,

    // El ORDEN de estos dos guards importa y no debe cambiarse.
    //
    // Primero el de sesion, que verifica la cookie y deja el usuario con sus
    // permisos dentro de la peticion. Despues el de permisos, que compara
    // esos permisos contra lo que el endpoint exige. Invertirlos haria que
    // el segundo no encuentre usuario y deje pasar todo.
    //
    // El de sesion protege TODA la API: lo que deba quedar abierto se marca
    // con @Publico().
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
  // Se exportan para que los guards y los demas modulos puedan usarlos.
  exports: [AutenticacionService, JwtModule],
})
export class AutenticacionModule {}
