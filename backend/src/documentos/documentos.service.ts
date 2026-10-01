import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { AlmacenCifradoService } from '../almacenamiento/almacen-cifrado.service.js';
import {
  detectarFormato,
  FORMATOS,
  leerFormatos,
  describirFormatos,
  TAMANO_MAXIMO_DOCUMENTO,
  validarArchivo,
  type ArchivoSubido,
  type Formato,
} from '../almacenamiento/validacion-de-archivos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola } from '../comun/fechas.js';
import { ExpedientesService } from '../expedientes/expedientes.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ConsultarDocumentosDto, DarDeBajaDocumentoDto, EditarDocumentoDto, SubirDocumentoDto } from './dto/documentos.dto.js';

/** Permisos de la gestion documental (ver seed.ts). */
const PERMISO_EDITAR = 'documentos.editar';
const PERMISO_EDITAR_PROPIO = 'documentos.editarPropio';
const PERMISO_BAJA = 'documentos.darDeBaja';
const PERMISO_BAJA_PROPIO = 'documentos.darDeBajaPropio';
const PERMISO_RESTAURAR = 'documentos.restaurar';

/** Un documento tal como lo ve quien consulta el expediente. */
export interface DocumentoDeLista {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: { id: string; nombre: string };
  nombreArchivo: string;
  formato: Formato;
  tamanoBytes: number;
  /** Fecha del documento (emision), "AAAA-MM-DD". */
  fechaDocumento: string | null;
  /** Cuando se subio (ISO). */
  fechaRegistro: string;
  generadoPorSistema: boolean;
  /** Quien lo subio (nombre o correo); null si lo genero SINERGIA. */
  subidoPor: string | null;
  /** Lo subio la propia persona dueña del expediente. */
  subidoPorElFuncionario: boolean;
  vigente: boolean;
  /** Datos de la baja; solo los ve quien puede ver bajas (Recursos Humanos). */
  baja: { fecha: string | null; motivo: string | null; quien: string | null; porElFuncionario: boolean } | null;
  /** Lo que quien consulta puede hacer con este documento, y por que no cuando no puede. */
  acciones: {
    puedeEditar: boolean;
    motivoSinEditar: string | null;
    puedeDarDeBaja: boolean;
    motivoSinBaja: string | null;
    puedeRestaurar: boolean;
    motivoSinRestaurar: string | null;
  };
}

/** Lo que entrega abrir un archivo. */
export interface ArchivoAbierto {
  contenido: Buffer;
  mime: string;
  nombre: string;
  modo: 'ver' | 'descargar';
}

/** Datos para que otro proceso (vacaciones, Talent Pool) guarde un documento generado por SINERGIA. */
export interface DocumentoGenerado {
  funcionarioId: string;
  /** Debe ser un tipo marcado generadoPorSistema. */
  tipoDocumentoId: string;
  titulo: string;
  descripcion?: string;
  contenido: Buffer;
  /** Quien disparo el proceso origen (para la bitacora: Ficha 21, trazabilidad). */
  usuarioOrigenId: string;
  fechaDocumento?: Date;
}

const SELECCION = {
  id: true,
  titulo: true,
  descripcion: true,
  nombreArchivo: true,
  tipoMime: true,
  tamanoBytes: true,
  fechaDocumento: true,
  fechaRegistro: true,
  generadoPorSistema: true,
  vigente: true,
  fechaBaja: true,
  motivoBaja: true,
  usuarioRegistroId: true,
  usuarioBajaId: true,
  funcionarioId: true,
  tipoDocumento: { select: { id: true, nombre: true } },
  funcionario: { select: { usuario: { select: { id: true } } } },
  usuarioRegistro: { select: { correo: true, funcionario: { select: { nombre: true, primerApellido: true, segundoApellido: true } } } },
  usuarioBaja: { select: { correo: true, funcionario: { select: { nombre: true, primerApellido: true, segundoApellido: true } } } },
} as const;

type Fila = Prisma.documentoGetPayload<{ select: typeof SELECCION }>;
type Cliente = Prisma.TransactionClient | PrismaService;

