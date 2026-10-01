import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  aniosCumplidos,
  aniversario,
  diasDelPeriodo,
  etiquetaDePeriodo,
  excedenteDelTope,
  redondear,
  type Tramo,
} from './calculo-de-vacaciones.js';
import type { AjustarSaldoDto, ConsultarMovimientosDto } from './dto/vacaciones.dto.js';

/** Permiso de RRHH para ver y gestionar las solicitudes y el saldo de cualquier persona. */
export const PERMISO_ADMINISTRAR = 'solicitudes.administrar';

export interface ResumenDeSaldo {
  funcionarioId: string;
  /** false = RRHH todavia no cargo el saldo inicial: no se acumula nada hasta que lo haga. */
  saldoCargado: boolean;
  regimen: { nombre: string; diasPorPeriodo: number | null; periodosMaximos: number; topeEnDias: number | null };
  aniosDeServicio: number;
  /** Lo cargado por RRHH al registrar (dias que ya traia). */
  inicial: number;
  /** Lo ganado al cumplir cada anio de servicio (nunca al registrarse). */
  ganadosPorAniversario: number;
  /** Dias ganados (saldo inicial + acumulaciones). */
  acumulado: number;
  utilizado: number;
  vencido: number;
  /** Suma de los ajustes manuales de RRHH (puede ser negativa). */
  ajustes: number;
  /** Suma de todos los movimientos. */
  disponible: number;
  /** Dias de solicitudes de vacaciones que siguen pendientes de aprobar. */
  reservado: number;
  /** Lo que realmente se puede pedir hoy: disponible - reservado. */
  libre: number;
  proximoPeriodo: {
    fecha: string;
    diasParaLlegar: number;
    diasQueSeGanan: number | null;
    /** Dias que se perderian ese dia si no se usan antes. */
    diasEnRiesgo: number;
    /** true = estamos dentro del aviso previo y hay dias en riesgo. */
    avisar: boolean;
  };
}

interface FuncionarioParaSaldo {
  id: string;
  fechaIngreso: Date;
  estado: string;
  regimenVacaciones: {
    nombre: string;
    periodosMaximosAcumulables: number;
    diasAvisoAntesDeVencer: number;
    reglas: { aniosMinimos: number; aniosMaximos: number | null; diasPorPeriodo: Prisma.Decimal }[];
  };
}

/**
 * Saldo de vacaciones.
 *
 * El saldo NUNCA es un campo que se sobreescribe: es la suma de los
 * movimientos (saldo inicial + acumulaciones - consumos - vencimientos +/-
 * ajustes). Asi siempre se puede explicar de donde sale cada dia.
 *
 * Acumulacion: en cada aniversario de ingreso se suma un periodo completo
 * (los dias del tramo del regimen). Al sumarlo, lo que pase del tope
 * (periodos maximos x dias del periodo) se pierde y queda anotado como un
 * movimiento de vencimiento, no como un borrado.
 *
 * Desde cuando se acumula: RRHH carga el saldo inicial al crear al
 * funcionario. Esa fecha es el punto de partida: solo se acumulan los
 * aniversarios posteriores. Sin saldo inicial no se acumula nada.
 *
 * La acumulacion se calcula al consultar (sincronizar), de forma que no hace
 * falta ningun proceso nocturno: es idempotente y no repite periodos.
 */
@Injectable()
export class VacacionesService {
  private readonly registro = new Logger('Vacaciones');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Permisos de lectura                                               */
  /* ---------------------------------------------------------------- */

  /**
   * Puede ver el saldo de una persona: ella misma, RRHH, o su jefatura
   * inmediata (quien aprueba sus solicitudes necesita saber si le alcanza).
   */
  async exigirAccesoAlSaldo(funcionarioId: string, quienActua: UsuarioAutenticado): Promise<void> {
    if (quienActua.permisos.includes(PERMISO_ADMINISTRAR)) return;
    if (quienActua.funcionarioId === funcionarioId) return;

    if (quienActua.funcionarioId && quienActua.permisos.includes('solicitudes.aprobar')) {
      const persona = await this.prisma.funcionario.findUnique({
        where: { id: funcionarioId },
        select: { jefaturaId: true },
      });
      if (persona?.jefaturaId === quienActua.funcionarioId) return;
    }

    throw new ForbiddenException({
      codigo: 'SALDO_AJENO',
      message: 'Solo puede consultar su propio saldo de vacaciones.',
    });
  }

