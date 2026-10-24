import {
  applyDecorators,
  type CanActivate,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PeticionAutenticada } from '../../autenticacion/tipos.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ApiError } from '../common/api-error.js';
import { ProblemFilter } from '../common/problem.filter.js';

/*
 * Puente entre ARCA y el inicio de sesion del sistema (23/10/2026).
 *
 * ARCA traia su propio login, usuarios con contrasena (bcrypt) y tres roles
 * fijos en el token. Ahora la persona entra con su cuenta de siempre (cookie
 * de sesion, SesionGuard global) y lo que puede hacer en ARCA sale de tres
 * permisos del sistema, que se asignan con los roles como cualquier otro:
 *
 *   cobro.cajero      cobrar, abrir y cerrar SU caja, recibos, clientes   -> CAJERO
 *   cobro.supervisor  ademas: reportes, autorizar anulaciones, arqueos     -> SUPERVISOR
 *   cobro.administrar ademas: configuracion (piscinas, cajas, tarifas...) -> ADMINISTRADOR
 *
 * El codigo de ARCA sigue trabajando con su "AuthUser" y sus roles; este
 * archivo los arma a partir de la sesion del sistema. Asi casi no hubo que
 * tocar los servicios que escribieron.
 */

export const PERMISO_CAJERO = 'cobro.cajero';
export const PERMISO_SUPERVISOR = 'cobro.supervisor';
export const PERMISO_ADMINISTRAR = 'cobro.administrar';

export type Role = 'CAJERO' | 'SUPERVISOR' | 'ADMINISTRADOR';

/** Quien hace la peticion, como lo esperan los servicios de ARCA. El id es el de la cuenta (UUID). */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  /** Caja de la sesion de caja abierta, si tiene una. */
  cashboxId: number | null;
}

export function canAuthorizeVoid(role: Role): boolean {
  return role === 'SUPERVISOR' || role === 'ADMINISTRADOR';
}

/** El rol de ARCA que corresponde a los permisos de una cuenta (el mas alto), o null si no tiene ninguno. */
export function rolDe(permisos: readonly string[]): Role | null {
  if (permisos.includes(PERMISO_ADMINISTRAR)) return 'ADMINISTRADOR';
  if (permisos.includes(PERMISO_SUPERVISOR)) return 'SUPERVISOR';
  if (permisos.includes(PERMISO_CAJERO)) return 'CAJERO';
  return null;
}

/** Lo que hace falta leer de una cuenta para mostrar su nombre en ARCA. */
export const USUARIO_VISIBLE = {
  select: {
    id: true,
    correo: true,
    funcionario: { select: { nombre: true, primerApellido: true, segundoApellido: true } },
  },
} as const;

/** Nombre para mostrar: el del funcionario ligado a la cuenta o, si no tiene, el correo. */
export function nombreVisible(u: {
  correo: string;
  funcionario: { nombre: string; primerApellido: string; segundoApellido: string | null } | null;
}): string {
  const f = u.funcionario;
  return f ? [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ') : u.correo;
}

export const ROLES = 'arcaRoles';

/** Restringe la ruta a estos roles de ARCA. Sin decorador: cualquiera con acceso a ARCA. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});

export interface AuditCtx {
  username: string | null;
  ip: string | null;
}

/** Usuario (correo) e IP de la peticion, para la bitacora de ARCA. */
export const Audit = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuditCtx => {
  const req = ctx.switchToHttp().getRequest();
  return { username: (req.user as AuthUser | undefined)?.username ?? null, ip: req.ip ?? null };
});

/**
 * Corre despues de los guards globales del sistema (sesion y permisos): exige
 * alguno de los permisos de cobro y arma el AuthUser de ARCA.
 */
@Injectable()
export class ArcaAccesoGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PeticionAutenticada & { user?: AuthUser }>();
    const usuario = req.usuario;
    if (!usuario) throw ApiError.unauthorized('UNAUTHENTICATED', 'Debe iniciar sesión.');
    const role = rolDe(usuario.permisos);
    if (!role) throw ApiError.forbidden('FORBIDDEN', 'Su cuenta no tiene acceso al cobro de las piscinas.');
    const cuenta = await this.prisma.usuario.findUnique({ where: { id: usuario.id }, ...USUARIO_VISIBLE });
    const abierta = await this.prisma.cashboxSession.findFirst({
      where: { cashierId: usuario.id, closedAt: null },
      select: { cashboxId: true },
    });
    req.user = {
      id: usuario.id,
      username: usuario.correo,
      fullName: cuenta ? nombreVisible(cuenta) : usuario.correo,
      role,
      cashboxId: abierta?.cashboxId ?? null,
    };
    return true;
  }
}

/** Revisa @Roles(...) contra el rol de ARCA (el mismo que tenia ARCA, ahora calculado de los permisos). */
@Injectable()
export class ArcaRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw ApiError.forbidden('FORBIDDEN', 'No tiene permiso para realizar esta acción.');
    }
    return true;
  }
}

/**
 * Controlador de ARCA: cuelga de /api/v1/... (el contrato que usa su interfaz),
 * pasa por los dos guards de arriba y responde los errores como problem+json,
 * igual que antes.
 */
export const ArcaControlador = (ruta = '') =>
  applyDecorators(Controller(ruta ? `v1/${ruta}` : 'v1'), UseGuards(ArcaAccesoGuard, ArcaRolesGuard), UseFilters(ProblemFilter));
