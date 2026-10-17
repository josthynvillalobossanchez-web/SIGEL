import type { Prisma } from '../generated/prisma/client.js';

/**
 * Rol que hace a alguien JEFATURA posible (decision de Josthyn, 28/09):
 * "quien tiene el rol Aprobador es jefatura". Se decide por el ROL y no por
 * el permiso solicitudes.aprobar, porque ese permiso tambien lo tiene RRHH
 * (para poder asignar el rol) y se puede dar suelto a alguien como caso
 * especial sin que sea jefatura. Solo cuenta el rol PERMANENTE: una
 * suplencia con fecha cubre un tiempo, no recibe personal a cargo fijo.
 * Es un rol de sistema: no se puede renombrar (ROL_DE_SISTEMA).
 */
export const ROL_DE_JEFATURA = 'Aprobador';

/**
 * Condicion de "puede ser jefatura": funcionario activo con cuenta no
 * inactiva (una cuenta bloqueada por intentos fallidos sigue contando) que
 * tiene el rol Aprobador sin fecha de vencimiento. Al quitar un rol, la
 * fila queda con fecha de hoy, asi que tampoco cuenta.
 */
export const PUEDE_SER_JEFATURA: Prisma.funcionarioWhereInput = {
  estado: 'activo',
  usuario: {
    is: {
      estado: { not: 'inactivo' },
      roles: { some: { fechaVencimiento: null, rol: { nombre: ROL_DE_JEFATURA, activo: true } } },
    },
  },
};
