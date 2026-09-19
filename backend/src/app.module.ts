import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { SaludController } from './salud/salud.controller.js';

@Module({
  imports: [
    // Lee backend/.env y lo deja disponible en toda la aplicacion.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Aqui se iran agregando los modulos del Sprint 1:
    // AutenticacionModule, UsuariosModule, RolesModule,
    // FuncionariosModule, ExpedienteModule, DocumentosModule.
  ],
  controllers: [SaludController],
})
export class AppModule {}
