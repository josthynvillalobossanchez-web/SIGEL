import { Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Un permiso tal como se le muestra a quien administra la seguridad. */
export interface PermisoDelCatalogo {
  id: string;
  clave: string;
  descripcion: string | null;
  /** true si quien consulta tiene este permiso y por lo tanto puede darlo o quitarlo. */
  asignable: boolean;
}

/** Los permisos de un mismo modulo, agrupados para pintarlos juntos. */
export interface ModuloDePermisos {
  modulo: string;
  permisos: PermisoDelCatalogo[];
}

@Injectable()
export class PermisosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el catalogo de permisos agrupado por modulo.
   *
   * Es lo que alimenta la pantalla de "Roles y permisos": ahi se marcan
   * las casillas de lo que puede hacer cada rol. Agrupar por modulo es
   * decision de presentacion, pero se hace aqui y no en el frontend para
   * que todas las pantallas que lo necesiten lo reciban igual.
   *
   * Solo se listan los permisos activos. Uno inactivo es un permiso que se
   * dejo de usar y que no debe poder asignarse, aunque siga en la base para
   * no perder el historial de quien lo tuvo.
   */
  async listarCatalogo(quienActua: UsuarioAutenticado): Promise<ModuloDePermisos[]> {
    const propios = new Set(quienActua.permisos);

    const permisos = await this.prisma.permiso.findMany({
      where: { activo: true },
      // "select" explicito, como en todo el sistema: se pide lo que se
      // necesita y nada mas.
      select: { id: true, clave: true, modulo: true, descripcion: true },
      orderBy: [{ modulo: 'asc' }, { clave: 'asc' }],
    });

    const porModulo = new Map<string, PermisoDelCatalogo[]>();

    for (const permiso of permisos) {
      const lista = porModulo.get(permiso.modulo) ?? [];
      lista.push({
        id: permiso.id,
        clave: permiso.clave,
        descripcion: permiso.descripcion,
        asignable: propios.has(permiso.clave),
      });
      porModulo.set(permiso.modulo, lista);
    }

    return [...porModulo.entries()].map(([modulo, lista]) => ({ modulo, permisos: lista }));
  }
}
