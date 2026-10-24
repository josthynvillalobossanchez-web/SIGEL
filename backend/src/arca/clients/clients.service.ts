import { Injectable } from '@nestjs/common';
import { Client, Prisma } from '../../generated/prisma/client.js';
import { AuditContext, AuditService } from '../audit/audit.service.js';
import { ApiError } from '../common/api-error.js';
import { pageOf } from '../common/page.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClientRequestDto } from './clients.dto.js';

/** Identificación física, jurídica o DIMEX: 9 dígitos sin guiones. */
export function isValidIdNumber(v: unknown): v is string {
  return typeof v === 'string' && /^\d{9}$/.test(v);
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async search(q: string | undefined, page: number, size: number) {
    const term = q?.trim() ?? '';
    const where: Prisma.ClientWhereInput = {
      active: true,
      ...(term && { OR: [{ idNumber: { startsWith: term } }, { fullName: { contains: term } }] }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.findMany({ where, orderBy: { fullName: 'asc' }, skip: page * size, take: size }),
      this.prisma.client.count({ where }),
    ]);
    return pageOf(rows.map(toDto), page, size, total);
  }

  async get(id: number) {
    return toDto(await this.find(id));
  }

  async find(id: number) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c || !c.active) throw ApiError.notFound('Cliente no encontrado.');
    return c;
  }

  async create(dto: ClientRequestDto, ctx: AuditContext) {
    const idNumber = normalize(dto.idNumber);
    if (await this.prisma.client.findUnique({ where: { idType_idNumber: { idType: dto.idType, idNumber } } })) {
      throw ApiError.conflict('DUPLICATE_CLIENT', 'Ya existe un cliente con esa identificación.');
    }
    const c = await this.prisma.client.create({ data: { idType: dto.idType, idNumber, ...fields(dto) } });
    await this.audit.log(ctx, 'CLIENT_CREATED', 'Client', c.id, c.fullName);
    return toDto(c);
  }

  async update(id: number, dto: ClientRequestDto, ctx: AuditContext) {
    await this.find(id);
    const idNumber = normalize(dto.idNumber);
    const other = await this.prisma.client.findUnique({ where: { idType_idNumber: { idType: dto.idType, idNumber } } });
    if (other && other.id !== id) {
      throw ApiError.conflict('DUPLICATE_CLIENT', 'Ya existe un cliente con esa identificación.');
    }
    const c = await this.prisma.client.update({ where: { id }, data: { idType: dto.idType, idNumber, ...fields(dto) } });
    await this.audit.log(ctx, 'CLIENT_UPDATED', 'Client', id, c.fullName);
    return toDto(c);
  }
}

function normalize(v: string): string {
  const n = v.trim();
  if (!isValidIdNumber(n)) throw ApiError.badRequest('INVALID_ID_FORMAT', 'La identificación debe tener 9 dígitos, sin guiones.');
  return n;
}

const blankToNull = (s?: string) => (s && s.trim() ? s.trim() : null);

function fields(dto: ClientRequestDto) {
  return {
    fullName: dto.fullName.trim(),
    phone: blankToNull(dto.phone),
    email: blankToNull(dto.email),
    address: blankToNull(dto.address),
  };
}

export function toDto(c: Client) {
  return { id: c.id, idType: c.idType, idNumber: c.idNumber, fullName: c.fullName, phone: c.phone, email: c.email, address: c.address, active: c.active };
}
