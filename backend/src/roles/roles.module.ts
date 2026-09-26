import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

/**
 * Roles del sistema: consulta y administracion.
 * La asignacion de roles a una cuenta vive en el modulo de usuarios.
 */
@Module({
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
