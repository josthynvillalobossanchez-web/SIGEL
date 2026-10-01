import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { aFechaSola, interpretarFechaSola } from '../comun/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearDiaNoLaborableDto, EditarDiaNoLaborableDto } from './dto/dias-no-laborables.dto.js';

export interface DiaNoLaborable {
  id: string;
  fecha: string;
  nombre: string;
  recurrenteAnual: boolean;
  activo: boolean;
}

/**
 * Feriados de ley y asuetos municipales. Los carga y mantiene Recursos
 * Humanos por anio (la ley cambia y ellos son quienes la conocen); sirven
 * para contar dias habiles y para pintar el calendario.
 *
 * Los marcados "recurrentes" (feriados de ley que se repiten) permiten
 * proponer el calendario del anio siguiente: se copian y RRHH solo ajusta
 * lo que cambie. Cambiar un feriado no altera solicitudes ya hechas: cada
 * una guarda sus dias habiles al momento de pedirse.
 */
@Injectable()
export class DiasNoLaborablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(anio: number): Promise<DiaNoLaborable[]> {
    const filas = await this.prisma.diaNoLaborable.findMany({
      where: { fecha: { gte: new Date(Date.UTC(anio, 0, 1)), lte: new Date(Date.UTC(anio, 11, 31)) } },
      orderBy: { fecha: 'asc' },
    });
    return filas.map(aDia);
  }

  async crear(datos: CrearDiaNoLaborableDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable> {
    const fecha = interpretarFechaSola(datos.fecha, 'del feriado');
    const existente = await this.prisma.diaNoLaborable.findUnique({ where: { fecha } });
    if (existente) {
      throw new ConflictException({
        codigo: 'FECHA_YA_REGISTRADA',
        message: `Esa fecha ya está registrada como «${existente.nombre}».`,
      });
    }
    const creado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.diaNoLaborable.create({
        data: { fecha, nombre: datos.nombre, recurrenteAnual: datos.recurrenteAnual ?? true },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: fila.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { fecha: datos.fecha, nombre: datos.nombre, recurrenteAnual: fila.recurrenteAnual },
          descripcion: `Agregó el día no laborable «${datos.nombre}» (${datos.fecha}).`,
        },
        tx,
      );
      return fila;
    });
    return aDia(creado);
  }

  async editar(id: string, datos: EditarDiaNoLaborableDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable> {
    const actual = await this.cargar(id);
    const cambios: EditarDiaNoLaborableDto = {};
    if (datos.nombre !== undefined && datos.nombre !== actual.nombre) cambios.nombre = datos.nombre;
    if (datos.recurrenteAnual !== undefined && datos.recurrenteAnual !== actual.recurrenteAnual) cambios.recurrenteAnual = datos.recurrenteAnual;
    if (datos.activo !== undefined && datos.activo !== actual.activo) cambios.activo = datos.activo;
    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay cambios que guardar: los datos ya son esos.' });
    }
    const editado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.diaNoLaborable.update({ where: { id }, data: cambios });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { nombre: actual.nombre, recurrenteAnual: actual.recurrenteAnual, activo: actual.activo },
          datosNuevos: cambios as Record<string, unknown>,
          descripcion: `Modificó el día no laborable «${actual.nombre}» (${aFechaSola(actual.fecha)}).`,
        },
        tx,
      );
      return fila;
    });
    return aDia(editado);
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
          datosAnteriores: { fecha: aFechaSola(actual.fecha), nombre: actual.nombre },
          descripcion: `Quitó el día no laborable «${actual.nombre}» (${aFechaSola(actual.fecha)}).`,
        },
        tx,
      );
    });
    return { mensaje: 'Día no laborable eliminado.' };
  }

  /**
   * Copia al anio indicado los feriados recurrentes del anio anterior que
   * todavia no existan (misma fecha, mismo nombre). Devuelve lo que creo.
   */
  async proponerAnio(anio: number, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DiaNoLaborable[]> {
    const base = await this.prisma.diaNoLaborable.findMany({
      where: {
        recurrenteAnual: true,
        activo: true,
        fecha: { gte: new Date(Date.UTC(anio - 1, 0, 1)), lte: new Date(Date.UTC(anio - 1, 11, 31)) },
      },
    });
    if (base.length === 0) {
      throw new BadRequestException({
        codigo: 'SIN_BASE_PARA_PROPONER',
        message: `No hay feriados recurrentes cargados en ${anio - 1} para copiar a ${anio}.`,
      });
    }

    const creados: DiaNoLaborable[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const dia of base) {
        // 29 de febrero: en un anio que no es bisiesto, JavaScript lo pasa a marzo; se omite.
        const fecha = new Date(Date.UTC(anio, dia.fecha.getUTCMonth(), dia.fecha.getUTCDate()));
        if (fecha.getUTCMonth() !== dia.fecha.getUTCMonth()) continue;
        if (await tx.diaNoLaborable.findUnique({ where: { fecha } })) continue;
        const fila = await tx.diaNoLaborable.create({ data: { fecha, nombre: dia.nombre, recurrenteAnual: true } });
        creados.push(aDia(fila));
      }
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'diaNoLaborable',
          registroAfectadoId: base[0].id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { anio, creados: creados.length },
          descripcion: `Propuso el calendario de ${anio} a partir de los feriados recurrentes de ${anio - 1} (${creados.length} día(s) nuevo(s)).`,
        },
        tx,
      );
    });
    return creados;
  }

  private async cargar(id: string) {
    const fila = await this.prisma.diaNoLaborable.findUnique({ where: { id } });
    if (!fila) {
      throw new NotFoundException({ codigo: 'DIA_NO_ENCONTRADO', message: 'No se encontró el día no laborable indicado.' });
    }
    return fila;
  }
}

function aDia(f: { id: string; fecha: Date; nombre: string; recurrenteAnual: boolean; activo: boolean }): DiaNoLaborable {
  return { id: f.id, fecha: aFechaSola(f.fecha)!, nombre: f.nombre, recurrenteAnual: f.recurrenteAnual, activo: f.activo };
}