/**
 * Gestion documental del expediente (Fichas 19, 20, 21 y 42).
 *
 * Reglas (CONTEXTO seccion 6 y 9):
 *   - Cada persona sube documentos a SU expediente; RRHH a cualquiera. El
 *     expediente ajeno solo lo abre quien tiene expediente.verTodos (RRHH),
 *     la misma regla de ExpedientesService.revisarAcceso.
 *   - El archivo se valida en el backend (extension, MIME, firma real,
 *     tamano de 25 MB y los formatos que acepta el TIPO elegido), se cifra
 *     con AES-256-GCM y se guarda en el servidor; la base solo guarda la
 *     ruta relativa, el hash y los metadatos.
 *   - Editar: solo titulo, tipo, descripcion y fecha (el archivo NUNCA se
 *     reemplaza). La persona, solo en lo que ella subio; RRHH en lo manual.
 *     Lo generado por SINERGIA solo se ve.
 *   - Baja logica, nunca borrado fisico. La persona da de baja solo lo que
 *     ella subio; RRHH cualquiera; RRHH restaura. Lo que la persona dio de
 *     baja desaparece por completo para ella.
 *   - Ver y descargar un documento queda SIEMPRE en la bitacora (T-4).
 */
@Injectable()
export class DocumentosService {
  private readonly registro = new Logger('Documentos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly almacen: AlmacenCifradoService,
    private readonly expedientes: ExpedientesService,
  ) {}

  /* ================================================================ */
  /* Consultar                                                         */
  /* ================================================================ */