  /* ---------------------------------------------------------------- */
  /* Sincronizar (acumulacion y vencimiento)                           */
  /* ---------------------------------------------------------------- */

  /**
   * Registra los periodos que ya se ganaron (y los dias que se perdieron por
   * el tope) desde el ultimo aniversario registrado hasta hoy. Se puede
   * llamar las veces que sea: no duplica nada.
   */
  async sincronizar(funcionarioId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Bloquea a la persona mientras se calcula: dos consultas al mismo
      // tiempo no deben registrar el mismo periodo dos veces.
      await tx.$queryRaw`SELECT id FROM funcionario WHERE id = ${funcionarioId} FOR UPDATE`;

      const funcionario = await this.cargarFuncionario(tx, funcionarioId);
      if (!funcionario || funcionario.estado !== 'activo') return;

      const ancla = await tx.movimientoVacaciones.findFirst({
        where: { funcionarioId, tipo: 'saldoInicial' },
        orderBy: { fechaMovimiento: 'asc' },
        select: { fechaMovimiento: true },
      });
      if (!ancla) return;

      const tramos = tramosDe(funcionario);
      const hoy = hoyEnCostaRica();
      const ingreso = funcionario.fechaIngreso;

      for (let n = 1; n <= 80; n++) {
        const fecha = aniversario(ingreso, n);
        if (fecha > hoy) break;
        if (fecha <= ancla.fechaMovimiento) continue; // ya cubierto por el saldo inicial

        const periodo = etiquetaDePeriodo(ingreso, n);
        const yaRegistrado = await tx.movimientoVacaciones.findFirst({
          where: { funcionarioId, tipo: 'acumulacion', periodo },
          select: { id: true },
        });
        if (yaRegistrado) continue;

        const dias = diasDelPeriodo(tramos, n - 1);
        if (dias === null) {
          this.registro.warn(`El régimen ${funcionario.regimenVacaciones.nombre} no tiene tramo para ${n - 1} años de servicio`);
          continue;
        }

        const antes = await sumarMovimientos(tx, funcionarioId, fecha);
        await tx.movimientoVacaciones.create({
          data: { funcionarioId, tipo: 'acumulacion', cantidadDias: dias, fechaMovimiento: fecha, periodo },
        });

        const perdidos = excedenteDelTope(antes + dias, funcionario.regimenVacaciones.periodosMaximosAcumulables, dias);
        if (perdidos > 0) {
          await tx.movimientoVacaciones.create({
            data: {
              funcionarioId,
              tipo: 'vencimiento',
              cantidadDias: -perdidos,
              fechaMovimiento: fecha,
              periodo,
              observacion: `Superó el tope de ${funcionario.regimenVacaciones.periodosMaximosAcumulables} periodos acumulados.`,
            },
          });
        }
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Consultas                                                         */
  /* ---------------------------------------------------------------- */

  async resumen(funcionarioId: string): Promise<ResumenDeSaldo> {
    await this.sincronizar(funcionarioId);

    const funcionario = await this.cargarFuncionario(this.prisma, funcionarioId);
    if (!funcionario) throw this.noEncontrado();

    const porTipo = await this.prisma.movimientoVacaciones.groupBy({
      by: ['tipo'],
      where: { funcionarioId },
      _sum: { cantidadDias: true },
    });
    const suma = (tipo: string): number =>
      Number(porTipo.find((fila) => fila.tipo === tipo)?._sum.cantidadDias ?? 0);

    const inicial = suma('saldoInicial');
    const acumulacion = suma('acumulacion');
    const consumo = suma('consumo');
    const vencimiento = suma('vencimiento');
    const ajustes = suma('ajuste');
    const disponible = redondear(inicial + acumulacion + consumo + vencimiento + ajustes);

    const pendientes = await this.prisma.solicitud.aggregate({
      where: { funcionarioId, estado: 'pendiente', tipoSolicitud: { descuentaVacaciones: true } },
      _sum: { cantidadDias: true },
    });
    const reservado = Number(pendientes._sum.cantidadDias ?? 0);

    const ancla = await this.prisma.movimientoVacaciones.findFirst({
      where: { funcionarioId, tipo: 'saldoInicial' },
      select: { id: true },
    });

    const tramos = tramosDe(funcionario);
    const hoy = hoyEnCostaRica();
    const anios = aniosCumplidos(funcionario.fechaIngreso, hoy);
    const diasActuales = diasDelPeriodo(tramos, anios);
    const periodosMaximos = funcionario.regimenVacaciones.periodosMaximosAcumulables;

    const proxima = aniversario(funcionario.fechaIngreso, anios + 1);
    const diasParaLlegar = Math.round((proxima.getTime() - hoy.getTime()) / 86_400_000);
    const diasNuevo = diasDelPeriodo(tramos, anios);
    const saldoAlLlegar = await sumarMovimientos(this.prisma, funcionarioId, proxima);
    const enRiesgo = ancla && diasNuevo !== null ? excedenteDelTope(saldoAlLlegar + diasNuevo, periodosMaximos, diasNuevo) : 0;

    return {
      funcionarioId,
      saldoCargado: Boolean(ancla),
      regimen: {
        nombre: funcionario.regimenVacaciones.nombre,
        diasPorPeriodo: diasActuales,
        periodosMaximos,
        topeEnDias: diasActuales === null ? null : periodosMaximos * diasActuales,
      },
      aniosDeServicio: anios,
      inicial: redondear(inicial),
      ganadosPorAniversario: redondear(acumulacion),
      acumulado: redondear(inicial + acumulacion),
      utilizado: redondear(-consumo),
      vencido: redondear(-vencimiento),
      ajustes: redondear(ajustes),
      disponible,
      reservado: redondear(reservado),
      libre: redondear(disponible - reservado),
      proximoPeriodo: {
        fecha: aFechaSola(proxima)!,
        diasParaLlegar,
        diasQueSeGanan: diasNuevo,
        diasEnRiesgo: enRiesgo,
        avisar: enRiesgo > 0 && diasParaLlegar <= funcionario.regimenVacaciones.diasAvisoAntesDeVencer,
      },
    };
  }

  /** Historial de movimientos, del mas reciente al mas antiguo. */
  async movimientos(funcionarioId: string, filtros: ConsultarMovimientosDto): Promise<PaginaDeResultados<unknown>> {
    await this.sincronizar(funcionarioId);
    const where = { funcionarioId };
    const [total, filas] = await Promise.all([
      this.prisma.movimientoVacaciones.count({ where }),
      this.prisma.movimientoVacaciones.findMany({
        where,
        orderBy: [{ fechaMovimiento: 'desc' }, { fechaRegistro: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.tamano,
        take: filtros.tamano,
        select: {
          id: true,
          tipo: true,
          cantidadDias: true,
          fechaMovimiento: true,
          periodo: true,
          observacion: true,
          solicitud: { select: { id: true, consecutivo: true } },
          usuarioRegistro: { select: { id: true, correo: true } },
        },
      }),
    ]);

    const datos = filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      cantidadDias: Number(f.cantidadDias),
      fecha: aFechaSola(f.fechaMovimiento),
      periodo: f.periodo,
      observacion: f.observacion,
      solicitud: f.solicitud,
      registradoPor: f.usuarioRegistro?.correo ?? null,
    }));
    return armarPagina(datos, total, filtros.pagina, filtros.tamano);
  }

  /* ---------------------------------------------------------------- */
  /* Saldo inicial y ajustes (solo RRHH)                               */
  /* ---------------------------------------------------------------- */

  /**
   * Anota el saldo inicial de alguien (una sola vez). Lo usa el registro de
   * funcionarios, y tambien la pantalla de ajuste para quien se registro
   * antes de existir este modulo. Va dentro de la transaccion de quien llama.
   */
  async cargarSaldoInicial(
    tx: Prisma.TransactionClient,
    funcionarioId: string,
    dias: number,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<void> {
    const movimiento = await tx.movimientoVacaciones.create({
      data: {
        funcionarioId,
        tipo: 'saldoInicial',
        cantidadDias: dias,
        fechaMovimiento: hoyEnCostaRica(),
        usuarioRegistroId: quienActua.id,
        observacion: 'Saldo inicial cargado por Recursos Humanos.',
      },
    });
    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        funcionarioAfectadoId: funcionarioId,
        entidad: 'movimientoVacaciones',
        registroAfectadoId: movimiento.id,
        accion: 'crear',
        direccionIp,
        datosNuevos: { tipo: 'saldoInicial', dias },
        descripcion: `Cargó el saldo inicial de vacaciones: ${dias} día(s).`,
      },
      tx,
    );
  }

