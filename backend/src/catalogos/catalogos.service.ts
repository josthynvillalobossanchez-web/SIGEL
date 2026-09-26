import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CrearElementoDto, EditarElementoDto } from './dto/elemento-de-catalogo.dto.js';
import { TIPOS_DE_CATALOGO, type TipoDeCatalogo } from './tipos-de-catalogo.js';

/** Un elemento de catalogo tal como lo devuelve la API. */
export interface ElementoDeCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** Funcionarios ACTIVOS que lo tienen asignado hoy. */
  cantidadFuncionarios: number;
}

/** Los tres catalogos juntos (GET /api/catalogos). */
export type CatalogosCompletos = Record<TipoDeCatalogo, ElementoDeCatalogo[]>;

/** Fila de cualquiera de los tres modelos (tienen la misma forma). */
interface FilaDeCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

/**
 * Lo poco que se usa de los delegados de Prisma (tx.departamento,
 * tx.puesto, tx.profesion). Los tres modelos son iguales, pero Prisma los
 * tipa como tipos distintos y TypeScript no deja llamarlos "en comun"; por
 * eso se describe aqui la parte que se usa y se hace un solo casteo en
 * delegado(). Si algun dia los modelos dejan de ser iguales, esto hay que
 * revisarlo.
 */
interface DelegadoDeCatalogo {
  findMany(args: unknown): Promise<(FilaDeCatalogo & { _count: { funcionarios: number } })[]>;
  findUnique(args: unknown): Promise<(FilaDeCatalogo & { _count: { funcionarios: number } }) | null>;
  findFirst(args: unknown): Promise<{ nombre: string } | null>;
  create(args: unknown): Promise<FilaDeCatalogo>;
  update(args: unknown): Promise<FilaDeCatalogo>;
}

type Cliente = Prisma.TransactionClient | PrismaService;

function delegado(cliente: Cliente, tipo: TipoDeCatalogo): DelegadoDeCatalogo {
  return cliente[TIPOS_DE_CATALOGO[tipo].modelo] as unknown as DelegadoDeCatalogo;
}

/** Lo que se pide de cada fila: sus datos y cuantos funcionarios activos la usan. */
const SELECCION = {
  id: true,
  nombre: true,
  descripcion: true,
  activo: true,
  _count: { select: { funcionarios: { where: { estado: 'activo' } } } },
} as const;

function aElemento(fila: FilaDeCatalogo & { _count: { funcionarios: number } }): ElementoDeCatalogo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    activo: fila.activo,
    cantidadFuncionarios: fila._count.funcionarios,
  };
}

/**
 * Catalogos de la Municipalidad: departamentos, puestos y profesiones.
 *
 * Decisiones:
 *   - Consultar solo pide tener sesion: los formularios de funcionarios y
 *     "Mi cuenta" necesitan las listas, y son nombres sin datos personales.
 *     Crear, editar y activar/inactivar piden "catalogos.editar".
 *   - Los nombres no se repiten sin importar mayusculas ni tildes (la
 *     intercalacion de la base, utf8mb4_unicode_ci, ya los compara asi).
 *   - No se borra nada: se INACTIVA. Un elemento inactivo no se puede
 *     elegir para funcionarios nuevos, pero quienes ya lo tienen lo
 *     conservan hasta que RRHH les asigne otro (por ejemplo, un departamento
 *     que se cierra). Borrar romperia el expediente y el historial.
 *   - A diferencia de los roles, SI se puede inactivar un elemento en uso:
 *     un rol da acceso y quitarlo en silencio dejaria a alguien sin poder
 *     trabajar; un departamento inactivo no le quita nada a nadie.
 *   - Cada cambio queda en la bitacora (entidad = departamento, puesto o
 *     profesion).
 */
