import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearDiaNoLaborableDto, EditarDiaNoLaborableDto } from './dto/dias-no-laborables.dto.js';
import { FERIADOS_DE_LEY_CR, feriadosEnRango, proximaFecha, type ReglaDeFeriado } from './feriados.js';

export interface DiaNoLaborable {
  id: string;
  nombre: string;
  regla: ReglaDeFeriado;
  /** Solo "fija". */
  mes: number | null;
  dia: number | null;
  /** Solo "unica" (AAAA-MM-DD). */
  fecha: string | null;
  activo: boolean;
  /** La proxima vez que cae (hoy incluido); null si ya paso y no se repite. */
  proxima: string | null;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

/** "15 de setiembre", "2026-12-24" o "Jueves Santo": para la bitacora y los mensajes. */
function cuando(d: { regla: string; mes: number | null; dia: number | null; fecha: Date | string | null }): string {
  if (d.regla === 'fija') return `${d.dia} de ${MESES[(d.mes ?? 1) - 1]} (cada año)`;
  if (d.regla === 'unica') return typeof d.fecha === 'string' ? d.fecha : (aFechaSola(d.fecha) ?? '');
  return d.regla === 'juevesSanto' ? 'Jueves Santo (cada año)' : 'Viernes Santo (cada año)';
}

/**
 * Catalogo de feriados y asuetos (decision de Josthyn, 01/10/2026): RRHH los
 * digita UNA vez y el sistema los repite solo cada anio. Ver feriados.ts
 * para las reglas (fija, unica, Jueves y Viernes Santo calculados con la
 * Pascua). Sirven para contar dias habiles y para pintar el calendario.
 * Cambiar un feriado no altera solicitudes ya hechas: cada una guardo sus
 * dias habiles al pedirse.
 */
@Injectable()
export class DiasNoLaborablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** El catalogo completo (pantalla de RRHH), ordenado por la proxima vez que cae. */
  async catalogo(): Promise<DiaNoLaborable[]> {
    const filas = await this.prisma.diaNoLaborable.findMany();
    const hoy = hoyEnCostaRica();
    return filas
      .map((f) => aDia(f, hoy))
      .sort((a, b) => (a.proxima ?? '9999').localeCompare(b.proxima ?? '9999') || a.nombre.localeCompare(b.nombre));
  }

  /** Las fechas de un anio (activas), ya calculadas: para el selector de fechas y el calendario. */
  async fechasDelAnio(anio: number): Promise<{ fecha: string; nombre: string }[]> {
    const mapa = await this.entre(new Date(Date.UTC(anio, 0, 1)), new Date(Date.UTC(anio, 11, 31)));
    return [...mapa.entries()].map(([fecha, nombre]) => ({ fecha, nombre }));
  }

  /** Feriados activos entre dos fechas: "AAAA-MM-DD" -> nombre. Lo usan las solicitudes. */
  async entre(desde: Date, hasta: Date, cliente: Prisma.TransactionClient | PrismaService = this.prisma): Promise<Map<string, string>> {
    const catalogo = await cliente.diaNoLaborable.findMany({
      where: { activo: true },
      select: { nombre: true, regla: true, mes: true, dia: true, fecha: true },
    });
    return feriadosEnRango(catalogo, desde, hasta);
  }

  async crear(datos: CrearDiaNoLaborableDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable> {
    const valores = this.normalizar(datos.regla, datos.mes, datos.dia, datos.fecha);
    await this.revisarRepetido(valores, null);
    const creado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.diaNoLaborable.create({ data: { nombre: datos.nombre, ...valores } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: fila.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { nombre: datos.nombre, regla: valores.regla, cuando: cuando(valores) },
          descripcion: `Agregó el feriado «${datos.nombre}»: ${cuando(valores)}.`,
        },
        tx,
      );
      return fila;
    });
    return aDia(creado, hoyEnCostaRica());
  }

  async editar(id: string, datos: EditarDiaNoLaborableDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable> {
    const actual = await this.cargar(id);
    // La fecha se manda completa (regla y sus datos); si no viene, queda la que estaba.
    const tocaFecha = datos.regla !== undefined || datos.mes !== undefined || datos.dia !== undefined || datos.fecha !== undefined;
    const valores = tocaFecha
      ? this.normalizar(datos.regla ?? (actual.regla as ReglaDeFeriado), datos.mes ?? actual.mes ?? undefined, datos.dia ?? actual.dia ?? undefined, datos.fecha ?? aFechaSola(actual.fecha) ?? undefined)
      : null;

    const cambios: Prisma.diaNoLaborableUpdateInput = {};
    if (datos.nombre !== undefined && datos.nombre !== actual.nombre) cambios.nombre = datos.nombre;
    if (datos.activo !== undefined && datos.activo !== actual.activo) cambios.activo = datos.activo;
    if (valores && cuando(valores) !== cuando(actual)) Object.assign(cambios, valores);
    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay cambios que guardar: los datos ya son esos.' });
    }
    if (valores && cambios.regla !== undefined) await this.revisarRepetido(valores, id);

    const editado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.diaNoLaborable.update({ where: { id }, data: cambios });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { nombre: actual.nombre, cuando: cuando(actual), activo: actual.activo },
          datosNuevos: { nombre: fila.nombre, cuando: cuando(fila), activo: fila.activo },
          descripcion: `Modificó el feriado «${actual.nombre}» (${cuando(actual)}).`,
        },
        tx,
      );
      return fila;
    });
    return aDia(editado, hoyEnCostaRica());
  }

  async eliminar(id: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<{ mensaje: string }> {
    const actual = await this.cargar(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.diaNoLaborable.delete({ where: { id } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: id,
          accion: 'eliminar',
          direccionIp,
          datosAnteriores: { nombre: actual.nombre, cuando: cuando(actual) },
          descripcion: `Quitó el feriado «${actual.nombre}» (${cuando(actual)}).`,
        },
        tx,
      );
    });
    return { mensaje: 'Feriado eliminado.' };
  }

  /**
   * Agrega los feriados de ley de Costa Rica que todavia no esten en el
   * catalogo (mismo dia y mes, o la misma regla de Semana Santa). No toca
   * los que ya estan. Devuelve los que agrego.
   */
  async cargarDeLey(quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable[]> {
    const existentes = await this.prisma.diaNoLaborable.findMany({ select: { regla: true, mes: true, dia: true } });
    const ya = new Set(existentes.map((e) => (e.regla === 'fija' ? `${e.mes}-${e.dia}` : e.regla)));
    const faltan = FERIADOS_DE_LEY_CR.filter((f) => !ya.has(f.regla === 'fija' ? `${f.mes}-${f.dia}` : f.regla));
    if (faltan.length === 0) return [];
    const hoy = hoyEnCostaRica();
    return this.prisma.$transaction(async (tx) => {
      const creados: DiaNoLaborable[] = [];
      for (const f of faltan) {
        const fila = await tx.diaNoLaborable.create({
          data: { nombre: f.nombre, regla: f.regla, mes: f.mes ?? null, dia: f.dia ?? null, fecha: null },
        });
        creados.push(aDia(fila, hoy));
      }
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: creados[0].id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { agregados: creados.map((c) => c.nombre) },
          descripcion: `Cargó los feriados de ley de Costa Rica (${creados.length} nuevo(s)).`,
        },
        tx,
      );
      return creados;
    });
  }

  /* ---------------------------------------------------------------- */

  /** Valida los datos de la regla y deja solo las columnas que le corresponden. */
  private normalizar(regla: ReglaDeFeriado, mes?: number, dia?: number, fecha?: string) {
    if (regla === 'fija') {
      if (!mes || !dia) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: 'Indique el día y el mes del feriado.' });
      const maximo = new Date(Date.UTC(2000, mes, 0)).getUTCDate(); // 2000 es bisiesto: acepta el 29 de febrero
      if (dia > maximo) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: `${MESES[mes - 1]} no tiene ${dia} días.` });
      return { regla, mes, dia, fecha: null };
    }
    if (regla === 'unica') {
      if (!fecha) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: 'Indique la fecha del día no laborable.' });
      return { regla, mes: null, dia: null, fecha: interpretarFechaSola(fecha, 'del feriado') };
    }
    return { regla, mes: null, dia: null, fecha: null };
  }

  private async revisarRepetido(v: { regla: string; mes: number | null; dia: number | null; fecha: Date | null }, salvoId: string | null): Promise<void> {
    const donde: Prisma.diaNoLaborableWhereInput =
      v.regla === 'fija' ? { mes: v.mes, dia: v.dia } : v.regla === 'unica' ? { fecha: v.fecha } : { regla: v.regla };
    const otro = await this.prisma.diaNoLaborable.findFirst({ where: { ...donde, ...(salvoId ? { NOT: { id: salvoId } } : {}) } });
    if (otro) {
      throw new ConflictException({
        codigo: 'FECHA_YA_REGISTRADA',
        message: `Ese día ya está en el catálogo como «${otro.nombre}».`,
      });
    }
  }

  private async cargar(id: string) {
    const fila = await this.prisma.diaNoLaborable.findUnique({ where: { id } });
    if (!fila) {
      throw new NotFoundException({ codigo: 'DIA_NO_ENCONTRADO', message: 'No se encontró el feriado indicado.' });
    }
    return fila;
  }
}

function aDia(
  f: { id: string; nombre: string; regla: string; mes: number | null; dia: number | null; fecha: Date | null; activo: boolean },
  hoy: Date,
): DiaNoLaborable {
  return {
    id: f.id,
    nombre: f.nombre,
    regla: f.regla as ReglaDeFeriado,
    mes: f.mes,
    dia: f.dia,
    fecha: aFechaSola(f.fecha) ?? null,
    activo: f.activo,
    proxima: aFechaSola(proximaFecha(f, hoy)) ?? null,
  };
}
