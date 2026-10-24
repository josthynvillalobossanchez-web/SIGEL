import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AutenticacionService } from '../../autenticacion/autenticacion.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { nombreVisible, rolDe, type Role, USUARIO_VISIBLE } from './arca-auth.js';

export type CredentialStatus = 'OK' | 'BAD_CREDENTIALS' | 'LOCKED';

export interface CredentialCheck {
  user: { id: string; username: string; fullName: string; role: Role | null } | null;
  status: CredentialStatus;
  remainingAttempts: number;
}

/** Mismas reglas que el inicio de sesion del sistema (autenticacion.service.ts). */
const MAXIMO_INTENTOS = 3;
const MINUTOS_BLOQUEO = 3;

/**
 * Verifica correo y contrasena de quien AUTORIZA una anulacion (un supervisor),
 * sin abrirle sesion. Antes ARCA lo hacia contra sus propios usuarios (bcrypt);
 * ahora es contra las cuentas del sistema (Argon2id), con el mismo contador de
 * intentos y el mismo bloqueo temporal que el login: tres intentos fallidos
 * bloquean la cuenta tres minutos, tambien para entrar al sistema.
 */
@Injectable()
export class CredentialService {
  /** Hash falso para que una cuenta inexistente tarde lo mismo que una real. */
  private readonly hashFalso = argon2.hash('arca-igualar-tiempos', { type: argon2.argon2id });

  constructor(
    private readonly prisma: PrismaService,
    private readonly autenticacion: AutenticacionService,
  ) {}

  async check(correo: string | undefined, contrasena: string | undefined): Promise<CredentialCheck> {
    const limpio = correo?.trim().toLowerCase();
    const cuenta = limpio
      ? await this.prisma.usuario.findUnique({
          where: { correo: limpio },
          select: { id: true, estado: true, contrasenaHash: true, intentosFallidos: true, bloqueadoHasta: true },
        })
      : null;
    if (!cuenta || cuenta.estado !== 'activo') {
      await argon2.verify(await this.hashFalso, contrasena ?? '');
      return { user: null, status: 'BAD_CREDENTIALS', remainingAttempts: MAXIMO_INTENTOS };
    }
    const ahora = new Date();
    if (cuenta.bloqueadoHasta && cuenta.bloqueadoHasta > ahora) {
      return { user: null, status: 'LOCKED', remainingAttempts: 0 };
    }
    if (!(await argon2.verify(cuenta.contrasenaHash, contrasena ?? ''))) {
      const intentos = cuenta.intentosFallidos + 1;
      const bloquear = intentos >= MAXIMO_INTENTOS;
      await this.prisma.usuario.update({
        where: { id: cuenta.id },
        data: bloquear
          ? { intentosFallidos: 0, bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000) }
          : { intentosFallidos: intentos },
      });
      return { user: null, status: 'BAD_CREDENTIALS', remainingAttempts: bloquear ? 0 : MAXIMO_INTENTOS - intentos };
    }
    if (cuenta.intentosFallidos > 0) {
      await this.prisma.usuario.update({ where: { id: cuenta.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
    }
    const autenticado = await this.autenticacion.cargarUsuarioAutenticado(cuenta.id);
    const visible = await this.prisma.usuario.findUniqueOrThrow({ where: { id: cuenta.id }, ...USUARIO_VISIBLE });
    return {
      user: { id: cuenta.id, username: visible.correo, fullName: nombreVisible(visible), role: rolDe(autenticado?.permisos ?? []) },
      status: 'OK',
      remainingAttempts: MAXIMO_INTENTOS,
    };
  }
}
