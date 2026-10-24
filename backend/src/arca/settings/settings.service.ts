import { Injectable } from '@nestjs/common';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsDto } from './settings.dto.js';

export type PrintFormat = 'TERMICO' | 'CARTA';

export interface Settings {
  municipalLegalId: string;
  municipalPhone: string;
  municipalAddress: string;
  printFormat: PrintFormat;
  autoPrint: boolean;
}

const KEYS: (keyof Settings)[] = ['municipalLegalId', 'municipalPhone', 'municipalAddress', 'printFormat', 'autoPrint'];

/**
 * Configuración editable por el administrador. Los datos municipales parten de las variables de entorno
 * (ARCA_MUNICIPALITY_*) y lo guardado en el panel tiene prioridad.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<Settings> {
    const rows = await this.prisma.appSetting.findMany();
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    // Valores iniciales opcionales desde el .env (ARCA_MUNICIPALITY_*); lo guardado en el panel tiene prioridad.
    const m = {
      legalId: process.env.ARCA_MUNICIPALITY_LEGAL_ID ?? '',
      phone: process.env.ARCA_MUNICIPALITY_PHONE ?? '',
      address: process.env.ARCA_MUNICIPALITY_ADDRESS ?? '',
    };
    return {
      municipalLegalId: stored.get('municipalLegalId') ?? m.legalId,
      municipalPhone: stored.get('municipalPhone') ?? m.phone,
      municipalAddress: stored.get('municipalAddress') ?? m.address,
      printFormat: stored.get('printFormat') === 'CARTA' ? 'CARTA' : 'TERMICO',
      autoPrint: stored.has('autoPrint') ? stored.get('autoPrint') === 'true' : true,
    };
  }

  async update(dto: SettingsDto, ctx: AuditContext): Promise<Settings> {
    const before = await this.get();
    const next: Settings = {
      municipalLegalId: dto.municipalLegalId.trim(),
      municipalPhone: dto.municipalPhone.trim(),
      municipalAddress: dto.municipalAddress.trim(),
      printFormat: dto.printFormat,
      autoPrint: dto.autoPrint,
    };
    await this.prisma.$transaction(
      KEYS.map((key) =>
        this.prisma.appSetting.upsert({
          where: { key },
          create: { key, value: String(next[key]) },
          update: { value: String(next[key]) },
        }),
      ),
    );
    const changed = KEYS.filter((k) => before[k] !== next[k]);
    await this.audit.log(ctx, 'SETTINGS_UPDATED', 'Settings', null, changed.length ? `Cambió: ${changed.join(', ')}` : 'Sin cambios');
    return next;
  }
}