  listar(
    funcionarioId: string,
    filtros: ConsultarDocumentosDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<PaginaDeResultados<DocumentoDeLista>> {
    return this.vigilando({ funcionarioId, intento: 'ver la lista de documentos' }, quienActua, direccionIp, () =>
      this.listarDirecto(funcionarioId, filtros, quienActua),
    );
  }

  private async listarDirecto(
    funcionarioId: string,
    filtros: ConsultarDocumentosDto,
    quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<DocumentoDeLista>> {
    this.expedientes.revisarAcceso(funcionarioId, quienActua);
    await this.verificarFuncionario(this.prisma, funcionarioId);
    const { pagina, tamano } = filtros;

    // Las bajas solo las ve quien puede restaurar (RRHH). Para los demas se
    // fuerza "vigentes", aunque pidan otra cosa.
    const estado = this.puedeVerBajas(quienActua) ? (filtros.estado ?? 'vigentes') : 'vigentes';
    const donde: Prisma.documentoWhereInput = {
      funcionarioId,
      ...(estado === 'vigentes' ? { vigente: true } : estado === 'bajas' ? { vigente: false } : {}),
      ...(filtros.tipoDocumentoId ? { tipoDocumentoId: filtros.tipoDocumentoId } : {}),
      ...(filtros.busqueda
        ? { OR: [{ titulo: { contains: filtros.busqueda } }, { nombreArchivo: { contains: filtros.busqueda } }] }
        : {}),
    };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.documento.count({ where: donde }),
      this.prisma.documento.findMany({
        where: donde,
        orderBy: [{ fechaRegistro: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: SELECCION,
      }),
    ]);
    return armarPagina(
      filas.map((fila) => this.aDocumento(fila, quienActua)),
      total,
      pagina,
      tamano,
    );
  }

  /**
   * Abre el archivo (descifrado) para verlo o descargarlo. Antes revisa el
   * acceso al expediente y la integridad (hash) y despues anota en la
   * bitacora quien lo abrio.
   */
  abrirArchivo(
    documentoId: string,
    modo: 'ver' | 'descargar',
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ArchivoAbierto> {
    return this.vigilando(
      { documentoId, intento: modo === 'ver' ? 'abrir un documento' : 'descargar un documento', accion: modo === 'ver' ? 'consultar' : 'descargar' },
      quienActua,
      direccionIp,
      () => this.abrirArchivoDirecto(documentoId, modo, quienActua, direccionIp),
    );
  }

  private async abrirArchivoDirecto(
    documentoId: string,
    modo: 'ver' | 'descargar',
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ArchivoAbierto> {
    const doc = await this.prisma.documento.findUnique({
      where: { id: documentoId },
      select: { ...SELECCION, rutaArchivo: true, hashContenido: true },
    });
    if (!doc) throw this.noEncontrado();
    this.expedientes.revisarAcceso(doc.funcionarioId, quienActua);
    // Un documento dado de baja no existe para quien no puede verlo.
    if (!doc.vigente && !this.puedeVerBajas(quienActua)) throw this.noEncontrado();

    const contenido = await this.almacen.leer(doc.rutaArchivo);
    if (doc.hashContenido && createHash('sha256').update(contenido).digest('hex') !== doc.hashContenido) {
      this.registro.error(`El documento ${doc.id} no coincide con su hash: el archivo fue alterado o reemplazado.`);
      throw new InternalServerErrorException({
        codigo: 'ARCHIVO_NO_DISPONIBLE',
        message: 'No se pudo abrir el archivo. Avise al Departamento de TI.',
      });
    }

    const nombre = await this.nombreDelDuenio(doc.funcionarioId);
    const esPropio = doc.funcionarioId === quienActua.funcionarioId;
    await this.bitacora.registrar({
      usuarioId: quienActua.id,
      entidad: 'documento',
      registroAfectadoId: doc.id,
      funcionarioAfectadoId: doc.funcionarioId,
      accion: modo === 'ver' ? 'consultar' : 'descargar',
      direccionIp,
      descripcion: `${modo === 'ver' ? 'Abrió' : 'Descargó'} el documento «${doc.titulo}» ${esPropio ? 'de su expediente' : `del expediente de ${nombre}`}.`,
    });

    return { contenido, mime: doc.tipoMime, nombre: doc.nombreArchivo, modo };
  }

  /* ================================================================ */
  /* Subir                                                             */
  /* ================================================================ */

  subir(
    funcionarioId: string,
    archivo: ArchivoSubido | undefined,
    datos: SubirDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista> {
    return this.vigilando({ funcionarioId, intento: 'subir un documento', accion: 'crear' }, quienActua, direccionIp, () =>
      this.subirDirecto(funcionarioId, archivo, datos, quienActua, direccionIp),
    );
  }

  private async subirDirecto(
    funcionarioId: string,
    archivo: ArchivoSubido | undefined,
    datos: SubirDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista> {
    this.expedientes.revisarAcceso(funcionarioId, quienActua);
    await this.verificarFuncionario(this.prisma, funcionarioId);

    const tipo = await this.cargarTipoManual(datos.tipoDocumentoId);
    const permitidos = leerFormatos(tipo.formatosPermitidos);
    const valido = validarArchivo(archivo, permitidos, TAMANO_MAXIMO_DOCUMENTO, `el tipo «${tipo.nombre}»`);
    const fechaDocumento = this.leerFechaDelDocumento(datos.fechaDocumento);

    const contenido = archivo!.buffer;
    const hash = createHash('sha256').update(contenido).digest('hex');
    const ruta = await this.almacen.guardar('expedientes', funcionarioId, contenido);
    const nombreDuenio = await this.nombreDelDuenio(funcionarioId);
    const esPropio = funcionarioId === quienActua.funcionarioId;

    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        const fila = await tx.documento.create({
          data: {
            funcionarioId,
            tipoDocumentoId: tipo.id,
            titulo: datos.titulo,
            descripcion: datos.descripcion ?? null,
            nombreArchivo: valido.nombreOriginal,
            rutaArchivo: ruta,
            tipoMime: valido.mime,
            tamanoBytes: contenido.length,
            hashContenido: hash,
            generadoPorSistema: false,
            fechaDocumento,
            usuarioRegistroId: quienActua.id,
          },
          select: { id: true },
        });
        await this.bitacora.registrar(
          {
            usuarioId: quienActua.id,
            entidad: 'documento',
            registroAfectadoId: fila.id,
            funcionarioAfectadoId: funcionarioId,
            accion: 'crear',
            direccionIp,
            datosNuevos: { titulo: datos.titulo, tipo: tipo.nombre, nombreArchivo: valido.nombreOriginal, tamanoBytes: contenido.length },
            descripcion: esPropio
              ? `Subió el documento «${datos.titulo}» (${tipo.nombre}) a su expediente.`
              : `Subió el documento «${datos.titulo}» (${tipo.nombre}) al expediente de ${nombreDuenio}.`,
          },
          tx,
        );
        return fila;
      });
      return await this.consultarUno(creado.id, quienActua);
    } catch (error) {
      // No quedo registrado: se quita el archivo recien guardado para no dejar huerfanos.
      await this.almacen.descartarRecienGuardado(ruta);
      throw error;
    }
  }

  /**
   * Guarda un documento que GENERA SINERGIA (Ficha 21): la constancia de
   * vacaciones, el curriculum copiado del Talent Pool, etc. Lo usan los
   * procesos de los sprints 2 y 3; no tiene endpoint propio.
   *
   * Uso: despues de generar el PDF, el proceso llama
   *   await documentos.registrarGenerado({ funcionarioId, tipoDocumentoId, titulo, contenido, usuarioOrigenId });
   * y el documento queda cifrado, asociado al expediente, marcado como
   * generado por el sistema y anotado en la bitacora. Si falla, el proceso
   * debe avisar a RRHH (Diagrama 3c) para que lo suba manualmente.
   */
  async registrarGenerado(datos: DocumentoGenerado): Promise<{ id: string }> {
    const tipo = await this.prisma.tipoDocumento.findUnique({
      where: { id: datos.tipoDocumentoId },
      select: { id: true, nombre: true, generadoPorSistema: true, formatosPermitidos: true },
    });
    if (!tipo?.generadoPorSistema) {
      throw new BadRequestException({
        codigo: 'TIPO_NO_ES_DE_SISTEMA',
        message: 'Solo se pueden registrar automáticamente documentos de tipos que genera SINERGIA.',
      });
    }
    await this.verificarFuncionario(this.prisma, datos.funcionarioId);

    const formato = detectarFormato(datos.contenido);
    const permitidos = leerFormatos(tipo.formatosPermitidos);
    if (!formato || !permitidos.includes(formato)) {
      throw new BadRequestException({
        codigo: 'CONTENIDO_NO_COINCIDE',
        message: `El documento generado debe ser ${describirFormatos(permitidos)} válido.`,
      });
    }
    if (datos.contenido.length === 0 || datos.contenido.length > TAMANO_MAXIMO_DOCUMENTO) {
      throw new BadRequestException({ codigo: 'ARCHIVO_VACIO', message: 'El documento generado está vacío o es demasiado grande.' });
    }

    const hash = createHash('sha256').update(datos.contenido).digest('hex');
    const ruta = await this.almacen.guardar('expedientes', datos.funcionarioId, datos.contenido);
    const nombreArchivo = `${datos.titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 100) || 'documento'}.${FORMATOS[formato].extensiones[0]}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const fila = await tx.documento.create({
          data: {
            funcionarioId: datos.funcionarioId,
            tipoDocumentoId: tipo.id,
            titulo: datos.titulo,
            descripcion: datos.descripcion ?? null,
            nombreArchivo,
            rutaArchivo: ruta,
            tipoMime: FORMATOS[formato].mime,
            tamanoBytes: datos.contenido.length,
            hashContenido: hash,
            generadoPorSistema: true,
            fechaDocumento: datos.fechaDocumento ?? hoyEnCostaRica(),
            usuarioRegistroId: null,
          },
          select: { id: true },
        });
        await this.bitacora.registrar(
          {
            usuarioId: datos.usuarioOrigenId,
            entidad: 'documento',
            registroAfectadoId: fila.id,
            funcionarioAfectadoId: datos.funcionarioId,
            accion: 'crear',
            datosNuevos: { titulo: datos.titulo, tipo: tipo.nombre, generadoPorSistema: true },
            descripcion: `SINERGIA generó el documento «${datos.titulo}» (${tipo.nombre}) y lo asoció al expediente.`,
          },
          tx,
        );
        return fila;
      });
    } catch (error) {
      await this.almacen.descartarRecienGuardado(ruta);
      throw error;
    }
  }

  /* ================================================================ */
  /* Editar, dar de baja, restaurar                                    */
  /* ================================================================ */

  editar(
    documentoId: string,
    datos: EditarDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista> {
    return this.vigilando({ documentoId, intento: 'editar un documento', accion: 'modificar' }, quienActua, direccionIp, () =>
      this.editarDirecto(documentoId, datos, quienActua, direccionIp),
    );
  }

  private async editarDirecto(
    documentoId: string,
    datos: EditarDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista> {
    if (Object.values(datos).every((v) => v === undefined)) {
      throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'Indique qué quiere cambiar del documento.' });
    }

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, documentoId, quienActua);
      const acciones = this.calcularAcciones(actual, quienActua);
      if (!acciones.puedeEditar) {
        throw new ConflictException({ codigo: 'DOCUMENTO_NO_EDITABLE', message: acciones.motivoSinEditar ?? 'No puede editar este documento.' });
      }

      let tipoNuevo: { id: string; nombre: string } | null = null;
      if (datos.tipoDocumentoId && datos.tipoDocumentoId !== actual.tipoDocumento.id) {
        const tipo = await this.cargarTipoManual(datos.tipoDocumentoId, tx);
        const formato = this.formatoDe(actual.tipoMime);
        if (!leerFormatos(tipo.formatosPermitidos).includes(formato)) {
          // El archivo no se reemplaza: si el tipo nuevo no acepta su formato, no sirve.
          throw new BadRequestException({
            codigo: 'TIPO_NO_ACEPTA_EL_FORMATO',
            message: `El tipo «${tipo.nombre}» solo acepta archivos ${describirFormatos(leerFormatos(tipo.formatosPermitidos))} y este documento es ${FORMATOS[formato].etiqueta}. Si subió el archivo equivocado, dé de baja este documento y suba el correcto.`,
          });
        }
        tipoNuevo = tipo;
      }

      const titulo = datos.titulo ?? actual.titulo;
      const descripcion = datos.descripcion === undefined ? actual.descripcion : datos.descripcion;
      const fecha = datos.fechaDocumento === undefined ? actual.fechaDocumento : datos.fechaDocumento === null ? null : this.leerFechaDelDocumento(datos.fechaDocumento);
      const cambios: Record<string, [unknown, unknown]> = {};
      if (titulo !== actual.titulo) cambios.titulo = [actual.titulo, titulo];
      if (tipoNuevo) cambios.tipo = [actual.tipoDocumento.nombre, tipoNuevo.nombre];
      if (descripcion !== actual.descripcion) cambios.descripcion = [actual.descripcion, descripcion];
      if (aFechaSola(fecha) !== aFechaSola(actual.fechaDocumento)) cambios.fechaDocumento = [aFechaSola(actual.fechaDocumento), aFechaSola(fecha)];
      if (Object.keys(cambios).length === 0) {
        throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay nada que cambiar: los datos son los mismos.' });
      }

      await tx.documento.update({
        where: { id: documentoId },
        data: { titulo, descripcion, fechaDocumento: fecha, ...(tipoNuevo ? { tipoDocumentoId: tipoNuevo.id } : {}) },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'documento',
          registroAfectadoId: documentoId,
          funcionarioAfectadoId: actual.funcionarioId,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, v[0]])),
          datosNuevos: Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, v[1]])),
          descripcion: `Editó el documento «${actual.titulo}» (${Object.keys(cambios).join(', ')}).`,
        },
        tx,
      );
    });
    return this.consultarUno(documentoId, quienActua);
  }

  darDeBaja(
    documentoId: string,
    datos: DarDeBajaDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista | { id: string; vigente: false }> {
    return this.vigilando({ documentoId, intento: 'dar de baja un documento', accion: 'eliminar' }, quienActua, direccionIp, () =>
      this.darDeBajaDirecto(documentoId, datos, quienActua, direccionIp),
    );
  }

  private async darDeBajaDirecto(
    documentoId: string,
    datos: DarDeBajaDocumentoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DocumentoDeLista | { id: string; vigente: false }> {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, documentoId, quienActua);
      const acciones = this.calcularAcciones(actual, quienActua);
      if (!acciones.puedeDarDeBaja) {
        throw new ConflictException({ codigo: 'BAJA_NO_PERMITIDA', message: acciones.motivoSinBaja ?? 'No puede dar de baja este documento.' });
      }
      const motivo = datos.motivo ?? null;
      await tx.documento.update({
        where: { id: documentoId },
        data: { vigente: false, usuarioBajaId: quienActua.id, fechaBaja: new Date(), motivoBaja: motivo },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'documento',
          registroAfectadoId: documentoId,
          funcionarioAfectadoId: actual.funcionarioId,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { vigente: true },
          datosNuevos: { vigente: false, titulo: actual.titulo, motivoBaja: motivo },
          descripcion: `Dio de baja el documento «${actual.titulo}»${motivo ? ` (${motivo})` : ''}.`,
        },
        tx,
      );
    });
    // Quien no puede ver bajas (la propia persona) ya no lo ve: solo se confirma.
    return this.puedeVerBajas(quienActua) ? this.consultarUno(documentoId, quienActua) : { id: documentoId, vigente: false };
  }

  restaurar(documentoId: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DocumentoDeLista> {
    return this.vigilando({ documentoId, intento: 'restaurar un documento', accion: 'modificar' }, quienActua, direccionIp, () =>
      this.restaurarDirecto(documentoId, quienActua, direccionIp),
    );
  }

  private async restaurarDirecto(documentoId: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DocumentoDeLista> {
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, documentoId, quienActua);
      if (actual.vigente) {
        throw new ConflictException({ codigo: 'DOCUMENTO_VIGENTE', message: 'El documento no está dado de baja.' });
      }
      await tx.documento.update({
        where: { id: documentoId },
        data: { vigente: true, usuarioBajaId: null, fechaBaja: null, motivoBaja: null },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'documento',
          registroAfectadoId: documentoId,
          funcionarioAfectadoId: actual.funcionarioId,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { vigente: false, motivoBaja: actual.motivoBaja },
          datosNuevos: { vigente: true, titulo: actual.titulo },
          descripcion: `Restauró el documento «${actual.titulo}».`,
        },
        tx,
      );
    });
    return this.consultarUno(documentoId, quienActua);
  }

  /* ================================================================ */
  /* Piezas internas                                                   */
  /* ================================================================ */

  /** RRHH (quien puede restaurar) ve tambien los documentos dados de baja. */
  private puedeVerBajas(quienActua: UsuarioAutenticado): boolean {
    return quienActua.permisos.includes(PERMISO_RESTAURAR);
  }

  private async consultarUno(documentoId: string, quienActua: UsuarioAutenticado): Promise<DocumentoDeLista> {
    return this.aDocumento(await this.cargar(this.prisma, documentoId, quienActua), quienActua);
  }

  /**
   * Trae un documento y revisa el acceso al expediente. Si esta dado de baja
   * y quien pregunta no puede verlo, responde 404 (para el no existe).
   */
  private async cargar(cliente: Cliente, documentoId: string, quienActua: UsuarioAutenticado): Promise<Fila> {
    const fila = await cliente.documento.findUnique({ where: { id: documentoId }, select: SELECCION });
    if (!fila) throw this.noEncontrado();
    this.expedientes.revisarAcceso(fila.funcionarioId, quienActua);
    if (!fila.vigente && !this.puedeVerBajas(quienActua)) throw this.noEncontrado();
    return fila;
  }

  /**
   * Intentos denegados (pedido de Josthyn, 30/09): si alguien intenta algo
   * que el sistema le niega (expediente ajeno, documento que no puede
   * editar o dar de baja) queda en la bitacora. Se anota FUERA de la
   * transaccion de la operacion para que no se deshaga con ella. Los
   * "no existe" (404) no se anotan: no hay nada que proteger y llenarian
   * la bitacora de ruido. Si anotar falla, se deja el error original.
   */
  private static readonly CODIGOS_DENEGADOS = new Set(['EXPEDIENTE_AJENO', 'DOCUMENTO_NO_EDITABLE', 'BAJA_NO_PERMITIDA']);

  private async vigilando<T>(
    contexto: { funcionarioId?: string; documentoId?: string; intento: string; accion?: 'consultar' | 'descargar' | 'crear' | 'modificar' | 'eliminar' },
    quienActua: UsuarioAutenticado,
    direccionIp: string | undefined,
    operacion: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      await this.anotarDenegado(error, contexto, quienActua, direccionIp);
      throw error;
    }
  }

  private async anotarDenegado(
    error: unknown,
    contexto: { funcionarioId?: string; documentoId?: string; intento: string; accion?: 'consultar' | 'descargar' | 'crear' | 'modificar' | 'eliminar' },
    quienActua: UsuarioAutenticado,
    direccionIp: string | undefined,
  ): Promise<void> {
    if (!(error instanceof HttpException)) return;
    const respuesta = error.getResponse() as { codigo?: string };
    const codigo = respuesta?.codigo;
    if (!codigo || !DocumentosService.CODIGOS_DENEGADOS.has(codigo)) return;
    try {
      let funcionarioId = contexto.funcionarioId;
      let titulo: string | undefined;
      if (contexto.documentoId) {
        const d = await this.prisma.documento.findUnique({ where: { id: contexto.documentoId }, select: { funcionarioId: true, titulo: true } });
        funcionarioId = d?.funcionarioId;
        titulo = d?.titulo;
      }
      const nombre = funcionarioId ? await this.nombreDelDuenio(funcionarioId) : 'otra persona';
      const donde = funcionarioId === quienActua.funcionarioId ? 'de su expediente' : `del expediente de ${nombre}`;
      await this.bitacora.registrar({
        usuarioId: quienActua.id,
        entidad: contexto.documentoId ? 'documento' : 'expediente',
        registroAfectadoId: contexto.documentoId ?? funcionarioId ?? quienActua.id,
        funcionarioAfectadoId: funcionarioId,
        accion: contexto.accion ?? 'consultar',
        direccionIp,
        datosNuevos: { denegado: true, motivo: codigo },
        descripcion: `Intento denegado: quiso ${contexto.intento}${titulo ? ` «${titulo}»` : ''} ${donde}.`,
      });
    } catch (falla) {
      this.registro.error(`No se pudo anotar un intento denegado en la bitacora: ${falla instanceof Error ? falla.message : 'error desconocido'}`);
    }
  }

  private noEncontrado(): NotFoundException {
    return new NotFoundException({ codigo: 'DOCUMENTO_NO_ENCONTRADO', message: 'No se encontró el documento indicado.' });
  }

  private async verificarFuncionario(cliente: Cliente, funcionarioId: string): Promise<void> {
    const existe = await cliente.funcionario.findUnique({ where: { id: funcionarioId }, select: { id: true } });
    if (!existe) {
      throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    }
  }

  private async nombreDelDuenio(funcionarioId: string): Promise<string> {
    const f = await this.prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { nombre: true, primerApellido: true, segundoApellido: true },
    });
    return f ? [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ') : 'el funcionario';
  }

  /** Un tipo que se puede elegir al subir o editar: existe, activo y manual (no generado por SINERGIA). */
  private async cargarTipoManual(tipoId: string, cliente: Cliente = this.prisma) {
    const tipo = await cliente.tipoDocumento.findUnique({
      where: { id: tipoId },
      select: { id: true, nombre: true, activo: true, generadoPorSistema: true, formatosPermitidos: true },
    });
    if (!tipo) {
      throw new BadRequestException({ codigo: 'TIPO_DOCUMENTO_INVALIDO', message: 'El tipo de documento indicado no existe.' });
    }
    if (tipo.generadoPorSistema) {
      throw new BadRequestException({
        codigo: 'TIPO_GENERADO_POR_SISTEMA',
        message: `El tipo «${tipo.nombre}» lo genera SINERGIA automáticamente: no se sube a mano.`,
      });
    }
    if (!tipo.activo) {
      throw new BadRequestException({ codigo: 'TIPO_DOCUMENTO_INACTIVO', message: `El tipo «${tipo.nombre}» está inactivo.` });
    }
    return tipo;
  }

  /** Fecha del documento: AAAA-MM-DD real, desde 1950 y no futura. */
  private leerFechaDelDocumento(texto: string | undefined): Date | null {
    if (!texto) return null;
    const fecha = interpretarFechaSola(texto, 'del documento');
    if (fecha > hoyEnCostaRica() || fecha.getUTCFullYear() < 1950) {
      throw new BadRequestException({
        codigo: 'FECHA_NO_VALIDA',
        message: 'La fecha del documento no puede ser futura ni anterior a 1950.',
      });
    }
    return fecha;
  }

  private formatoDe(mime: string): Formato {
    return (Object.keys(FORMATOS) as Formato[]).find((f) => FORMATOS[f].mime === mime) ?? 'pdf';
  }

  /**
   * Que puede hacer quien consulta con este documento, y por que no cuando
   * no puede (la pantalla muestra el motivo en el boton bloqueado).
   */
  private calcularAcciones(fila: Fila, quienActua: UsuarioAutenticado): DocumentoDeLista['acciones'] {
    const tiene = (permiso: string) => quienActua.permisos.includes(permiso);
    const esDuenio = fila.funcionarioId === quienActua.funcionarioId;
    const loSubioQuienConsulta = fila.usuarioRegistroId === quienActua.id;
    const loPuedeTocarComoPropio = esDuenio && loSubioQuienConsulta && !fila.generadoPorSistema;

    let motivoSinEditar: string | null = null;
    if (fila.generadoPorSistema) motivoSinEditar = 'Lo generó SINERGIA: solo se puede ver.';
    else if (!fila.vigente) motivoSinEditar = 'Está dado de baja: primero hay que restaurarlo.';
    else if (!(tiene(PERMISO_EDITAR) || (tiene(PERMISO_EDITAR_PROPIO) && loPuedeTocarComoPropio))) {
      motivoSinEditar = esDuenio
        ? 'Lo subió otra persona (por ejemplo Recursos Humanos): usted solo puede cambiar lo que subió usted.'
        : 'No tiene permiso para editar documentos.';
    }

    let motivoSinBaja: string | null = null;
    if (!fila.vigente) motivoSinBaja = 'Ya está dado de baja.';
    else if (!(tiene(PERMISO_BAJA) || (tiene(PERMISO_BAJA_PROPIO) && loPuedeTocarComoPropio))) {
      motivoSinBaja = fila.generadoPorSistema
        ? 'Lo generó SINERGIA: solo Recursos Humanos puede darlo de baja.'
        : esDuenio
          ? 'Lo subió otra persona (por ejemplo Recursos Humanos): usted solo puede dar de baja lo que subió usted.'
          : 'No tiene permiso para dar de baja documentos.';
    }

    let motivoSinRestaurar: string | null = null;
    if (fila.vigente) motivoSinRestaurar = 'El documento está vigente.';
    else if (!tiene(PERMISO_RESTAURAR)) motivoSinRestaurar = 'Solo Recursos Humanos puede restaurar documentos.';

    return {
      puedeEditar: motivoSinEditar === null,
      motivoSinEditar,
      puedeDarDeBaja: motivoSinBaja === null,
      motivoSinBaja,
      puedeRestaurar: motivoSinRestaurar === null,
      motivoSinRestaurar,
    };
  }

  private aDocumento(fila: Fila, quienActua: UsuarioAutenticado): DocumentoDeLista {
    const duenioUsuarioId = fila.funcionario.usuario?.id ?? null;
    const verBajas = this.puedeVerBajas(quienActua);
    return {
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      tipo: fila.tipoDocumento,
      nombreArchivo: fila.nombreArchivo,
      formato: this.formatoDe(fila.tipoMime),
      tamanoBytes: fila.tamanoBytes,
      fechaDocumento: aFechaSola(fila.fechaDocumento),
      fechaRegistro: fila.fechaRegistro.toISOString(),
      generadoPorSistema: fila.generadoPorSistema,
      subidoPor: fila.usuarioRegistro ? quien(fila.usuarioRegistro) : null,
      subidoPorElFuncionario: duenioUsuarioId !== null && fila.usuarioRegistroId === duenioUsuarioId,
      vigente: fila.vigente,
      baja:
        !fila.vigente && verBajas
          ? {
              fecha: fila.fechaBaja ? fila.fechaBaja.toISOString() : null,
              motivo: fila.motivoBaja,
              quien: fila.usuarioBaja ? quien(fila.usuarioBaja) : null,
              porElFuncionario: duenioUsuarioId !== null && fila.usuarioBajaId === duenioUsuarioId,
            }
          : null,
      acciones: this.calcularAcciones(fila, quienActua),
    };
  }
}

/** Nombre de quien hizo algo, o su correo si es la cuenta tecnica. */
function quien(usuario: { correo: string; funcionario: { nombre: string; primerApellido: string; segundoApellido: string | null } | null }): string {
  const f = usuario.funcionario;
  return f ? [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ') : usuario.correo;
}
