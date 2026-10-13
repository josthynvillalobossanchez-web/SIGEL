import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import type { ConsultarBitacoraDto } from './dto/consultar-bitacora.dto.js';

/**
 * Acciones que la bitacora puede registrar.
 *
 * Corresponden al enum "accionBitacora" del modelo de datos. Se repiten aqui
 * como tipo para que quien llame al servicio tenga autocompletado y no pueda
 * escribir una accion que no existe.
 *
 * Ojo: el modelo contempla ademas "iniciarSesion" y "cerrarSesion", pero por
 * decision de Joseph los accesos NO se auditan, ni los exitosos ni los
 * fallidos. Quedaron en el enum por si esa decision cambia, pero el sistema
 * no los escribe.
 */
export type AccionDeBitacora =
  | 'crear'
  | 'modificar'
  | 'eliminar'
  | 'aprobar'
  | 'rechazar'
  | 'cancelar'
  | 'consultar'
  | 'descargar';

/** Un movimiento que se va a anotar en la bitacora. */
export interface MovimientoDeBitacora {
  /** Quien lo hizo. Sale siempre de la sesion, nunca del cuerpo de la peticion. */
  usuarioId: string;

  /** Tabla o concepto afectado: "usuario", "funcionario", "documento"... */
  entidad: string;

  /** UUID del registro afectado. */
  registroAfectadoId: string;

  accion: AccionDeBitacora;

  /** Funcionario cuyo expediente se toco, cuando aplica. */
  funcionarioAfectadoId?: string;

  direccionIp?: string;

  /** Como estaba el registro antes del cambio. Solo en modificaciones. */
  datosAnteriores?: Record<string, unknown>;

  /** Como quedo despues. */
  datosNuevos?: Record<string, unknown>;

  /** Texto corto y legible, para que la pantalla no tenga que interpretar el JSON. */
  descripcion?: string;
}

/**
 * Parte del cliente de Prisma que este servicio necesita.
 *
 * Se declara asi para poder recibir tanto el PrismaService normal como el
 * cliente de una transaccion, y poder escribir la bitacora DENTRO de la
 * misma transaccion que hace el cambio. De ese modo no puede ocurrir que el
 * cambio quede guardado y la anotacion no.
 */
type ClienteDeBitacora = Pick<PrismaService, 'bitacoraCambio'>;

