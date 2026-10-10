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
const MAXIMO_DE_MINUTOS = MAXIMO_DE_HORAS * 60;

/** "2 h 40 min", "45 min", "3 h" (para la bitacora y los mensajes). */
export function textoDeMinutos(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Minutos entre dos horas "HH:MM" (las horas son de 60 minutos: 17:00 a 19:40
 * son 160 minutos = 2 h 40 min). Si la de fin es menor o igual que la de
 * inicio, termina al dia siguiente (jornada nocturna).
 */
export function minutosEntre(inicio: string, fin: string): number {
  let diferencia = minutos(fin) - minutos(inicio);
  if (diferencia <= 0) diferencia += 24 * 60;
  return diferencia;
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
  cantidadMinutos: true,
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
  /** Duracion en minutos (la pantalla la muestra como "2 h 40 min"). */
  cantidadMinutos: number;
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
  totalMinutos: number;
  totalRegistros: number;
  /** Total de minutos por persona en el mes (vigentes), de mayor a menor. */
  porPersona: { funcionario: { id: string; nombre: string; departamento: string | null }; minutos: number; registros: number }[];
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
        _sum: { cantidadMinutos: true },
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
          minutos: g._sum.cantidadMinutos ?? 0,
          registros: g._count._all,
        };
      })
      .sort((a, b) => b.minutos - a.minutos || a.funcionario.nombre.localeCompare(b.funcionario.nombre));

    return {
      mes,
      totalMinutos: porPersona.reduce((s, p) => s + p.minutos, 0),
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

    // Solo se revisa que la fecha este dentro de un anio hacia atras o hacia adelante (decision 09/10).
    const fecha = interpretarFechaSola(datos.fecha, 'de las horas extra');
    const hoy = hoyEnCostaRica();
    const haceUnAnio = new Date(Date.UTC(hoy.getUTCFullYear() - 1, hoy.getUTCMonth(), hoy.getUTCDate()));
    const enUnAnio = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), hoy.getUTCDate()));
    if (fecha < haceUnAnio || fecha > enUnAnio) {
      throw new BadRequestException({
        codigo: 'FECHA_FUERA_DE_RANGO',
        message: `La fecha debe estar entre el ${aFechaSola(haceUnAnio)} y el ${aFechaSola(enUnAnio)} (un año hacia atrás o hacia adelante).`,
      });
    }
    if (datos.horaInicio === datos.horaFin) {
      throw new BadRequestException({ codigo: 'HORAS_NO_VALIDAS', message: 'La hora de inicio y la de fin no pueden ser iguales.' });
    }
    const duracion = minutosEntre(datos.horaInicio, datos.horaFin);
    if (duracion > MAXIMO_DE_MINUTOS) {
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
          cantidadMinutos: duracion,
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
          datosNuevos: { fecha: datos.fecha, horaInicio: datos.horaInicio, horaFin: datos.horaFin, minutos: duracion },
          descripcion: `Registró ${textoDeMinutos(duracion)} de horas extra de ${persona.nombre} ${persona.primerApellido} el ${datos.fecha} (${datos.horaInicio} a ${datos.horaFin}).`,
        },
        tx,
      );
      return fila;
    });
    return aLista(await this.prisma.horaExtra.findUniqueOrThrow({ where: { id: creada.id }, select: SELECCION }));
  }

  async anular(id: string, datos: AnularDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<HoraExtraDeLista> {
    const fila = await this.prisma.horaExtra.findUnique({ where: { id }, select: { vigente: true, funcionarioId: true, fecha: true, cantidadMinutos: true } });
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
          descripcion: `Anuló ${textoDeMinutos(fila.cantidadMinutos)} de horas extra del ${aFechaSola(fila.fecha)}: ${datos.motivo}`,
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
    cantidadMinutos: f.cantidadMinutos,
    nocturna: minutos(f.horaFin) <= minutos(f.horaInicio),
    motivo: f.motivo,
    registradaPor: f.usuarioRegistro.funcionario ? `${f.usuarioRegistro.funcionario.nombre} ${f.usuarioRegistro.funcionario.primerApellido}` : f.usuarioRegistro.correo,
    fechaRegistro: f.fechaRegistro.toISOString(),
    vigente: f.vigente,
    motivoAnulacion: f.motivoAnulacion,
  };
}