  /**
   * Pantalla discreta de «Editar funcionario»: carga el saldo inicial si
   * todavia no existe, o registra un ajuste (positivo o negativo) con motivo.
   */
  async ajustar(
    funcionarioId: string,
    datos: AjustarSaldoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ResumenDeSaldo> {
    const funcionario = await this.prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { id: true } });
    if (!funcionario) throw this.noEncontrado();

    await this.sincronizar(funcionarioId);

    const tieneAncla = Boolean(
      await this.prisma.movimientoVacaciones.findFirst({ where: { funcionarioId, tipo: 'saldoInicial' }, select: { id: true } }),
    );

    await this.prisma.$transaction(async (tx) => {
      if (!tieneAncla) {
        if (datos.dias < 0) {
          throw new BadRequestException({ codigo: 'SALDO_INICIAL_NEGATIVO', message: 'El saldo inicial no puede ser negativo.' });
        }
        await this.cargarSaldoInicial(tx, funcionarioId, datos.dias, quienActua, direccionIp);
        return;
      }

      const disponible = await sumarMovimientos(tx, funcionarioId, null);
      if (disponible + datos.dias < 0) {
        throw new BadRequestException({
          codigo: 'SALDO_NEGATIVO',
          message: `El ajuste dejaría el saldo en negativo (hoy hay ${disponible} día(s)).`,
        });
      }
      const movimiento = await tx.movimientoVacaciones.create({
        data: {
          funcionarioId,
          tipo: 'ajuste',
          cantidadDias: datos.dias,
          fechaMovimiento: hoyEnCostaRica(),
          usuarioRegistroId: quienActua.id,
          observacion: datos.motivo,
        },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: funcionarioId,
          entidad: 'movimientoVacaciones',
          registroAfectadoId: movimiento.id,
          accion: 'crear',
          direccionIp,
          datosAnteriores: { disponible },
          datosNuevos: { tipo: 'ajuste', dias: datos.dias, motivo: datos.motivo },
          descripcion: `Ajustó el saldo de vacaciones en ${datos.dias > 0 ? '+' : ''}${datos.dias} día(s).`,
        },
        tx,
      );
    });

