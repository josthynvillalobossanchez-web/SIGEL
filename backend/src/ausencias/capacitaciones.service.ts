import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { aFechaSola, interpretarFechaSola } from '../comun/fechas.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SolicitudesService } from '../vacaciones/solicitudes.service.js';
import { PERMISO_ADMINISTRAR } from '../vacaciones/vacaciones.service.js';
import type { RegistrarCapacitacionDto } from './dto.js';

/** El expediente ajeno lo ve RRHH (misma regla que el expediente). */
const PERMISO_EXPEDIENTES_AJENOS = 'expediente.verTodos';

const SELECCION = {
  id: true,
  funcionarioId: true,
  nombre: true,
  institucion: true,
  modalidad: true,
  fechaInicio: true,
  fechaFin: true,
  cantidadHoras: true,
  afectaJornada: true,
  documentoId: true,
  observacion: true,
  fechaRegistro: true,
  usuarioRegistroId: true,
  solicitud: { select: { id: true, consecutivo: true, estado: true } },
  usuarioRegistro: { select: { funcionario: { select: { nombre: true, primerApellido: true } } } },
} satisfies Prisma.capacitacionSelect;

type Fila = Prisma.capacitacionGetPayload<{ select: typeof SELECCION }>;

export interface CapacitacionDeLista {
  id: string;
  nombre: string;
  institucion: string | null;
  modalidad: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  cantidadHoras: number | null;
  afectaJornada: boolean;
  /** La solicitud que aprueba la jefatura, cuando choca con el horario. */
  solicitud: { id: string; consecutivo: string; estado: string } | null;
  certificadoId: string | null;
  observacion: string | null;
  registradaPor: string | null;
  fechaRegistro: string;
  /** Quien consulta puede adjuntar el certificado o darla de baja. */
  puedeModificar: boolean;
}

/**
 * Capacitaciones (Ficha 27, Diagrama 5, HU 34): registro documental en el
 * expediente, con su certificado opcional. Las registra la propia persona
 * (autoservicio) o RRHH. Si choca con el horario, ademas se crea la
 * solicitud "Capacitacion que choca con el horario" para que la apruebe la
 * jefatura (se reutiliza todo el flujo de solicitudes). No es una
 * plataforma de cursos.
 */
