import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ValidationPipe,
  type OnModuleInit,
} from '@nestjs/common';
import { AlmacenCifradoService } from '../almacenamiento/almacen-cifrado.service.js';
import { FORMATOS, validarArchivo, type ArchivoSubido } from '../almacenamiento/validacion-de-archivos.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola } from '../comun/fechas.js';
import { DocumentosService, type ArchivoAbierto } from '../documentos/documentos.service.js';
import { normalizarCedula } from '../funcionarios/cedula.js';
import type { RegistrarFuncionarioDto } from '../funcionarios/dto/datos-de-funcionario.dto.js';
import { FuncionariosService } from '../funcionarios/funcionarios.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NIVELES_EDUCATIVOS,
  RegistroDeCandidatoDto,
  type CambiarCandidatoDto,
  type ConsultarCandidatosDto,
  type EditarHabilidadDto,
  type EliminarCandidatoDto,
  type EstadoDeCandidato,
  type HabilidadDto,
  type NivelEducativo,
} from './dto.js';

/** Curriculum: solo PDF y hasta 10 MB (el formulario es publico). */
const TAMANO_MAXIMO_CURRICULUM = 10 * 1024 * 1024;

/** Orden de los niveles para el filtro "al menos este nivel" (los cursos van aparte). */
const ORDEN_DE_NIVEL: Record<NivelEducativo, number> = { primaria: 1, secundaria: 2, tecnico: 3, universitaria: 4, posgrado: 5, curso: 0 };

export const NOMBRES_DE_NIVEL: Record<NivelEducativo, string> = {
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  tecnico: 'Técnico',
  universitaria: 'Universitaria',
  posgrado: 'Posgrado',
  curso: 'Curso o capacitación',
};
const NOMBRES_DE_ESTADO: Record<EstadoDeCandidato, string> = { activo: 'Activo', inactivo: 'Inactivo', contratado: 'Contratado', descartado: 'Descartado' };

const RUTA_CONSENTIMIENTO = () => join(process.env.RUTA_CONTENIDO ?? join(process.cwd(), 'contenido'), 'consentimiento-talent-pool.txt');

const nombreCompleto = (p: { nombre: string; primerApellido: string; segundoApellido: string | null }) =>
  [p.nombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' ');

/** Meses entre "AAAA-MM" y "AAAA-MM" (ambos incluidos). */
function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split('-').map(Number);
  const [a2, m2] = hasta.split('-').map(Number);
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1) + 1);
}

export interface CandidatoDeLista {
  id: string;
  cedula: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  profesion: string | null;
  /** true = la escribio el candidato (no estaba en el catalogo). */
  profesionDigitada: boolean;
  nivelMaximo: NivelEducativo | null;
  aniosExperiencia: number;
  habilidades: string[];
  estado: EstadoDeCandidato;
  tieneCurriculum: boolean;
  fechaRegistro: string;
  fechaActualizacion: string;
  funcionarioId: string | null;
}

const SELECCION_DE_LISTA = {
  id: true,
  cedula: true,
  nombre: true,
  primerApellido: true,
  segundoApellido: true,
  correo: true,
  telefono: true,
  profesionTexto: true,
  mesesExperiencia: true,
  estado: true,
  cvRutaArchivo: true,
  fechaRegistro: true,
  fechaActualizacion: true,
  funcionarioId: true,
  profesion: { select: { nombre: true } },
  formacion: { select: { nivel: true } },
  habilidades: { select: { habilidad: { select: { nombre: true } } }, take: 6 },
  habilidadesPropias: { select: { nombre: true }, take: 4 },
} satisfies Prisma.candidatoSelect;

type FilaDeLista = Prisma.candidatoGetPayload<{ select: typeof SELECCION_DE_LISTA }>;

/**
 * Talent Pool (Sprint 3, HU 38-41; Fichas 32-35 y 41).
 *
 * Publico (sin cuenta):
 *   - El formulario se identifica SOLO con la cedula. Regla de privacidad
 *     (Josthyn, 13/10): NUNCA se devuelven datos guardados. Si la cedula ya
 *     existe, el registro se REEMPLAZA completo con lo que se envie (riesgo
 *     aceptado de que alguien reemplace el de otra persona: es preferible a
 *     revelar informacion privada a quien solo sabe una cedula). La respuesta
 *     es la misma exista o no la cedula, para no confirmar quien esta.
 *   - Consentimiento informado obligatorio, versionado (el texto sale del
 *     archivo contenido/consentimiento-talent-pool.txt).
 *   - Curriculum opcional, en PDF, cifrado como el expediente.
 *   - Limite de envios por IP (controlador) y campo trampa para robots.
 *
 * Recursos Humanos (talentPool.ver / talentPool.administrar):
 *   - Lista con busqueda y filtros, perfil, curriculum, estados, nota
 *     interna, catalogo de habilidades y eliminar a solicitud de la persona.
 *   - Contratar (Ficha 41): crea el funcionario con los datos personales del
 *     candidato (RRHH completa los laborales y decide si tiene cuenta) y
 *     copia el curriculum al expediente. El candidato queda "contratado" y
 *     ligado al funcionario: no se puede contratar dos veces.
 */
