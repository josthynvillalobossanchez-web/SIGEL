import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { guardarFormatos, leerFormatos, type Formato } from '../almacenamiento/validacion-de-archivos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearTipoDocumentoDto, EditarTipoDocumentoDto } from './dto/tipo-documento.dto.js';

/** Un tipo de documento tal como lo devuelve la API. */
export interface TipoDeDocumento {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** true = lo genera SINERGIA (solo se puede renombrar). */
  generadoPorSistema: boolean;
  /** Formatos de archivo que acepta. */
  formatos: Formato[];
  /** Documentos VIGENTES de este tipo. */
  cantidadDocumentos: number;
}

const SELECCION = {
  id: true,
  nombre: true,
  descripcion: true,
  activo: true,
  generadoPorSistema: true,
  formatosPermitidos: true,
  _count: { select: { documentos: { where: { vigente: true } } } },
} as const;

type Fila = Prisma.tipoDocumentoGetPayload<{ select: typeof SELECCION }>;
type Cliente = Prisma.TransactionClient | PrismaService;

function aTipo(fila: Fila): TipoDeDocumento {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    activo: fila.activo,
    generadoPorSistema: fila.generadoPorSistema,
    formatos: leerFormatos(fila.formatosPermitidos),
    cantidadDocumentos: fila._count.documentos,
  };
}

/**
 * Catalogo de tipos de documento (Ficha 18).
 *
 * Reglas:
 *   - Consultar solo pide sesion (los formularios de subida lo necesitan).
 *     Administrar pide "tiposDocumento.editar".
 *   - Cada tipo dice que formatos acepta (subconjunto de PDF, JPG y PNG).
 *     Cambiarlos no toca los documentos ya subidos: los conservan.
 *   - Los tipos que GENERA SINERGIA (constancia de vacaciones, curriculum
 *     del Talent Pool...) dependen de una plantilla programada: solo se
 *     pueden RENOMBRAR. No se crean desde aqui, ni se cambian sus formatos
 *     o descripcion, ni se inactivan.
 *   - No se borra nada: se inactiva. Un tipo inactivo no se puede elegir
 *     para documentos nuevos, pero los existentes lo conservan.
 *   - El nombre no se repite (sin importar mayusculas ni tildes).
 *   - Cada cambio queda en la bitacora (entidad tipoDocumento).
 */