@Injectable()
export class CatalogosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Un catalogo, ordenado por nombre. Con soloActivos, sin los inactivos. */
  async consultar(tipo: TipoDeCatalogo, soloActivos = false): Promise<ElementoDeCatalogo[]> {
    const filas = await delegado(this.prisma, tipo).findMany({
      where: soloActivos ? { activo: true } : undefined,
      select: SELECCION,
      orderBy: { nombre: 'asc' },
    });
    return filas.map(aElemento);
  }

  /** Los tres catalogos de una vez (para la pantalla y los formularios). */
  async consultarTodos(soloActivos = false): Promise<CatalogosCompletos> {
    const [departamentos, puestos, profesiones] = await Promise.all([
      this.consultar('departamentos', soloActivos),
      this.consultar('puestos', soloActivos),
      this.consultar('profesiones', soloActivos),
    ]);
    return { departamentos, puestos, profesiones };
  }

  async crear(
    tipo: TipoDeCatalogo,
    datos: CrearElementoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ElementoDeCatalogo> {
    const info = TIPOS_DE_CATALOGO[tipo];
    this.revisarLargo(tipo, datos.nombre);
    const descripcion = datos.descripcion || null;

    const creado = await this.prisma.$transaction(async (tx) => {
      await this.verificarNombreLibre(tx, tipo, datos.nombre);
      const fila = await delegado(tx, tipo).create({
        data: { nombre: datos.nombre, descripcion },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: info.modelo,
          registroAfectadoId: fila.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: { nombre: fila.nombre, descripcion },
          descripcion: `Creó ${info.un} ${info.singular} "${fila.nombre}".`,
        },
        tx,
      );
      return fila;
    });

    return this.consultarUno(tipo, creado.id);
  }

  async editar(
    tipo: TipoDeCatalogo,
    id: string,
    datos: EditarElementoDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ElementoDeCatalogo> {
    const info = TIPOS_DE_CATALOGO[tipo];
    if (datos.nombre === undefined && datos.descripcion === undefined) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        message: 'Indique el nombre o la descripción que quiere cambiar.',
      });
    }
    if (datos.nombre !== undefined) this.revisarLargo(tipo, datos.nombre);

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, tipo, id);
      const nombreNuevo = datos.nombre ?? actual.nombre;
      const descripcionNueva = datos.descripcion === undefined ? actual.descripcion : datos.descripcion || null;

      if (nombreNuevo === actual.nombre && descripcionNueva === actual.descripcion) {
        throw new BadRequestException({
          codigo: 'SIN_CAMBIOS',
          message: `${mayuscula(info.el)} ${info.singular} ya tiene ese nombre y esa descripción.`,
        });
      }
      // Se excluye el propio registro: corregir solo mayusculas o tildes
      // ("recursos humanos" -> "Recursos Humanos") no debe chocar consigo mismo.
      if (nombreNuevo !== actual.nombre) await this.verificarNombreLibre(tx, tipo, nombreNuevo, id);

      await delegado(tx, tipo).update({ where: { id }, data: { nombre: nombreNuevo, descripcion: descripcionNueva } });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: info.modelo,
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { nombre: actual.nombre, descripcion: actual.descripcion },
          datosNuevos: { nombre: nombreNuevo, descripcion: descripcionNueva },
          descripcion:
            nombreNuevo === actual.nombre
              ? `Cambió la descripción ${info.del} ${info.singular} "${actual.nombre}".`
              : `Renombró ${info.el} ${info.singular} "${actual.nombre}" a "${nombreNuevo}".`,
        },
        tx,
      );
    });

    return this.consultarUno(tipo, id);
  }

  /**
   * Activa o inactiva. Si se inactiva uno en uso, los funcionarios que lo
   * tienen lo conservan; la respuesta trae cantidadFuncionarios para que la
   * pantalla lo diga.
   */
  async cambiarEstado(
    tipo: TipoDeCatalogo,
    id: string,
    activo: boolean,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<ElementoDeCatalogo> {
    const info = TIPOS_DE_CATALOGO[tipo];
    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, tipo, id);
      if (actual.activo === activo) {
        throw new BadRequestException({
          codigo: 'ESTADO_SIN_CAMBIO',
          message: `${mayuscula(info.el)} ${info.singular} "${actual.nombre}" ya está ${activo ? 'activ' : 'inactiv'}${info.o}.`,
        });
      }
      await delegado(tx, tipo).update({ where: { id }, data: { activo } });
      const enUso = actual._count.funcionarios;
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: info.modelo,
          registroAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { activo: actual.activo },
          datosNuevos: { activo, funcionariosActivosQueLoTienen: enUso },
          descripcion:
            `${activo ? 'Activó' : 'Inactivó'} ${info.el} ${info.singular} "${actual.nombre}"` +
            (!activo && enUso > 0 ? ` (${enUso} funcionario(s) activo(s) lo conservan).` : '.'),
        },
        tx,
      );
    });
    return this.consultarUno(tipo, id);
  }

  /* ------------------------------------------------------------------ */

  private async consultarUno(tipo: TipoDeCatalogo, id: string): Promise<ElementoDeCatalogo> {
    return aElemento(await this.cargar(this.prisma, tipo, id));
  }

  /** Trae el elemento o responde 404 con el codigo del sistema. */
  private async cargar(cliente: Cliente, tipo: TipoDeCatalogo, id: string) {
    const fila = await delegado(cliente, tipo).findUnique({ where: { id }, select: SELECCION });
    if (!fila) {
      const info = TIPOS_DE_CATALOGO[tipo];
      throw new NotFoundException({
        codigo: 'ELEMENTO_NO_ENCONTRADO',
        message: `No se encontró ${info.el} ${info.singular} indicad${info.o}.`,
      });
    }
    return fila;
  }

  /** El largo maximo depende del catalogo (lo pone la columna de la base). */
  private revisarLargo(tipo: TipoDeCatalogo, nombre: string): void {
    const { largoMaximo } = TIPOS_DE_CATALOGO[tipo];
    if (nombre.length > largoMaximo) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        message: `El nombre no puede pasar de ${largoMaximo} caracteres.`,
      });
    }
  }

  /** NOMBRE_DUPLICADO si ya hay otro con ese nombre (sin importar mayusculas ni tildes). */
  private async verificarNombreLibre(tx: Cliente, tipo: TipoDeCatalogo, nombre: string, exceptoId?: string): Promise<void> {
    const existe = await delegado(tx, tipo).findFirst({
      where: { nombre, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
      select: { nombre: true },
    });
    if (existe) {
      const info = TIPOS_DE_CATALOGO[tipo];
      throw new ConflictException({
        codigo: 'NOMBRE_DUPLICADO',
        message: `Ya existe ${info.un} ${info.singular} ${info.llamado} "${existe.nombre}".`,
      });
    }
  }
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