    return this.resumen(funcionarioId);
  }

  /* ---------------------------------------------------------------- */
  /* Apoyo                                                             */
  /* ---------------------------------------------------------------- */

  private cargarFuncionario(cliente: Prisma.TransactionClient | PrismaService, id: string): Promise<FuncionarioParaSaldo | null> {
    return cliente.funcionario.findUnique({
      where: { id },
      select: {
        id: true,
        fechaIngreso: true,
        estado: true,
        regimenVacaciones: {
          select: {
            nombre: true,
            periodosMaximosAcumulables: true,
            diasAvisoAntesDeVencer: true,
            reglas: {
              where: { activo: true },
              select: { aniosMinimos: true, aniosMaximos: true, diasPorPeriodo: true },
            },
          },
        },
      },
    });
  }

  private noEncontrado(): NotFoundException {
    return new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
  }
}

function tramosDe(funcionario: FuncionarioParaSaldo): Tramo[] {
  return funcionario.regimenVacaciones.reglas.map((r) => ({
    aniosMinimos: r.aniosMinimos,
    aniosMaximos: r.aniosMaximos,
    diasPorPeriodo: Number(r.diasPorPeriodo),
  }));
}

/** Suma de los movimientos hasta una fecha (incluida). Sin fecha, todos. */
export async function sumarMovimientos(
  cliente: Prisma.TransactionClient | PrismaService,
  funcionarioId: string,
  hasta: Date | null,
): Promise<number> {
  const resultado = await cliente.movimientoVacaciones.aggregate({
    where: { funcionarioId, ...(hasta ? { fechaMovimiento: { lte: hasta } } : {}) },
    _sum: { cantidadDias: true },
  });
  return redondear(Number(resultado._sum.cantidadDias ?? 0));
}
