import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola } from '../comun/fechas.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PERMISO_ADMINISTRAR } from '../vacaciones/vacaciones.service.js';
import type { AnularDto, ConsultarIncapacidadesDto, RegistrarIncapacidadDto } from './dto.js';

const UN_DIA = 86_400_000;
/** Una boleta no cubre mas de un anio. */
const MAXIMO_DE_DIAS = 366;

const SELECCION = {
  id: true,
  consecutivo: true,
  fechaInicio: true,
  fechaFin: true,
  cantidadDias: true,
  entidadEmisora: true,
  numeroBoleta: true,
  observacion: true,
  documentoId: true,
  fechaRegistro: true,
  vigente: true,
  motivoAnulacion: true,
  fechaAnulacion: true,
  tipoIncapacidad: { select: { id: true, nombre: true } },
  funcionario: {
    select: {
      id: true,
      nombre: true,
      primerApellido: true,
      segundoApellido: true,
      jefaturaId: true,
      departamento: { select: { nombre: true } },
      usuario: { select: { id: true } },
    },
  },
  usuarioRegistro: { select: { id: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
} satisfies Prisma.incapacidadSelect;

type Fila = Prisma.incapacidadGetPayload<{ select: typeof SELECCION }>;

export interface IncapacidadDeLista {
  id: string;
  consecutivo: string;
  funcionario: { id: string; nombre: string; departamento: string | null };
  /** null para quien no puede ver datos medicos (la jefatura): solo ve las fechas. */
  tipo: { id: string; nombre: string } | null;
  entidadEmisora: string | null;
  numeroBoleta: string | null;
  fechaInicio: string;
  fechaFin: string;
  cantidadDias: number;
  observacion: string | null;
  /** Documento de la boleta (se abre con /documentos/:id/archivo); null si no lo puede ver. */
  boletaId: string | null;
  registradaPor: { id: string; nombre: string | null };
  enNombreDeTercero: boolean;
  fechaRegistro: string;
  vigente: boolean;
  motivoAnulacion: string | null;
}

/**
 * Incapacidades (Ficha 26, Diagrama 6). NO es una solicitud: no tiene
 * aprobacion. La registra la propia persona (autoservicio, con su boleta)
 * o Recursos Humanos por ella. La boleta es OBLIGATORIA y queda en el
 * expediente. No afecta el saldo de vacaciones (confirmado). La jefatura
 * la ve en el calendario de su equipo como "Incapacidad", sin el tipo ni
 * la boleta (datos medicos). Errores se corrigen anulando con motivo.
 */
@Injectable()
export class IncapacidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly documentos: DocumentosService,
  ) {}

  async tipos(): Promise<{ id: string; nombre: string; descripcion: string | null }[]> {
    return this.prisma.tipoIncapacidad.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, descripcion: true } });
  }

  async registrar(
    datos: RegistrarIncapacidadDto,
    boleta: ArchivoSubido | undefined,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<{ incapacidad: IncapacidadDeLista; avisos: string[] }> {
    const funcionarioId = datos.funcionarioId ?? quienActua.funcionarioId;
    if (!funcionarioId) {
      throw new BadRequestException({ codigo: 'SIN_FUNCIONARIO', message: 'Su cuenta no está asociada a un funcionario: elija a la persona.' });
    }
    const enNombreDeOtro = funcionarioId !== quienActua.funcionarioId;
    if (enNombreDeOtro && !quienActua.permisos.includes(PERMISO_ADMINISTRAR)) {
      throw new ForbiddenException({ codigo: 'INCAPACIDAD_AJENA', message: 'Solo Recursos Humanos registra incapacidades a nombre de otra persona.' });
    }
    const persona = await this.prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { estado: true } });
    if (!persona) throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    if (persona.estado !== 'activo') {
      throw new BadRequestException({ codigo: 'FUNCIONARIO_INACTIVO', message: 'La persona no está activa: no se le registran incapacidades.' });
    }
    const tipo = await this.prisma.tipoIncapacidad.findUnique({ where: { id: datos.tipoIncapacidadId }, select: { activo: true, nombre: true } });
    if (!tipo || !tipo.activo) {
      throw new BadRequestException({ codigo: 'TIPO_INCAPACIDAD_INVALIDO', message: 'El tipo de incapacidad no existe o está inactivo.' });
    }

    const inicio = interpretarFechaSola(datos.fechaInicio, 'de inicio');
    const fin = interpretarFechaSola(datos.fechaFin, 'de fin');
    if (fin < inicio) throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    const dias = Math.round((fin.getTime() - inicio.getTime()) / UN_DIA) + 1;
    if (dias > MAXIMO_DE_DIAS) throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'Una incapacidad no puede abarcar más de un año.' });

    const choque = await this.prisma.incapacidad.findFirst({
      where: { funcionarioId, vigente: true, fechaInicio: { lte: fin }, fechaFin: { gte: inicio } },
      select: { consecutivo: true, fechaInicio: true, fechaFin: true },
    });
    if (choque) {
      throw new ConflictException({
        codigo: 'INCAPACIDAD_TRASLAPADA',
        message: `Ya hay una incapacidad registrada (${choque.consecutivo}, del ${aFechaSola(choque.fechaInicio)} al ${aFechaSola(choque.fechaFin)}) que coincide con esas fechas.`,
      });
    }

    // No se bloquea, pero se avisa: si coincide con vacaciones o permisos, RRHH revisa (p. ej. devolver los dias).
    const coinciden = await this.prisma.solicitud.findMany({
      where: { funcionarioId, estado: { in: ['pendiente', 'aprobada'] }, fechaInicio: { lte: fin }, fechaFin: { gte: inicio } },
      select: { consecutivo: true, estado: true, tipoSolicitud: { select: { nombre: true } } },
    });
    const avisos = coinciden.map(
      (c) => `Coincide con ${c.tipoSolicitud.nombre.toLowerCase()} ${c.consecutivo} (${c.estado}). Recursos Humanos debe revisar si corresponde devolver días o ajustar.`,
    );

    // La boleta va primero al expediente; si luego algo falla, queda dada de baja.
    const adjunto = await this.documentos.registrarAdjunto({
      funcionarioId,
      nombreDelTipo: 'Boleta de incapacidad',
      titulo: `Boleta de incapacidad del ${aFechaSola(inicio)} al ${aFechaSola(fin)}`,
      archivo: boleta,
      quienActua,
      direccionIp,
      fechaDocumento: inicio <= hoyEnCostaRica() ? inicio : hoyEnCostaRica(),
    });

    try {
      for (let intento = 1; ; intento++) {
        try {
          const id = await this.prisma.$transaction(async (tx) => {
            const fila = await tx.incapacidad.create({
              data: {
                consecutivo: await this.siguienteConsecutivo(tx),
                funcionarioId,
                usuarioRegistroId: quienActua.id,
                tipoIncapacidadId: datos.tipoIncapacidadId,
                entidadEmisora: datos.entidadEmisora ?? null,
                numeroBoleta: datos.numeroBoleta ?? null,
                fechaInicio: inicio,
                fechaFin: fin,
                cantidadDias: dias,
                observacion: datos.observacion ?? null,
                documentoId: adjunto.id,
              },
              select: { id: true, consecutivo: true },
            });
            await this.bitacora.registrar(
              {
                usuarioId: quienActua.id,
                funcionarioAfectadoId: funcionarioId,
                entidad: 'incapacidad',
                registroAfectadoId: fila.id,
                accion: 'crear',
                direccionIp,
                datosNuevos: { consecutivo: fila.consecutivo, tipo: tipo.nombre, fechaInicio: aFechaSola(inicio), fechaFin: aFechaSola(fin), dias },
                descripcion: `Registró la incapacidad ${fila.consecutivo} (${tipo.nombre}) del ${aFechaSola(inicio)} al ${aFechaSola(fin)}${enNombreDeOtro ? ' en nombre de otra persona' : ''}.`,
              },
              tx,
            );
            return fila.id;
          });
          return { incapacidad: await this.detalleSinPermisos(id, true), avisos };
        } catch (error) {
          if ((error as { code?: string }).code === 'P2002' && intento < 5) continue;
          throw error;
        }
      }
    } catch (error) {
      await this.documentos.descartarAdjunto(adjunto.id, quienActua);
      throw error;
    }
  }

  async mias(filtros: ConsultarIncapacidadesDto, quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<IncapacidadDeLista>> {
    if (!quienActua.funcionarioId) return armarPagina([], 0, filtros.pagina, filtros.tamano);
    return this.listar({ funcionarioId: quienActua.funcionarioId, ...this.filtrosComunes(filtros) }, filtros, true);
  }

  /** Todas, para Recursos Humanos. */
  async todas(filtros: ConsultarIncapacidadesDto): Promise<PaginaDeResultados<IncapacidadDeLista>> {
    const donde: Prisma.incapacidadWhereInput = this.filtrosComunes(filtros);
    if (filtros.departamentoId) donde.funcionario = { departamentoId: filtros.departamentoId };
    if (filtros.busqueda) {
      const palabras = filtros.busqueda.split(/\s+/).filter(Boolean).slice(0, 5);
      donde.AND = palabras.map((p) => ({
        OR: [
          { consecutivo: { contains: p } },
          { numeroBoleta: { contains: p } },
          { funcionario: { cedula: { contains: p } } },
          { funcionario: { nombre: { contains: p } } },
          { funcionario: { primerApellido: { contains: p } } },
          { funcionario: { segundoApellido: { contains: p } } },
        ],
      }));
    }
    return this.listar(donde, filtros, true);
  }

  /** Una incapacidad: la persona y RRHH la ven completa; su jefatura, solo fechas (sin datos medicos). */
  async detalle(id: string, quienActua: UsuarioAutenticado): Promise<IncapacidadDeLista> {
    const fila = await this.prisma.incapacidad.findUnique({ where: { id }, select: SELECCION });
    if (!fila) throw this.noEncontrada();
    const completa = fila.funcionario.id === quienActua.funcionarioId || quienActua.permisos.includes(PERMISO_ADMINISTRAR);
    const esSuJefatura = quienActua.funcionarioId !== null && fila.funcionario.jefaturaId === quienActua.funcionarioId;
    if (!completa && !esSuJefatura) throw new ForbiddenException({ codigo: 'INCAPACIDAD_AJENA', message: 'No tiene acceso a esa incapacidad.' });
    return this.aLista(fila, completa);
  }

  async anular(id: string, datos: AnularDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<IncapacidadDeLista> {
    const fila = await this.prisma.incapacidad.findUnique({ where: { id }, select: { consecutivo: true, funcionarioId: true, vigente: true } });
    if (!fila) throw this.noEncontrada();
    if (!fila.vigente) throw new ConflictException({ codigo: 'INCAPACIDAD_YA_ANULADA', message: 'Esa incapacidad ya está anulada.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.incapacidad.update({
        where: { id },
        data: { vigente: false, motivoAnulacion: datos.motivo, usuarioAnulacionId: quienActua.id, fechaAnulacion: new Date() },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: fila.funcionarioId,
          entidad: 'incapacidad',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosNuevos: { vigente: false, motivo: datos.motivo },
          descripcion: `Anuló la incapacidad ${fila.consecutivo}: ${datos.motivo}`,
        },
        tx,
      );
    });
    return this.detalleSinPermisos(id, true);
  }

  /* ---------------------------------------------------------------- */

  private filtrosComunes(filtros: ConsultarIncapacidadesDto): Prisma.incapacidadWhereInput {
    const donde: Prisma.incapacidadWhereInput = {};
    const estado = filtros.estado ?? 'vigentes';
    if (estado !== 'todas') donde.vigente = estado === 'vigentes';
    if (filtros.tipoIncapacidadId) donde.tipoIncapacidadId = filtros.tipoIncapacidadId;
    if (filtros.desde) donde.fechaFin = { gte: interpretarFechaSola(filtros.desde, '"desde"') };
    if (filtros.hasta) donde.fechaInicio = { lte: interpretarFechaSola(filtros.hasta, '"hasta"') };
    return donde;
  }

  private async listar(donde: Prisma.incapacidadWhereInput, p: { pagina: number; tamano: number }, completa: boolean): Promise<PaginaDeResultados<IncapacidadDeLista>> {
    const [total, filas] = await Promise.all([
      this.prisma.incapacidad.count({ where: donde }),
      this.prisma.incapacidad.findMany({
        where: donde,
        orderBy: [{ fechaInicio: 'desc' }, { consecutivo: 'desc' }],
        skip: (p.pagina - 1) * p.tamano,
        take: p.tamano,
        select: SELECCION,
      }),
    ]);
    return armarPagina(filas.map((f) => this.aLista(f, completa)), total, p.pagina, p.tamano);
  }

  private async detalleSinPermisos(id: string, completa: boolean): Promise<IncapacidadDeLista> {
    const fila = await this.prisma.incapacidad.findUnique({ where: { id }, select: SELECCION });
    if (!fila) throw this.noEncontrada();
    return this.aLista(fila, completa);
  }

  private aLista(f: Fila, completa: boolean): IncapacidadDeLista {
    return {
      id: f.id,
      consecutivo: f.consecutivo,
      funcionario: {
        id: f.funcionario.id,
        nombre: [f.funcionario.nombre, f.funcionario.primerApellido, f.funcionario.segundoApellido].filter(Boolean).join(' '),
        departamento: f.funcionario.departamento?.nombre ?? null,
      },
      tipo: completa ? f.tipoIncapacidad : null,
      entidadEmisora: completa ? f.entidadEmisora : null,
      numeroBoleta: completa ? f.numeroBoleta : null,
      fechaInicio: aFechaSola(f.fechaInicio)!,
      fechaFin: aFechaSola(f.fechaFin)!,
      cantidadDias: Number(f.cantidadDias),
      observacion: completa ? f.observacion : null,
      boletaId: completa ? f.documentoId : null,
      registradaPor: {
        id: f.usuarioRegistro.id,
        nombre: f.usuarioRegistro.funcionario ? `${f.usuarioRegistro.funcionario.nombre} ${f.usuarioRegistro.funcionario.primerApellido}` : null,
      },
      enNombreDeTercero: f.usuarioRegistro.id !== f.funcionario.usuario?.id,
      fechaRegistro: f.fechaRegistro.toISOString(),
      vigente: f.vigente,
      motivoAnulacion: completa ? f.motivoAnulacion : null,
    };
  }

  private async siguienteConsecutivo(tx: Prisma.TransactionClient): Promise<string> {
    const prefijo = `INC-${hoyEnCostaRica().getUTCFullYear()}-`;
    const ultimo = await tx.incapacidad.findFirst({ where: { consecutivo: { startsWith: prefijo } }, orderBy: { consecutivo: 'desc' }, select: { consecutivo: true } });
    const numero = ultimo ? Number(ultimo.consecutivo.slice(prefijo.length)) + 1 : 1;
    return `${prefijo}${String(numero).padStart(4, '0')}`;
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException({ codigo: 'INCAPACIDAD_NO_ENCONTRADA', message: 'No se encontró la incapacidad indicada.' });
  }
}
