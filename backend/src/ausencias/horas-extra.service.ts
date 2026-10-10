import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnularDto, ConsultarHorasExtraDto, RegistrarHoraExtraDto } from './dto.js';

/** Un registro no puede pasar de 16 horas (jornada + extra razonable). */
const MAXIMO_DE_HORAS = 16;

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Horas entre dos horas "HH:MM". Si la de fin es menor o igual que la de
 * inicio, termina al dia siguiente (jornada nocturna). Redondeado a 2 decimales.
 */
export function horasEntre(inicio: string, fin: string): number {
  let diferencia = minutos(fin) - minutos(inicio);
  if (diferencia <= 0) diferencia += 24 * 60;
  return Math.round((diferencia / 60) * 100) / 100;
}

/** Tramo en minutos desde el inicio del dia de la fecha (el fin puede pasar de 1440). */
function tramo(horaInicio: string, horaFin: string): [number, number] {
  const a = minutos(horaInicio);
  let b = minutos(horaFin);
  if (b <= a) b += 24 * 60;
  return [a, b];
}

const SELECCION = {
  id: true,
  fecha: true,
  horaInicio: true,
  horaFin: true,
  cantidadHoras: true,
  motivo: true,
  fechaRegistro: true,
  vigente: true,
  motivoAnulacion: true,
  funcionario: { select: { id: true, nombre: true, primerApellido: true, segundoApellido: true, departamento: { select: { nombre: true } } } },
  usuarioRegistro: { select: { funcionario: { select: { nombre: true, primerApellido: true } }, correo: true } },
} satisfies Prisma.horaExtraSelect;

type Fila = Prisma.horaExtraGetPayload<{ select: typeof SELECCION }>;

export interface HoraExtraDeLista {
  id: string;
  funcionario: { id: string; nombre: string; departamento: string | null };
  fecha: string;
  horaInicio: string;
  horaFin: string;
  cantidadHoras: number;
  /** Termina al dia siguiente. */
  nocturna: boolean;
  motivo: string | null;
  registradaPor: string;
  fechaRegistro: string;
  vigente: boolean;
  motivoAnulacion: string | null;
}

export interface ResumenDeHorasExtra {
  mes: string;
  totalHoras: number;
  totalRegistros: number;
  /** Total de horas por persona en el mes (vigentes), de mayor a menor. */
  porPersona: { funcionario: { id: string; nombre: string; departamento: string | null }; horas: number; registros: number }[];
  registros: PaginaDeResultados<HoraExtraDeLista>;
}

/**
 * Horas extra (decision de Josthyn, 30/09): solo un REGISTRO que lleva
 * Recursos Humanos, sin aprobacion (las autorizo la jefatura fuera del
 * sistema). Sirve para consultar cuantas horas hizo cada persona por mes.
 * No se borran: un error se anula con motivo (queda en la bitacora).
 */
@Injectable()
export class HorasExtraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async consultar(filtros: ConsultarHorasExtraDto): Promise<ResumenDeHorasExtra> {
    const mes = filtros.mes ?? aFechaSola(hoyEnCostaRica())!.slice(0, 7);
    const anio = Number(mes.slice(0, 4));
    const m = Number(mes.slice(5, 7));
    const donde: Prisma.horaExtraWhereInput = {
      fecha: { gte: new Date(Date.UTC(anio, m - 1, 1)), lte: new Date(Date.UTC(anio, m, 0)) },
    };
    if (!filtros.incluirAnuladas) donde.vigente = true;
    if (filtros.funcionarioId) donde.funcionarioId = filtros.funcionarioId;
    if (filtros.departamentoId) donde.funcionario = { departamentoId: filtros.departamentoId };
    if (filtros.busqueda) {
      const palabras = filtros.busqueda.split(/\s+/).filter(Boolean).slice(0, 5);
      donde.AND = palabras.map((p) => ({
        OR: [
          { funcionario: { cedula: { contains: p } } },
          { funcionario: { nombre: { contains: p } } },
          { funcionario: { primerApellido: { contains: p } } },
          { funcionario: { segundoApellido: { contains: p } } },
        ],
      }));
    }

    const [total, filas, grupos] = await Promise.all([
      this.prisma.horaExtra.count({ where: donde }),
      this.prisma.horaExtra.findMany({
        where: donde,
        orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.tamano,
        take: filtros.tamano,
        select: SELECCION,
      }),
      this.prisma.horaExtra.groupBy({
        by: ['funcionarioId'],
        where: { ...donde, vigente: true },
        _sum: { cantidadHoras: true },
        _count: { _all: true },
      }),
    ]);
    const personas = await this.prisma.funcionario.findMany({
      where: { id: { in: grupos.map((g) => g.funcionarioId) } },
      select: { id: true, nombre: true, primerApellido: true, segundoApellido: true, departamento: { select: { nombre: true } } },
    });
    const porId = new Map(personas.map((p) => [p.id, p]));
    const porPersona = grupos
      .map((g) => {
        const p = porId.get(g.funcionarioId)!;
        return {
          funcionario: { id: p.id, nombre: [p.nombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' '), departamento: p.departamento?.nombre ?? null },
          horas: Number(g._sum.cantidadHoras ?? 0),
          registros: g._count._all,
        };
      })
      .sort((a, b) => b.horas - a.horas || a.funcionario.nombre.localeCompare(b.funcionario.nombre));

