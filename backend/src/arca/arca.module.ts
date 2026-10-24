import { Global, Module } from '@nestjs/common';
import { AutenticacionModule } from '../autenticacion/autenticacion.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ArcaAccesoGuard, ArcaRolesGuard } from './auth/arca-auth.js';
import { ArcaSesionController } from './auth/arca-sesion.controller.js';
import { CredentialService } from './auth/credenciales.js';
import { CashboxModule } from './cashbox/cashbox.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { Clock, SystemClock } from './common/clock.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SettingsModule } from './settings/settings.module.js';

/** Piezas compartidas por los modulos de ARCA: reloj, verificacion de supervisor y guards. */
@Global()
@Module({
  imports: [AutenticacionModule],
  providers: [{ provide: Clock, useClass: SystemClock }, CredentialService, ArcaAccesoGuard, ArcaRolesGuard],
  exports: [Clock, CredentialService, ArcaAccesoGuard, ArcaRolesGuard, AutenticacionModule],
})
export class ArcaComunModule {}

/**
 * ARCA: cobro de las piscinas municipales (integrado el 23/10/2026).
 * Todo cuelga de /api/v1 y usa la sesion y los permisos del sistema.
 */
@Module({
  imports: [ArcaComunModule, AuditModule, SettingsModule, CashboxModule, CatalogModule, ReceiptsModule, ReportsModule],
  controllers: [ArcaSesionController],
})
export class ArcaModule {}