@Injectable()
export class TiposDocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Con soloParaSubir: activos y manuales (los que se pueden elegir al subir o editar un documento). */
  async consultar(soloActivos = false, soloParaSubir = false): Promise<TipoDeDocumento[]> {
    const filas = await this.prisma.tipoDocumento.findMany({
      where: {
        ...(soloActivos || soloParaSubir ? { activo: true } : {}),
        ...(soloParaSubir ? { generadoPorSistema: false } : {}),
      },
      select: SELECCION,
      orderBy: { nombre: 'asc' },
    });
    return filas.map(aTipo);
  }

  async crear(datos: CrearTipoDocumentoDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<TipoDeDocumento> {
    const formatos = guardarFormatos(datos.formatos);
    const descripcion = datos.descripcion || null;
    const id = await this.prisma.$transaction(async (tx) => {
      await this.verificarNombreLibre(tx, datos.nombre);
      const fila = await tx.tipoDocumento.create({
        data: { nombre: datos.nombre, descripcion, formatosPermitidos: formatos, generadoPorSistema: false },
        select: { id: true },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'tipoDocumento',
          registroAfectadoId: fila.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { nombre: datos.nombre, descripcion, formatos },
          descripcion: `Creó el tipo de documento "${datos.nombre}" (formatos: ${formatos}).`,
        },
        tx,
      );
      return fila.id;
    });
    return this.consultarUno(id);
  }

  async editar(id: string, datos: EditarTipoDocumentoDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<TipoDeDocumento> {
    if (datos.nombre === undefined && datos.descripcion === undefined && datos.formatos === undefined) {
      throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Indique el nombre, la descripción o los formatos que quiere cambiar.' });
    }

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, id);
      if (actual.generadoPorSistema && (datos.descripcion !== undefined || datos.formatos !== undefined)) {
        throw new BadRequestException({
          codigo: 'TIPO_DE_SISTEMA',
          message: 'Los tipos que genera SINERGIA solo se pueden renombrar: su descripción y formatos dependen del proceso que los produce.',
        });
      }
      const nombre = datos.nombre ?? actual.nombre;
      const descripcion = datos.descripcion === undefined ? actual.descripcion : datos.descripcion || null;
      const formatos = datos.formatos === undefined ? actual.formatosPermitidos : guardarFormatos(datos.formatos);

      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};
      if (nombre !== actual.nombre) {
        antes.nombre = actual.nombre;
        despues.nombre = nombre;
      }
      if (descripcion !== actual.descripcion) {
        antes.descripcion = actual.descripcion;
        despues.descripcion = descripcion;
      }
      if (formatos !== actual.formatosPermitidos) {
        antes.formatos = actual.formatosPermitidos;
        despues.formatos = formatos;
      }
      if (Object.keys(despues).length === 0) {
        throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay nada que cambiar: los datos son los mismos.' });
      }
      if (nombre !== actual.nombre) await this.verificarNombreLibre(tx, nombre, id);

      await tx.tipoDocumento.update({ where: { id }, data: { nombre, descripcion, formatosPermitidos: formatos } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'tipoDocumento',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: antes,
          datosNuevos: despues,
          descripcion: `Modificó el tipo de documento "${actual.nombre}" (${Object.keys(despues).join(', ')}).`,
        },
        tx,
      );
    });
    return this.consultarUno(id);
  }

  async cambiarEstado(id: string, activo: boolean, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<TipoDeDocumento> {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, id);
      if (actual.generadoPorSistema && !activo) {
        throw new BadRequestException({
          codigo: 'TIPO_DE_SISTEMA',
          message: 'Los tipos que genera SINERGIA no se pueden inactivar: los procesos automáticos dependen de ellos.',
        });
      }
      if (actual.activo === activo) {
        throw new BadRequestException({ codigo: 'ESTADO_SIN_CAMBIO', message: `El tipo "${actual.nombre}" ya está ${activo ? 'activo' : 'inactivo'}.` });
      }
      await tx.tipoDocumento.update({ where: { id }, data: { activo } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'tipoDocumento',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { activo: actual.activo },
          datosNuevos: { activo, documentosVigentes: actual._count.documentos },
          descripcion:
            `${activo ? 'Activó' : 'Inactivó'} el tipo de documento "${actual.nombre}"` +
            (!activo && actual._count.documentos > 0 ? ` (${actual._count.documentos} documento(s) lo conservan).` : '.'),
        },
        tx,
      );
    });
    return this.consultarUno(id);
  }

  /* ---------------------------------------------------------------- */

  private async consultarUno(id: string): Promise<TipoDeDocumento> {
    return aTipo(await this.cargar(this.prisma, id));
  }

  private async cargar(cliente: Cliente, id: string): Promise<Fila> {
    const fila = await cliente.tipoDocumento.findUnique({ where: { id }, select: SELECCION });
    if (!fila) {
      throw new NotFoundException({ codigo: 'TIPO_DOCUMENTO_NO_ENCONTRADO', message: 'No se encontró el tipo de documento indicado.' });
    }
    return fila;
  }

  /** NOMBRE_DUPLICADO si ya existe otro con ese nombre (la comparacion ignora mayusculas y tildes). */
  private async verificarNombreLibre(cliente: Cliente, nombre: string, exceptoId?: string): Promise<void> {
    const existe = await cliente.tipoDocumento.findFirst({
      where: { nombre, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
      select: { nombre: true },
    });
    if (existe) {
      throw new ConflictException({ codigo: 'NOMBRE_DUPLICADO', message: `Ya existe un tipo de documento llamado "${existe.nombre}".` });
    }
  }
}