@Injectable()
export class CapacitacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly documentos: DocumentosService,
    private readonly solicitudes: SolicitudesService,
  ) {}

  async listar(funcionarioId: string, quienActua: UsuarioAutenticado): Promise<CapacitacionDeLista[]> {
    this.revisarLectura(funcionarioId, quienActua);
    const filas = await this.prisma.capacitacion.findMany({
      where: { funcionarioId, vigente: true },
      orderBy: [{ fechaInicio: 'desc' }, { fechaRegistro: 'desc' }],
      select: SELECCION,
    });
    return filas.map((f) => this.aLista(f, quienActua));
  }

  async registrar(
    datos: RegistrarCapacitacionDto,
    certificado: ArchivoSubido | undefined,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<CapacitacionDeLista> {
    const funcionarioId = datos.funcionarioId ?? quienActua.funcionarioId;
    if (!funcionarioId) throw new BadRequestException({ codigo: 'SIN_FUNCIONARIO', message: 'Su cuenta no está asociada a un funcionario: elija a la persona.' });
    const deOtro = funcionarioId !== quienActua.funcionarioId;
    if (deOtro && !quienActua.permisos.includes(PERMISO_ADMINISTRAR)) {
      throw new ForbiddenException({ codigo: 'CAPACITACION_AJENA', message: 'Solo Recursos Humanos registra capacitaciones de otra persona.' });
    }
    const persona = await this.prisma.funcionario.findUnique({ where: { id: funcionarioId }, select: { estado: true } });
    if (!persona) throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });

    const inicio = datos.fechaInicio ? interpretarFechaSola(datos.fechaInicio, 'de inicio') : null;
    const fin = datos.fechaFin ? interpretarFechaSola(datos.fechaFin, 'de fin') : inicio;
    if (inicio && fin && fin < inicio) throw new BadRequestException({ codigo: 'RANGO_NO_VALIDO', message: 'La fecha de fin no puede ser anterior a la de inicio.' });
    const afecta = datos.afectaJornada === true;
    if (afecta && !inicio) {
      throw new BadRequestException({ codigo: 'FECHAS_REQUERIDAS', message: 'Si choca con el horario, indique las fechas: la jefatura las tiene que aprobar.' });
    }

    // Si choca con el horario, primero se revisa que la solicitud se pueda hacer (saldo no aplica, pero si traslapes y dias habiles).
    let tipoSolicitudId: string | null = null;
    if (afecta) {
      const tipo = await this.prisma.tipoSolicitud.findUnique({ where: { clave: 'capacitacion' }, select: { id: true, activo: true } });
      if (!tipo?.activo) throw new BadRequestException({ codigo: 'TIPO_SOLICITUD_INVALIDO', message: 'El trámite de capacitaciones no está disponible.' });
      tipoSolicitudId = tipo.id;
      const previa = (await this.solicitudes.calcular(
        { tipoSolicitudId, fechaInicio: aFechaSola(inicio)!, fechaFin: aFechaSola(fin)!, funcionarioId: deOtro ? funcionarioId : undefined },
        quienActua,
      )) as { valida: boolean; problema: { codigo?: string; mensaje?: string } | null };
      if (!previa.valida) throw new BadRequestException({ codigo: previa.problema?.codigo ?? 'SOLICITUD_NO_VALIDA', message: previa.problema?.mensaje ?? 'No se puede pedir esa capacitación con esas fechas.' });
    }

    const adjunto = certificado
      ? await this.documentos.registrarAdjunto({
          funcionarioId,
          nombreDelTipo: 'Certificado de capacitación',
          titulo: `Certificado: ${datos.nombre}`,
          archivo: certificado,
          quienActua,
          direccionIp,
        })
      : null;

    try {
      const solicitud =
        afecta && tipoSolicitudId
          ? await this.solicitudes.crear(
              {
                tipoSolicitudId,
                fechaInicio: aFechaSola(inicio)!,
                fechaFin: aFechaSola(fin)!,
                motivo: `Capacitación: ${datos.nombre}${datos.institucion ? ` (${datos.institucion})` : ''}`.slice(0, 500),
                funcionarioId: deOtro ? funcionarioId : undefined,
              },
              quienActua,
              direccionIp,
            )
          : null;

      const creada = await this.prisma.$transaction(async (tx) => {
        const fila = await tx.capacitacion.create({
          data: {
            funcionarioId,
            nombre: datos.nombre,
            institucion: datos.institucion ?? null,
            modalidad: datos.modalidad ?? null,
            fechaInicio: inicio,
            fechaFin: fin,
            cantidadHoras: datos.cantidadHoras ?? null,
            afectaJornada: afecta,
            solicitudId: solicitud?.id ?? null,
            documentoId: adjunto?.id ?? null,
            usuarioRegistroId: quienActua.id,
            observacion: datos.observacion ?? null,
          },
          select: { id: true },
        });
        await this.bitacora.registrar(
          {
            usuarioId: quienActua.id,
            funcionarioAfectadoId: funcionarioId,
            entidad: 'capacitacion',
            registroAfectadoId: fila.id,
            accion: 'crear',
            direccionIp,
            datosNuevos: { nombre: datos.nombre, afectaJornada: afecta, solicitud: solicitud?.consecutivo ?? null },
            descripcion: `Registró la capacitación «${datos.nombre}»${afecta && solicitud ? ` (choca con el horario: solicitud ${solicitud.consecutivo})` : ''}.`,
          },
          tx,
        );
        return fila;
      });
      return this.uno(creada.id, quienActua);
    } catch (error) {
      if (adjunto) await this.documentos.descartarAdjunto(adjunto.id, quienActua);
      throw error;
    }
  }

  /** Agrega (o cambia) el certificado despues de registrada. */
  async adjuntarCertificado(id: string, certificado: ArchivoSubido | undefined, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<CapacitacionDeLista> {
    const actual = await this.cargarParaModificar(id, quienActua);
    const adjunto = await this.documentos.registrarAdjunto({
      funcionarioId: actual.funcionarioId,
      nombreDelTipo: 'Certificado de capacitación',
      titulo: `Certificado: ${actual.nombre}`,
      archivo: certificado,
      quienActua,
      direccionIp,
    });
    await this.prisma.capacitacion.update({ where: { id }, data: { documentoId: adjunto.id } });
    return this.uno(id, quienActua);
  }

  /** Baja logica (no se borra). La persona, lo que ella registro; RRHH, cualquiera. */
  async darDeBaja(id: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<{ mensaje: string }> {
    const actual = await this.cargarParaModificar(id, quienActua);
    await this.prisma.$transaction(async (tx) => {
      await tx.capacitacion.update({ where: { id }, data: { vigente: false } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          funcionarioAfectadoId: actual.funcionarioId,
          entidad: 'capacitacion',
          registroAfectadoId: id,
          accion: 'eliminar',
          direccionIp,
          descripcion: `Dio de baja la capacitación «${actual.nombre}».`,
        },
        tx,
      );
    });
    return { mensaje: 'Capacitación dada de baja.' };
  }

  /* ---------------------------------------------------------------- */

  private revisarLectura(funcionarioId: string, quienActua: UsuarioAutenticado): void {
    if (funcionarioId !== quienActua.funcionarioId && !quienActua.permisos.includes(PERMISO_EXPEDIENTES_AJENOS)) {
      throw new ForbiddenException({ codigo: 'EXPEDIENTE_AJENO', message: 'Solo Recursos Humanos ve las capacitaciones de otra persona.' });
    }
  }

  private async cargarParaModificar(id: string, quienActua: UsuarioAutenticado) {
    const fila = await this.prisma.capacitacion.findUnique({ where: { id }, select: { funcionarioId: true, nombre: true, vigente: true, usuarioRegistroId: true } });
    if (!fila || !fila.vigente) throw new NotFoundException({ codigo: 'CAPACITACION_NO_ENCONTRADA', message: 'No se encontró la capacitación indicada.' });
    if (!this.puedeModificar(fila, quienActua)) {
      throw new ForbiddenException({ codigo: 'CAPACITACION_AJENA', message: 'Solo quien la registró (o Recursos Humanos) puede modificarla.' });
    }
    if (!fila.vigente) throw new ConflictException({ codigo: 'CAPACITACION_DADA_DE_BAJA', message: 'Esa capacitación ya está dada de baja.' });
    return fila;
  }

  private puedeModificar(f: { funcionarioId: string; usuarioRegistroId: string | null }, quienActua: UsuarioAutenticado): boolean {
    return quienActua.permisos.includes(PERMISO_ADMINISTRAR) || (f.funcionarioId === quienActua.funcionarioId && f.usuarioRegistroId === quienActua.id);
  }

  private async uno(id: string, quienActua: UsuarioAutenticado): Promise<CapacitacionDeLista> {
    const fila = await this.prisma.capacitacion.findUniqueOrThrow({ where: { id }, select: SELECCION });
    return this.aLista(fila, quienActua);
  }

  private aLista(f: Fila, quienActua: UsuarioAutenticado): CapacitacionDeLista {
    return {
      id: f.id,
      nombre: f.nombre,
      institucion: f.institucion,
      modalidad: f.modalidad,
      fechaInicio: aFechaSola(f.fechaInicio) ?? null,
      fechaFin: aFechaSola(f.fechaFin) ?? null,
      cantidadHoras: f.cantidadHoras === null ? null : Number(f.cantidadHoras),
      afectaJornada: f.afectaJornada,
      solicitud: f.solicitud,
      certificadoId: f.documentoId,
      observacion: f.observacion,
      registradaPor: f.usuarioRegistro?.funcionario ? `${f.usuarioRegistro.funcionario.nombre} ${f.usuarioRegistro.funcionario.primerApellido}` : null,
      fechaRegistro: f.fechaRegistro.toISOString(),
      puedeModificar: this.puedeModificar(f, quienActua),
    };
  }
}
