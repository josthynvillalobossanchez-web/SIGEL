import { Injectable } from '@nestjs/common';
import { Concept } from '../../generated/prisma/client.js';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { ApiError } from '../common/api-error.js';
import { Clock } from '../common/clock.js';
import { dec, money, num } from '../common/money.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConceptDto } from './catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(active?: boolean) {
    const rows = await this.prisma.concept.findMany({
      where: active === undefined ? {} : { active },
      orderBy: { code: 'asc' },
    });
    return rows.map(toDto);
  }

  async create(dto: ConceptDto, ctx: AuditContext) {
    const code = dto.code.trim();
    if (await this.prisma.concept.findUnique({ where: { code } })) {
      throw ApiError.conflict('DUPLICATE_CODE', 'Ya existe un concepto con ese código.');
    }
    const c = await this.prisma.$transaction(async (tx) => {
      const created = await tx.concept.create({
        data: { code, name: dto.name.trim(), type: dto.type, periodicity: dto.periodicity, price: dec(dto.price), active: dto.active },
      });
      await tx.conceptPriceHistory.create({
        data: { conceptId: created.id, price: created.price, validFrom: this.clock.now(), changedBy: ctx.username ?? 'system' },
      });
      return created;
    });
    await this.audit.log(ctx, 'CONCEPT_CREATED', 'Concept', c.id, `${c.code} ${c.name}`);
    return toDto(c);
  }

  async update(id: number, dto: ConceptDto, ctx: AuditContext) {
    const old = await this.prisma.concept.findUnique({ where: { id } });
    if (!old) throw ApiError.notFound('Concepto no encontrado.');
    const priceChanged = !money(old.price).eq(money(dto.price));
    const c = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.concept.update({
        where: { id },
        data: { name: dto.name.trim(), type: dto.type, periodicity: dto.periodicity, price: dec(dto.price), active: dto.active },
      });
      if (priceChanged) {
        await tx.conceptPriceHistory.create({
          data: { conceptId: id, price: updated.price, validFrom: this.clock.now(), changedBy: ctx.username ?? 'system' },
        });
      }
      return updated;
    });
    if (priceChanged) {
      await this.audit.log(ctx, 'CONCEPT_PRICE_CHANGED', 'Concept', id, `${c.code}: ${dec(old.price)} -> ${dec(c.price)}`);
    } else {
      await this.audit.log(ctx, 'CONCEPT_UPDATED', 'Concept', id, `${c.code} ${c.name}`);
    }
    return toDto(c);
  }
}

function toDto(c: Concept) {
  return { id: c.id, code: c.code, name: c.name, type: c.type, periodicity: c.periodicity, price: num(c.price), active: c.active };
}