@Injectable()
export class BitacoraService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Anota un movimiento en la bitacora.
   *
   * Se espera el resultado y los errores se propagan a proposito: una
   * bitacora con huecos no sirve como evidencia, asi que es preferible que
   * la operacion falle a que quede sin rastro.
   *
   * Para incluirla en una transaccion, se le pasa el cliente de la
   * transaccion como segundo argumento:
   *
   *   await this.prisma.$transaction(async (tx) => {
   *     const creado = await tx.usuario.create({ ... });
   *     await this.bitacora.registrar({ ... }, tx);
   *   });
   */
  async registrar(movimiento: MovimientoDeBitacora, cliente?: ClienteDeBitacora): Promise<void> {
    const destino = cliente ?? this.prisma;

    await destino.bitacoraCambio.create({
      data: {
        usuarioId: movimiento.usuarioId,
        entidad: movimiento.entidad,
        registroAfectadoId: movimiento.registroAfectadoId,
        accion: movimiento.accion,
        funcionarioAfectadoId: movimiento.funcionarioAfectadoId,
        direccionIp: movimiento.direccionIp,
        // El casteo es necesario porque Prisma tipa las columnas Json con su
        // propio tipo y no acepta un Record<string, unknown> directo.
        datosAnteriores: movimiento.datosAnteriores as never,
        datosNuevos: movimiento.datosNuevos as never,
        descripcion: movimiento.descripcion,
      },
    });
  }

  /**
   * Consulta la bitacora con filtros y paginacion.
   *
   * Solo la usa quien tenga el permiso "bitacora.ver", que por decision de
   * la Municipalidad es unicamente el Super Administrador.
   *
   * Siempre se ordena de lo mas reciente a lo mas viejo: quien audita casi
   * siempre viene buscando algo que acaba de pasar.
   */
  async consultar(filtros: ConsultarBitacoraDto): Promise<PaginaDeResultados<unknown>> {
    const { pagina, tamano } = filtros;

    /**
     * Se arma el "where" pieza por pieza, agregando solo los filtros que
     * vinieron. Poner "undefined" en un campo hace que Prisma lo ignore, asi
     * que no hacen falta consultas distintas para cada combinacion.
     */
    const donde: Prisma.bitacoraCambioWhereInput = {
      usuarioId: filtros.usuarioId,
      entidad: filtros.entidad,
      registroAfectadoId: filtros.registroAfectadoId,
      funcionarioAfectadoId: filtros.funcionarioAfectadoId,
      accion: filtros.accion,
      fechaHora:
        filtros.desde || filtros.hasta
          ? { gte: filtros.desde ? limiteDelDia(filtros.desde, 'inicio') : undefined, lte: filtros.hasta ? limiteDelDia(filtros.hasta, 'fin') : undefined }
          : undefined,
    };
    // Cada palabra debe aparecer en la descripcion, el correo de quien lo hizo o el nombre de la persona afectada.
    const palabras = (filtros.busqueda ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    if (palabras.length) {
      donde.AND = palabras.map((p) => ({
        OR: [
          { descripcion: { contains: p } },
          { usuario: { is: { correo: { contains: p } } } },
          { funcionarioAfectado: { is: { nombre: { contains: p } } } },
          { funcionarioAfectado: { is: { primerApellido: { contains: p } } } },
          { funcionarioAfectado: { is: { segundoApellido: { contains: p } } } },
          { funcionarioAfectado: { is: { cedula: { contains: p } } } },
        ],
      }));
    }

    /**
     * Las dos consultas van juntas en una transaccion para que el total y la
     * pagina correspondan al mismo momento. Si se hicieran por separado y
     * alguien escribiera en medio, el total no calzaria con lo devuelto.
     */
    const [total, movimientos] = await this.prisma.$transaction([
      this.prisma.bitacoraCambio.count({ where: donde }),
      this.prisma.bitacoraCambio.findMany({
        where: donde,
        orderBy: { fechaHora: 'desc' },
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: {
          id: true,
          fechaHora: true,
          accion: true,
          entidad: true,
          registroAfectadoId: true,
          descripcion: true,
          direccionIp: true,
          datosAnteriores: true,
          datosNuevos: true,
          // Del usuario solo su correo: jamas el hash de la contrasena ni
          // el resto de la fila.
          usuario: { select: { id: true, correo: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
          funcionarioAfectado: { select: { id: true, nombre: true, primerApellido: true, segundoApellido: true } },
        },
      }),
    ]);

    return armarPagina(movimientos, total, pagina, tamano);
  }

  /**
   * Opciones de los filtros de la pantalla de auditoria: las entidades que
   * aparecen en la bitacora y las cuentas que hicieron algun movimiento.
   */
  async opciones(): Promise<{ entidades: string[]; usuarios: { id: string; correo: string; nombre: string | null }[] }> {
    const [entidades, porUsuario] = await Promise.all([
      this.prisma.bitacoraCambio.groupBy({ by: ['entidad'], orderBy: { entidad: 'asc' } }),
      this.prisma.bitacoraCambio.groupBy({ by: ['usuarioId'], where: { usuarioId: { not: null } } }),
    ]);
    const cuentas = await this.prisma.usuario.findMany({
      where: { id: { in: porUsuario.map((u) => u.usuarioId!).filter(Boolean) } },
      select: { id: true, correo: true, funcionario: { select: { nombre: true, primerApellido: true } } },
      orderBy: { correo: 'asc' },
    });
    return {
      entidades: entidades.map((e) => e.entidad),
      usuarios: cuentas.map((c) => ({ id: c.id, correo: c.correo, nombre: c.funcionario ? `${c.funcionario.nombre} ${c.funcionario.primerApellido}` : null })),
    };
  }
}

/** "2026-10-10" se toma como el dia completo en hora de Costa Rica; una fecha con hora se respeta. */
function limiteDelDia(texto: string, cual: 'inicio' | 'fin'): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return new Date(`${texto}T${cual === 'inicio' ? '00:00:00.000' : '23:59:59.999'}-06:00`);
  return new Date(texto);
}