@Injectable()
export class TalentPoolService implements OnModuleInit {
  private readonly registro = new Logger('TalentPool');
  private readonly validador = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacen: AlmacenCifradoService,
    private readonly bitacora: BitacoraService,
    private readonly notificaciones: NotificacionesService,
    private readonly funcionarios: FuncionariosService,
    private readonly documentos: DocumentosService,
  ) {}

  /* ================================================================== */
  /* Consentimiento (versionado)                                         */
  /* ================================================================== */

  async onModuleInit(): Promise<void> {
    try {
      await this.sincronizarConsentimiento();
    } catch (error) {
      this.registro.warn(`No se pudo revisar el consentimiento del Talent Pool: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Si el texto del archivo cambio (o no hay ninguna version), guarda una
   * version nueva y deja la anterior inactiva. Cada candidato queda ligado a
   * la version exacta que acepto.
   */
  async sincronizarConsentimiento(): Promise<{ id: string; version: string }> {
    const texto = (await readFile(RUTA_CONSENTIMIENTO(), 'utf8')).replace(/\r\n/g, '\n').trim();
    if (!texto) throw new Error('El archivo del consentimiento está vacío.');
    const huella = createHash('sha256').update(texto).digest('hex');
    const existente = await this.prisma.consentimiento.findUnique({ where: { huella }, select: { id: true, version: true, activo: true } });
    if (existente?.activo) return existente;

    return this.prisma.$transaction(async (tx) => {
      await tx.consentimiento.updateMany({ where: { activo: true }, data: { activo: false } });
      if (existente) {
        // Volvio un texto que ya existio: se reactiva esa version.
        await tx.consentimiento.update({ where: { id: existente.id }, data: { activo: true, vigenteDesde: new Date() } });
        return existente;
      }
      const cuantas = await tx.consentimiento.count();
      const titulo = texto.split('\n').map((l) => l.trim()).find((l) => l && !/^borrador/i.test(l)) ?? 'Consentimiento informado';
      const nueva = await tx.consentimiento.create({
        data: { version: `v${cuantas + 1} (${aFechaSola(hoyEnCostaRica())})`.slice(0, 20), titulo: titulo.slice(0, 180), texto, huella },
        select: { id: true, version: true },
      });
      this.registro.log(`Consentimiento del Talent Pool: nueva versión ${nueva.version}.`);
      return nueva;
    });
  }

  /* ================================================================== */
  /* Publico                                                             */
  /* ================================================================== */

  /** Lo que el formulario publico necesita. No incluye NINGUN dato de personas. */
  async formulario() {
    await this.sincronizarConsentimiento();
    const [consentimiento, profesiones, habilidades] = await Promise.all([
      this.prisma.consentimiento.findFirst({ where: { activo: true }, select: { id: true, version: true, titulo: true, texto: true } }),
      this.prisma.profesion.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
      this.prisma.habilidad.findMany({ where: { activo: true }, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true, categoria: true } }),
    ]);
    return { consentimiento, profesiones, habilidades, niveles: NIVELES_EDUCATIVOS.map((n) => ({ valor: n, texto: NOMBRES_DE_NIVEL[n] })) };
  }

  /**
   * POST publico. "datosEnTexto" es el JSON del formulario; el curriculum
   * viene aparte. La respuesta es siempre la misma (no dice si la cedula ya
   * estaba).
   */
  async registrarPublico(datosEnTexto: string, archivo: ArchivoSubido | undefined, direccionIp?: string): Promise<{ mensaje: string }> {
    let crudo: unknown;
    try {
      crudo = JSON.parse(datosEnTexto);
    } catch {
      throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Los datos del formulario no son válidos. Vuelva a cargar la página.' });
    }
    const datos = (await this.validador.transform(crudo, { type: 'body', metatype: RegistroDeCandidatoDto })) as RegistroDeCandidatoDto;
    const respuesta = {
      mensaje: 'Recibimos su información. Si ya tenía un registro con esta cédula, fue reemplazado por el que acaba de enviar.',
    };

    // Campo trampa: los robots llenan todo. Se responde igual, sin guardar nada.
    if (datos.sitioWeb) {
      this.registro.warn(`Envío del Talent Pool descartado por el campo trampa (IP ${direccionIp ?? 'desconocida'}).`);
      return respuesta;
    }

    const cedula = normalizarCedula(datos.cedula);
    if (cedula.length < 5 || cedula.length > 20) throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'La cédula debe tener entre 5 y 20 caracteres.' });
    const nacimiento = datos.fechaNacimiento ? interpretarFechaSola(datos.fechaNacimiento, 'de nacimiento') : null;
    if (nacimiento) {
      const edad = (Date.now() - nacimiento.getTime()) / (365.25 * 86_400_000);
      if (edad < 15 || edad > 100) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: 'Revise la fecha de nacimiento.' });
    }
    const consentimiento = await this.prisma.consentimiento.findFirst({ where: { id: datos.consentimientoId, activo: true }, select: { id: true } });
    if (!consentimiento) {
      throw new BadRequestException({ codigo: 'CONSENTIMIENTO_DESACTUALIZADO', message: 'El consentimiento cambió mientras llenaba el formulario. Vuelva a cargar la página y léalo de nuevo.' });
    }
    if (datos.profesionId) {
      const p = await this.prisma.profesion.findFirst({ where: { id: datos.profesionId, activo: true }, select: { id: true } });
      if (!p) throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'La profesión elegida ya no está disponible. Elija otra.' });
    }
    const idsHabilidades = [...new Set(datos.habilidades.map((h) => h.habilidadId))];
    if (idsHabilidades.length !== datos.habilidades.length) throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Hay una habilidad repetida.' });
    if (idsHabilidades.length) {
      const validas = await this.prisma.habilidad.count({ where: { id: { in: idsHabilidades }, activo: true } });
      if (validas !== idsHabilidades.length) throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Una de las habilidades ya no está disponible. Vuelva a cargar la página.' });
    }

    // Experiencia: fechas coherentes y meses totales (para el filtro de RRHH).
    const mesActual = aFechaSola(hoyEnCostaRica())!.slice(0, 7);
    let meses = 0;
    for (const e of datos.experiencia) {
      if (e.esActual) e.hasta = null;
      if (e.desde > mesActual) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: `La experiencia en «${e.empresa}» empieza en el futuro.` });
      if (e.hasta && e.hasta > mesActual) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: `La experiencia en «${e.empresa}» termina en el futuro: si sigue ahí, marque que es su trabajo actual.` });
      if (e.hasta && e.hasta < e.desde) throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: `En la experiencia en «${e.empresa}», el fin es antes del inicio.` });
      meses += mesesEntre(e.desde, e.esActual ? mesActual : (e.hasta ?? e.desde));
    }

    // 17/10: el curriculum es obligatorio.
    if (!archivo) throw new BadRequestException({ codigo: 'ARCHIVO_REQUERIDO', message: 'Adjunte su currículum en PDF.' });
    const cv = validarArchivo(archivo, ['pdf'], TAMANO_MAXIMO_CURRICULUM, 'el currículum');
    // Las propias no pueden repetir una del catalogo ni entre ellas (sin importar mayusculas).
    const normal = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const propias = datos.habilidadesPropias;
    if (new Set(propias.map((h) => normal(h.nombre))).size !== propias.length) {
      throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Hay una habilidad agregada repetida.' });
    }
    if (propias.length) {
      const delCatalogo = await this.prisma.habilidad.findMany({ where: { activo: true }, select: { nombre: true } });
      const repetida = propias.find((h) => delCatalogo.some((c) => normal(c.nombre) === normal(h.nombre)));
      if (repetida) throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: `«${repetida.nombre}» ya está en la lista: elíjala ahí en vez de agregarla.` });
    }

    const previo = await this.prisma.candidato.findUnique({ where: { cedula }, select: { id: true, estado: true, cvRutaArchivo: true } });
    const id = previo?.id ?? randomUUID();
    const rutaNueva = await this.almacen.guardar('candidatos', id, archivo.buffer);

    const campos = {
      nombre: datos.nombre,
      primerApellido: datos.primerApellido,
      segundoApellido: datos.segundoApellido ?? null,
      correo: datos.correo,
      telefono: datos.telefono ?? null,
      fechaNacimiento: nacimiento,
      residencia: datos.residencia ?? null,
      profesionId: datos.profesionId ?? null,
      profesionTexto: datos.profesionId ? null : (datos.profesionTexto ?? null),
      descripcion: datos.descripcion ?? null,
      mesesExperiencia: Math.min(meses, 32_000),
      cvNombreArchivo: cv.nombreOriginal.slice(0, 255),
      cvRutaArchivo: rutaNueva,
      cvTamanoBytes: archivo.buffer.length,
      consentimientoId: consentimiento.id,
      fechaConsentimiento: new Date(),
      ipConsentimiento: direccionIp?.slice(0, 45) ?? null,
      fechaActualizacion: new Date(),
    };
    const hijos = {
      formacion: {
        create: datos.formacion.map((f) => ({
          nivel: f.nivel,
          titulo: f.titulo ?? null,
          institucion: f.institucion ?? null,
          areaEstudio: f.areaEstudio ?? null,
          anioFinalizacion: f.anioFinalizacion ?? null,
          concluido: f.concluido ?? true,
        })),
      },
      experiencia: {
        create: datos.experiencia.map((e) => ({
          empresa: e.empresa,
          puesto: e.puesto,
          fechaInicio: e.desde ? new Date(`${e.desde}-01T00:00:00Z`) : null,
          fechaFin: e.hasta ? new Date(`${e.hasta}-01T00:00:00Z`) : null,
          esActual: e.esActual ?? false,
          descripcion: e.descripcion ?? null,
        })),
      },
      habilidades: { create: datos.habilidades.map((h) => ({ habilidadId: h.habilidadId, nivel: h.nivel ?? null })) },
      habilidadesPropias: { create: propias.map((h) => ({ nombre: h.nombre, categoria: h.categoria, nivel: h.nivel ?? null })) },
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        if (previo) {
          // Reemplazo COMPLETO: se borra lo anterior y se guarda lo nuevo.
          await tx.formacionCandidato.deleteMany({ where: { candidatoId: id } });
          await tx.experienciaCandidato.deleteMany({ where: { candidatoId: id } });
          await tx.candidatoHabilidad.deleteMany({ where: { candidatoId: id } });
          await tx.habilidadPropiaCandidato.deleteMany({ where: { candidatoId: id } });
          await tx.candidato.update({
            where: { id },
            data: {
              ...campos,
              ...hijos,
              vecesEnviado: { increment: 1 },
              // Si estaba inactivo y vuelve a enviar, esta disponible otra vez.
              ...(previo.estado === 'inactivo' ? { estado: 'activo' } : {}),
            },
          });
        } else {
          await tx.candidato.create({ data: { id, cedula, ...campos, ...hijos } });
        }
        await this.bitacora.registrar(
          {
            usuarioId: null,
            entidad: 'candidato',
            registroAfectadoId: id,
            accion: previo ? 'modificar' : 'crear',
            direccionIp,
            datosNuevos: { cedula, curriculum: Boolean(rutaNueva), consentimiento: consentimiento.id },
            descripcion: previo
              ? `Una persona reemplazó desde el formulario público el registro del Talent Pool con cédula ${cedula}.`
              : `Una persona se registró en el Talent Pool con la cédula ${cedula}.`,
          },
          tx,
        );
      });
    } catch (error) {
      if (rutaNueva) await this.almacen.eliminarDeCandidato(rutaNueva);
      throw error;
    }
    // El curriculum anterior se borra: el registro se reemplazo por completo.
    if (previo?.cvRutaArchivo) await this.almacen.eliminarDeCandidato(previo.cvRutaArchivo).catch(() => undefined);

    const persona = nombreCompleto({ nombre: datos.nombre, primerApellido: datos.primerApellido, segundoApellido: datos.segundoApellido ?? null });
    await this.notificaciones.avisarARrhh({
      clave: 'candidatoRegistrado',
      titulo: previo ? 'Candidato actualizado en el Talent Pool' : 'Nuevo candidato en el Talent Pool',
      mensaje: previo ? `${persona} reemplazó su registro en el Talent Pool.` : `${persona} se registró en el Talent Pool.`,
      entidad: 'candidato',
      registroId: id,
      enlace: `/talent-pool?abrir=${id}`,
    });
    return respuesta;
  }

  /* ================================================================== */
  /* Recursos Humanos                                                     */
  /* ================================================================== */

  async consultar(filtros: ConsultarCandidatosDto): Promise<PaginaDeResultados<CandidatoDeLista>> {
    const donde: Prisma.candidatoWhereInput = {};
    const y: Prisma.candidatoWhereInput[] = [];
    const estado = filtros.estado ?? 'activo';
    if (estado !== 'todos') donde.estado = estado;
    if (filtros.profesionId) donde.profesionId = filtros.profesionId;
    if (filtros.nivel) {
      y.push(
        filtros.nivel === 'curso'
          ? { formacion: { some: { nivel: 'curso' } } }
          : { formacion: { some: { nivel: { in: NIVELES_EDUCATIVOS.filter((n) => n !== 'curso' && ORDEN_DE_NIVEL[n] >= ORDEN_DE_NIVEL[filtros.nivel!]) } } } },
      );
    }
    for (const h of filtros.habilidades ?? []) y.push({ habilidades: { some: { habilidadId: h } } });
    if (filtros.aniosExperiencia) donde.mesesExperiencia = { gte: filtros.aniosExperiencia * 12 };
    if (filtros.conCurriculum === 'si') donde.cvRutaArchivo = { not: null };
    if (filtros.conCurriculum === 'no') donde.cvRutaArchivo = null;
    // Ultimo envio entre dos fechas (21/10): un dia AAAA-MM-DD cuenta completo, hora de Costa Rica.
    if (filtros.enviadoDesde || filtros.enviadoHasta) {
      if (filtros.enviadoDesde && filtros.enviadoHasta && filtros.enviadoDesde > filtros.enviadoHasta) {
        throw new BadRequestException({ codigo: 'FECHA_NO_VALIDA', message: 'La fecha «desde» no puede ser posterior a «hasta».' });
      }
      donde.fechaActualizacion = {
        ...(filtros.enviadoDesde ? { gte: new Date(`${filtros.enviadoDesde}T00:00:00.000-06:00`) } : {}),
        ...(filtros.enviadoHasta ? { lte: new Date(`${filtros.enviadoHasta}T23:59:59.999-06:00`) } : {}),
      };
    }
    if (filtros.busqueda) {
      const palabras = filtros.busqueda.split(/\s+/).filter(Boolean).slice(0, 6);
      for (const p of palabras) {
        y.push({
          OR: [
            { cedula: { contains: p } },
            { nombre: { contains: p } },
            { primerApellido: { contains: p } },
            { segundoApellido: { contains: p } },
            { correo: { contains: p } },
            { profesionTexto: { contains: p } },
            { profesion: { nombre: { contains: p } } },
            { descripcion: { contains: p } },
            { residencia: { contains: p } },
            { formacion: { some: { OR: [{ titulo: { contains: p } }, { areaEstudio: { contains: p } }, { institucion: { contains: p } }] } } },
            { experiencia: { some: { OR: [{ puesto: { contains: p } }, { empresa: { contains: p } }] } } },
            { habilidades: { some: { habilidad: { nombre: { contains: p } } } } },
            { habilidadesPropias: { some: { nombre: { contains: p } } } },
          ],
        });
      }
    }
    if (y.length) donde.AND = y;

    const [total, filas] = await Promise.all([
      this.prisma.candidato.count({ where: donde }),
      this.prisma.candidato.findMany({
        where: donde,
        orderBy: filtros.orden === 'nombre' ? [{ primerApellido: 'asc' }, { nombre: 'asc' }] : [{ fechaActualizacion: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.tamano,
        take: filtros.tamano,
        select: SELECCION_DE_LISTA,
      }),
    ]);
    return armarPagina(filas.map((f) => this.aLista(f)), total, filtros.pagina, filtros.tamano);
  }

  /** Cuantos hay en cada estado (para las pestañas). */
  async resumen(): Promise<Record<EstadoDeCandidato, number>> {
    const filas = await this.prisma.candidato.groupBy({ by: ['estado'], _count: { _all: true } });
    const r: Record<EstadoDeCandidato, number> = { activo: 0, inactivo: 0, contratado: 0, descartado: 0 };
    for (const f of filas) r[f.estado] = f._count._all;
    return r;
  }

  /** Opciones de los filtros de RRHH (incluye habilidades inactivas, por si hay candidatos con ellas). */
  async opciones() {
    const [profesiones, habilidades] = await Promise.all([
      this.prisma.profesion.findMany({ orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, activo: true } }),
      this.prisma.habilidad.findMany({ orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true, categoria: true, activo: true } }),
    ]);
    return { profesiones, habilidades, niveles: NIVELES_EDUCATIVOS.map((n) => ({ valor: n, texto: NOMBRES_DE_NIVEL[n] })) };
  }

  async detalle(id: string) {
    const c = await this.prisma.candidato.findUnique({
      where: { id },
      select: {
        ...SELECCION_DE_LISTA,
        habilidades: { select: { nivel: true, habilidad: { select: { id: true, nombre: true, categoria: true } } }, orderBy: { habilidad: { nombre: 'asc' } } },
        habilidadesPropias: { select: { id: true, nombre: true, categoria: true, nivel: true }, orderBy: { nombre: 'asc' } },
        fechaNacimiento: true,
        residencia: true,
        descripcion: true,
        cvNombreArchivo: true,
        cvTamanoBytes: true,
        vecesEnviado: true,
        notaInterna: true,
        fechaCambioEstado: true,
        fechaConsentimiento: true,
        consentimiento: { select: { version: true } },
        usuarioCambioEstado: { select: { correo: true, funcionario: { select: { nombre: true, primerApellido: true } } } },
        funcionario: { select: { id: true, nombre: true, primerApellido: true, segundoApellido: true } },
        formacion: { orderBy: [{ anioFinalizacion: 'desc' }], select: { id: true, nivel: true, titulo: true, institucion: true, areaEstudio: true, anioFinalizacion: true, concluido: true } },
        experiencia: { orderBy: [{ esActual: 'desc' }, { fechaInicio: 'desc' }], select: { id: true, empresa: true, puesto: true, fechaInicio: true, fechaFin: true, esActual: true, descripcion: true } },
      },
    });
    if (!c) throw this.noEncontrado();
    const quien = c.usuarioCambioEstado;
    return {
      ...this.aLista({ ...c, habilidades: c.habilidades.map((h) => ({ habilidad: { nombre: h.habilidad.nombre } })), habilidadesPropias: c.habilidadesPropias }),
      nombreSolo: c.nombre,
      primerApellido: c.primerApellido,
      segundoApellido: c.segundoApellido,
      fechaNacimiento: aFechaSola(c.fechaNacimiento),
      residencia: c.residencia,
      descripcion: c.descripcion,
      curriculum: c.cvRutaArchivo ? { nombre: c.cvNombreArchivo, tamanoBytes: c.cvTamanoBytes } : null,
      vecesEnviado: c.vecesEnviado,
      notaInterna: c.notaInterna,
      cambioDeEstado: c.fechaCambioEstado
        ? { fecha: c.fechaCambioEstado.toISOString(), por: quien?.funcionario ? `${quien.funcionario.nombre} ${quien.funcionario.primerApellido}` : (quien?.correo ?? null) }
        : null,
      consentimiento: { version: c.consentimiento.version, fecha: c.fechaConsentimiento.toISOString() },
      funcionario: c.funcionario ? { id: c.funcionario.id, nombre: nombreCompleto(c.funcionario) } : null,
      formacion: c.formacion,
      experiencia: c.experiencia.map((e) => ({ ...e, fechaInicio: aFechaSola(e.fechaInicio)?.slice(0, 7) ?? null, fechaFin: aFechaSola(e.fechaFin)?.slice(0, 7) ?? null })),
      habilidadesDetalle: [
        ...c.habilidades.map((h) => ({ id: h.habilidad.id, nombre: h.habilidad.nombre, categoria: h.habilidad.categoria, nivel: h.nivel, propia: false })),
        // Escritas por el candidato: solo de su perfil (17/10).
        ...c.habilidadesPropias.map((h) => ({ id: h.id, nombre: h.nombre, categoria: h.categoria, nivel: h.nivel, propia: true })),
      ],
    };
  }

  /** Datos personales para prellenar "Registrar funcionario" al contratar (Ficha 41). */
  async datosParaContratar(id: string) {
    const c = await this.prisma.candidato.findUnique({
      where: { id },
      select: {
        id: true,
        cedula: true,
        nombre: true,
        primerApellido: true,
        segundoApellido: true,
        correo: true,
        telefono: true,
        fechaNacimiento: true,
        residencia: true,
        profesionId: true,
        funcionarioId: true,
        cvRutaArchivo: true,
        profesion: { select: { activo: true } },
      },
    });
    if (!c) throw this.noEncontrado();
    if (c.funcionarioId) throw this.yaContratado();
    return {
      id: c.id,
      cedula: c.cedula,
      nombre: c.nombre,
      primerApellido: c.primerApellido,
      segundoApellido: c.segundoApellido,
      correoPersonal: c.correo,
      telefonoPersonal: c.telefono,
      fechaNacimiento: aFechaSola(c.fechaNacimiento),
      direccion: c.residencia,
      profesionId: c.profesion?.activo ? c.profesionId : null,
      tieneCurriculum: Boolean(c.cvRutaArchivo),
    };
  }

  async abrirCurriculum(id: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<ArchivoAbierto> {
    const c = await this.prisma.candidato.findUnique({ where: { id }, select: { cvRutaArchivo: true, cvNombreArchivo: true, cedula: true, nombre: true, primerApellido: true, segundoApellido: true } });
    if (!c) throw this.noEncontrado();
    if (!c.cvRutaArchivo) throw new NotFoundException({ codigo: 'SIN_CURRICULUM', message: 'Este candidato no adjuntó currículum.' });
    const contenido = await this.almacen.leer(c.cvRutaArchivo);
    // Ver un documento se audita (decision del 10/10), aunque consultar la lista no.
    await this.bitacora.registrar({
      usuarioId: quienActua.id,
      entidad: 'candidato',
      registroAfectadoId: id,
      accion: 'consultar',
      direccionIp,
      descripcion: `Vio el currículum del candidato ${nombreCompleto(c)} (cédula ${c.cedula}).`,
    });
    return { contenido, mime: FORMATOS.pdf.mime, nombre: c.cvNombreArchivo ?? 'curriculum.pdf', modo: 'ver' };
  }

  async cambiar(id: string, datos: CambiarCandidatoDto, quienActua: UsuarioAutenticado, direccionIp?: string) {
    const c = await this.prisma.candidato.findUnique({ where: { id }, select: { estado: true, notaInterna: true, cedula: true, nombre: true, primerApellido: true, segundoApellido: true } });
    if (!c) throw this.noEncontrado();
    if (c.estado === 'contratado' && datos.estado) {
      throw new ConflictException({ codigo: 'CANDIDATO_CONTRATADO', message: 'Este candidato ya fue contratado: su estado no se cambia.' });
    }
    const cambios: Prisma.candidatoUpdateInput = {};
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};
    if (datos.estado && datos.estado !== c.estado) {
      cambios.estado = datos.estado;
      cambios.fechaCambioEstado = new Date();
      cambios.usuarioCambioEstado = { connect: { id: quienActua.id } };
      antes.estado = NOMBRES_DE_ESTADO[c.estado];
      despues.estado = NOMBRES_DE_ESTADO[datos.estado];
    }
    if (datos.notaInterna !== undefined && (datos.notaInterna ?? null) !== c.notaInterna) {
      cambios.notaInterna = datos.notaInterna ?? null;
      antes.notaInterna = c.notaInterna;
      despues.notaInterna = datos.notaInterna ?? null;
    }
    if (!Object.keys(cambios).length) throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay nada que cambiar.' });

    await this.prisma.$transaction(async (tx) => {
      await tx.candidato.update({ where: { id }, data: cambios });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'candidato',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: antes,
          datosNuevos: despues,
          descripcion: despues.estado
            ? `Cambió el estado del candidato ${nombreCompleto(c)} a «${String(despues.estado)}».`
            : `Cambió la nota interna del candidato ${nombreCompleto(c)}.`,
        },
        tx,
      );
    });
    return this.detalle(id);
  }

  /** Eliminar a solicitud de la persona (Ley 8968). No se puede si ya es funcionario. */
  async eliminar(id: string, datos: EliminarCandidatoDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<{ eliminado: true }> {
    const c = await this.prisma.candidato.findUnique({ where: { id }, select: { cedula: true, funcionarioId: true, cvRutaArchivo: true } });
    if (!c) throw this.noEncontrado();
    if (c.funcionarioId) {
      throw new ConflictException({ codigo: 'CANDIDATO_CONTRATADO', message: 'Este candidato ya es funcionario: sus datos están en su expediente y no se eliminan desde aquí.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.candidato.delete({ where: { id } }); // formacion, experiencia y habilidades se borran en cascada
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'candidato',
          registroAfectadoId: id,
          accion: 'eliminar',
          direccionIp,
          // Solo la cedula: el resto de los datos se elimino a pedido de la persona.
          datosAnteriores: { cedula: c.cedula },
          descripcion: `Eliminó del Talent Pool los datos de la cédula ${c.cedula}. Motivo: ${datos.motivo}`,
        },
        tx,
      );
    });
    if (c.cvRutaArchivo) await this.almacen.eliminarDeCandidato(c.cvRutaArchivo).catch(() => undefined);
    return { eliminado: true };
  }

  /**
   * Ficha 41. "datos" es el formulario de Registrar funcionario, ya
   * prellenado con los datos del candidato y completado por RRHH. Todo pasa
   * en una sola transaccion (si algo falla, no se crea nada). El curriculum
   * se copia despues; si no se puede, se avisa a RRHH.
   */
  async contratar(id: string, datos: RegistrarFuncionarioDto, quienActua: UsuarioAutenticado, direccionIp?: string) {
    const c = await this.prisma.candidato.findUnique({
      where: { id },
      select: { cedula: true, funcionarioId: true, estado: true, cvRutaArchivo: true, fechaActualizacion: true, nombre: true, primerApellido: true, segundoApellido: true },
    });
    if (!c) throw this.noEncontrado();
    if (c.funcionarioId) throw this.yaContratado();
    if (normalizarCedula(datos.cedula) !== c.cedula) {
      throw new BadRequestException({ codigo: 'CEDULA_NO_COINCIDE', message: 'La cédula debe ser la del candidato que se está contratando.' });
    }

    const resultado = await this.funcionarios.registrar(datos, quienActua, direccionIp, async (tx, funcionarioId) => {
      const n = await tx.candidato.updateMany({
        where: { id, funcionarioId: null },
        data: { estado: 'contratado', funcionarioId, fechaCambioEstado: new Date(), usuarioCambioEstadoId: quienActua.id },
      });
      if (n.count === 0) throw this.yaContratado();
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'candidato',
          registroAfectadoId: id,
          funcionarioAfectadoId: funcionarioId,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { estado: NOMBRES_DE_ESTADO[c.estado] },
          datosNuevos: { estado: NOMBRES_DE_ESTADO.contratado, funcionario: funcionarioId },
          descripcion: `Contrató desde el Talent Pool a ${nombreCompleto(c)} (cédula ${c.cedula}): se creó su perfil de funcionario.`,
        },
        tx,
      );
    });

    const funcionarioId = resultado.funcionario.id;
    let curriculumCopiado: boolean | null = null;
    if (c.cvRutaArchivo) {
      try {
        const tipo =
          (await this.prisma.tipoDocumento.findFirst({ where: { generadoPorSistema: true, nombre: 'Curriculum' }, select: { id: true } })) ??
          (await this.prisma.tipoDocumento.findFirst({ where: { generadoPorSistema: true, tiposSolicitud: { none: {} } }, select: { id: true } }));
        if (!tipo) throw new Error('No existe el tipo de documento del currículum.');
        await this.documentos.registrarGenerado({
          funcionarioId,
          tipoDocumentoId: tipo.id,
          titulo: 'Currículum (Talent Pool)',
          descripcion: `Enviado por la persona al Talent Pool; última versión del ${aFechaSola(c.fechaActualizacion)}.`,
          contenido: await this.almacen.leer(c.cvRutaArchivo),
          usuarioOrigenId: quienActua.id,
        });
        curriculumCopiado = true;
      } catch (error) {
        curriculumCopiado = false;
        this.registro.error(`No se pudo copiar el currículum del candidato ${id}: ${error instanceof Error ? error.message : String(error)}`);
        await this.notificaciones.avisarARrhh({
          clave: 'curriculumNoCopiado',
          titulo: 'No se copió el currículum',
          mensaje: `Se contrató a ${nombreCompleto(c)}, pero su currículum no se pudo copiar al expediente. Descárguelo del Talent Pool y súbalo manualmente.`,
          entidad: 'candidato',
          registroId: id,
          enlace: `/talent-pool?abrir=${id}&estado=todos`,
        });
      }
    }
    return { ...resultado, curriculumCopiado };
  }

  /* ---------------------------------------------------------------- */
  /* Habilidades (catalogo)                                            */
  /* ---------------------------------------------------------------- */

  async habilidades() {
    const filas = await this.prisma.habilidad.findMany({
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, descripcion: true, categoria: true, activo: true, _count: { select: { candidatos: true } } },
    });
    return filas.map(({ _count, ...h }) => ({ ...h, candidatos: _count.candidatos }));
  }

  async crearHabilidad(datos: HabilidadDto, quienActua: UsuarioAutenticado, direccionIp?: string) {
    await this.nombreLibre(datos.nombre);
    return this.prisma.$transaction(async (tx) => {
      const h = await tx.habilidad.create({ data: { nombre: datos.nombre, categoria: datos.categoria, descripcion: datos.descripcion ?? null }, select: { id: true, nombre: true } });
      await this.bitacora.registrar(
        { usuarioId: quienActua.id, entidad: 'habilidad', registroAfectadoId: h.id, accion: 'crear', direccionIp, datosNuevos: { ...datos }, descripcion: `Agregó la habilidad «${h.nombre}» al Talent Pool.` },
        tx,
      );
      return h;
    });
  }

  async editarHabilidad(id: string, datos: EditarHabilidadDto, quienActua: UsuarioAutenticado, direccionIp?: string) {
    const antes = await this.prisma.habilidad.findUnique({ where: { id }, select: { nombre: true, categoria: true, descripcion: true, activo: true } });
    if (!antes) throw new NotFoundException({ codigo: 'HABILIDAD_NO_ENCONTRADA', message: 'No se encontró la habilidad.' });
    if (datos.nombre && datos.nombre.toLowerCase() !== antes.nombre.toLowerCase()) await this.nombreLibre(datos.nombre);
    const cambios = Object.fromEntries(Object.entries(datos).filter(([k, v]) => v !== undefined && v !== (antes as Record<string, unknown>)[k]));
    if (!Object.keys(cambios).length) throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay nada que cambiar.' });
    return this.prisma.$transaction(async (tx) => {
      const h = await tx.habilidad.update({ where: { id }, data: cambios, select: { id: true, nombre: true, activo: true } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'habilidad',
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: Object.fromEntries(Object.keys(cambios).map((k) => [k, (antes as Record<string, unknown>)[k]])),
          datosNuevos: cambios,
          descripcion: cambios.activo === false ? `Inactivó la habilidad «${antes.nombre}».` : `Modificó la habilidad «${h.nombre}».`,
        },
        tx,
      );
      return h;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Apoyo                                                             */
  /* ---------------------------------------------------------------- */

  private aLista(f: FilaDeLista): CandidatoDeLista {
    const niveles = f.formacion.map((x) => x.nivel).filter((n) => n !== 'curso');
    const nivelMaximo = niveles.sort((a, b) => ORDEN_DE_NIVEL[b] - ORDEN_DE_NIVEL[a])[0] ?? (f.formacion.length ? 'curso' : null);
    return {
      id: f.id,
      cedula: f.cedula,
      nombre: nombreCompleto(f),
      correo: f.correo,
      telefono: f.telefono,
      profesion: f.profesion?.nombre ?? f.profesionTexto,
      profesionDigitada: !f.profesion && Boolean(f.profesionTexto),
      nivelMaximo,
      aniosExperiencia: Math.floor(f.mesesExperiencia / 12),
      habilidades: [...f.habilidades.map((h) => h.habilidad.nombre), ...f.habilidadesPropias.map((h) => h.nombre)],
      estado: f.estado,
      tieneCurriculum: Boolean(f.cvRutaArchivo),
      fechaRegistro: f.fechaRegistro.toISOString(),
      fechaActualizacion: f.fechaActualizacion.toISOString(),
      funcionarioId: f.funcionarioId,
    };
  }

  private async nombreLibre(nombre: string): Promise<void> {
    const ya = await this.prisma.habilidad.findFirst({ where: { nombre }, select: { id: true } });
    if (ya) throw new ConflictException({ codigo: 'HABILIDAD_DUPLICADA', message: 'Ya existe una habilidad con ese nombre.' });
  }

  private noEncontrado() {
    return new NotFoundException({ codigo: 'CANDIDATO_NO_ENCONTRADO', message: 'No se encontró el candidato.' });
  }

  private yaContratado() {
    return new ConflictException({ codigo: 'CANDIDATO_YA_CONTRATADO', message: 'Este candidato ya fue contratado: tiene su perfil de funcionario.' });
  }
}
