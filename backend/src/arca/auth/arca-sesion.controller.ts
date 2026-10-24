import { Get } from '@nestjs/common';
import { AutenticacionService } from '../../autenticacion/autenticacion.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CashboxService } from '../cashbox/cashbox.service.js';
import { ArcaControlador, type AuthUser, CurrentUser, nombreVisible, rolDe, USUARIO_VISIBLE } from './arca-auth.js';

/**
 * Lo que antes daban el login y la gestion de usuarios de ARCA y la interfaz
 * todavia necesita: quien soy (con mi rol y mi caja) y la lista de cajeros
 * para los filtros. Crear cuentas, contrasenas y roles se hace en el sistema
 * (Seguridad > Usuarios), no aqui.
 */
@ArcaControlador()
export class ArcaSesionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajas: CashboxService,
    private readonly autenticacion: AutenticacionService,
  ) {}

  /** GET /api/v1/auth/me: la persona, su rol en ARCA, su caja y su sesion de caja abierta. */
  @Get('auth/me')
  async me(@CurrentUser() user: AuthUser) {
    const session = await this.cajas.currentFor(user.id);
    return {
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, mustChangePassword: false },
      cashbox: session ? await this.cajas.cashboxDto(session.cashboxId) : null,
      session,
    };
  }

  /** GET /api/v1/users/lookup: cuentas activas con acceso al cobro (para filtrar recibos por cajero). */
  @Get('users/lookup')
  async lookup() {
    const cuentas = await this.prisma.usuario.findMany({ where: { estado: 'activo' }, ...USUARIO_VISIBLE });
    const filas: { id: string; fullName: string; role: string }[] = [];
    for (const c of cuentas) {
      const acceso = await this.autenticacion.cargarUsuarioAutenticado(c.id);
      const role = rolDe(acceso?.permisos ?? []);
      if (role) filas.push({ id: c.id, fullName: nombreVisible(c), role });
    }
    return filas.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }
}