    return {
      mes,
      totalHoras: Math.round(porPersona.reduce((s, p) => s + p.horas, 0) * 100) / 100,
      totalRegistros: porPersona.reduce((s, p) => s + p.registros, 0),
      porPersona,
      registros: armarPagina(filas.map(aLista), total, filtros.pagina, filtros.tamano),
    };
  }

  async registrar(datos: RegistrarHoraExtraDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<HoraExtraDeLista> {
    const persona = await this.prisma.funcionario.findUnique({
      where: { id: datos.funcionarioId },
      select: { estado: true, nombre: true, primerApellido: true },
    });
    if (!persona) throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    if (persona.estado !== 'activo') throw new BadRequestException({ codigo: 'FUNCIONARIO_INACTIVO', message: 'La persona no está activa.' });

    const fecha = interpretarFechaSola(datos.fecha, 'de las horas extra');
    if (fecha > hoyEnCostaRica()) {
      throw new BadRequestException({ codigo: 'FECHA_FUTURA', message: 'Las horas extra se registran cuando ya se hicieron: la fecha no puede ser futura.' });
    }
    if (datos.horaInicio === datos.horaFin) {
      throw new BadRequestException({ codigo: 'HORAS_NO_VALIDAS', message: 'La hora de inicio y la de fin no pueden ser iguales.' });
    }
    const horas = horasEntre(datos.horaInicio, datos.horaFin);
    if (horas > MAXIMO_DE_HORAS) {
      throw new BadRequestException({ codigo: 'HORAS_NO_VALIDAS', message: `Un registro no puede pasar de ${MAXIMO_DE_HORAS} horas. Revise las horas (o divídalo en dos días).` });
    }

    // Que no se cruce con otro registro de la misma persona (mismo dia, o el anterior si fue nocturno).
    const [a, b] = tramo(datos.horaInicio, datos.horaFin);
    const ayer = new Date(fecha.getTime() - 86_400_000);
    const vecinos = await this.prisma.horaExtra.findMany({
      where: { funcionarioId: datos.funcionarioId, vigente: true, fecha: { in: [ayer, fecha, new Date(fecha.getTime() + 86_400_000)] } },
      select: { fecha: true, horaInicio: true, horaFin: true },
    });
    const cruza = vecinos.some((v) => {
      const desplazamiento = Math.round((v.fecha.getTime() - fecha.getTime()) / 86_400_000) * 1440;
      const [c, d] = tramo(v.horaInicio, v.horaFin);
      return a < d + desplazamiento && c + desplazamiento < b;
    });
    if (cruza) throw new ConflictException({ codigo: 'HORAS_TRASLAPADAS', message: 'Ya hay horas extra registradas de esta persona que se cruzan con ese horario.' });

    const creada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.horaExtra.create({
        data: {
          funcionarioId: datos.funcionarioId,
          fecha,
          horaInicio: datos.horaInicio,
          horaFin: datos.horaFin,
          cantidadHoras: horas,
          motivo: datos.motivo ?? null,
          usuarioRegistroId: quienActua.id,
        },
        select: { id: true },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: datos.funcionarioId,
          entidad: 'horaExtra',
          registroAfectadoId: fila.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { fecha: datos.fecha, horaInicio: datos.horaInicio, horaFin: datos.horaFin, horas },
          descripcion: `Registró ${horas} hora(s) extra de ${persona.nombre} ${persona.primerApellido} el ${datos.fecha} (${datos.horaInicio} a ${datos.horaFin}).`,
        },
        tx,
      );
      return fila;
    });
    return aLista(await this.prisma.horaExtra.findUniqueOrThrow({ where: { id: creada.id }, select: SELECCION }));
  }

  async anular(id: string, datos: AnularDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<HoraExtraDeLista> {
    const fila = await this.prisma.horaExtra.findUnique({ where: { id }, select: { vigente: true, funcionarioId: true, fecha: true, cantidadHoras: true } });
    if (!fila) throw new NotFoundException({ codigo: 'HORA_EXTRA_NO_ENCONTRADA', message: 'No se encontró el registro de horas extra.' });
    if (!fila.vigente) throw new ConflictException({ codigo: 'HORA_EXTRA_YA_ANULADA', message: 'Ese registro ya está anulado.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.horaExtra.update({ where: { id }, data: { vigente: false, motivoAnulacion: datos.motivo, usuarioAnulacionId: quienActua.id, fechaAnulacion: new Date() } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: fila.funcionarioId,
          entidad: 'horaExtra',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosNuevos: { vigente: false, motivo: datos.motivo },
          descripcion: `Anuló ${Number(fila.cantidadHoras)} hora(s) extra del ${aFechaSola(fila.fecha)}: ${datos.motivo}`,
        },
        tx,
      );
    });
    return aLista(await this.prisma.horaExtra.findUniqueOrThrow({ where: { id }, select: SELECCION }));
  }
}

function aLista(f: Fila): HoraExtraDeLista {
  return {
    id: f.id,
    funcionario: {
      id: f.funcionario.id,
      nombre: [f.funcionario.nombre, f.funcionario.primerApellido, f.funcionario.segundoApellido].filter(Boolean).join(' '),
      departamento: f.funcionario.departamento?.nombre ?? null,
    },
    fecha: aFechaSola(f.fecha)!,
    horaInicio: f.horaInicio,
    horaFin: f.horaFin,
    cantidadHoras: Number(f.cantidadHoras),
    nocturna: minutos(f.horaFin) <= minutos(f.horaInicio),
    motivo: f.motivo,
    registradaPor: f.usuarioRegistro.funcionario ? `${f.usuarioRegistro.funcionario.nombre} ${f.usuarioRegistro.funcionario.primerApellido}` : f.usuarioRegistro.correo,
    fechaRegistro: f.fechaRegistro.toISOString(),
    vigente: f.vigente,
    motivoAnulacion: f.motivoAnulacion,
  };
}
