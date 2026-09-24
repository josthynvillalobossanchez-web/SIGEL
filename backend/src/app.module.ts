import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AutenticacionModule } from './autenticacion/autenticacion.module.js';
import { BitacoraModule } from './bitacora/bitacora.module.js';
import { CorreoModule } from './correo/correo.module.js';
import { PermisosModule } from './permisos/permisos.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludController } from './salud/salud.controller.js';

@Module({
  imports: [
    // Lee backend/.env y lo deja disponible en toda la aplicacion.
    ConfigModule.forRoot({ isGlobal: true }),

    // Limite general de peticiones por direccion IP. Los endpoints
    // sensibles, como el login, aprietan mas este limite con @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    PrismaModule,
    CorreoModule,
    BitacoraModule,
    AutenticacionModule,
    PermisosModule,
    // Aqui se iran agregando los demas modulos del Sprint 1:
    // UsuariosModule, RolesModule, FuncionariosModule,
    // ExpedienteModule, DocumentosModule.
  ],
  controllers: [SaludController],
  providers: [
    // Aplica el limite de peticiones a toda la API.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
