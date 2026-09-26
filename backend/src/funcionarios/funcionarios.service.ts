import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolverAcceso, soloVigentes } from '../autenticacion/permisos-efectivos.js';
import { permisosQueFaltan } from '../autenticacion/reparto-de-acceso.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { aFechaSola, hoyEnCostaRica, interpretarFechaSola, sumarAnios } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsuariosService, type CuentaCreada } from '../usuarios/usuarios.service.js';
import { normalizarCedula } from './cedula.js';
import type { ConsultarFuncionariosDto } from './dto/consultar-funcionarios.dto.js';
import type {
  EditarFuncionarioDto,
  RegistrarFuncionarioDto,
  RegistrarSalidaDto,
  ReingresoDto,
  TipoDeNombramiento,
} from './dto/datos-de-funcionario.dto.js';

/* ================================================================== */
/* Constantes y tipos                                                  */
/* ================================================================== */

/** Edad minima para trabajar (Codigo de Trabajo de Costa Rica). */
const EDAD_MINIMA = 15;

/**
 * Permiso que hace a alguien JEFATURA posible: quien aprueba solicitudes.
 * En el catalogo sembrado lo tienen el rol Aprobador (las jefaturas),
 * Administrador (Recursos Humanos: su jefatura tambien es jefatura de su
 * equipo, y lo necesita para poder asignar el rol Aprobador) y el Super
 * Administrador (tiene todo). Tambien se puede dar como permiso individual. Se decide por permiso y no por el nombre
 * del rol, para que un rol nuevo con este permiso tambien cuente.
 */
export const PERMISO_PARA_APROBAR = 'solicitudes.aprobar';

/** Como se nombra cada tipo de nombramiento en pantalla y en la bitacora. */
export const NOMBRES_DE_NOMBRAMIENTO: Record<TipoDeNombramiento, string> = {
  propiedad: 'En propiedad',
  interino: 'Interino',
  contratacionServicios: 'Contratación por servicios',
};

/** Etiquetas de cada campo, para la bitacora y el historial laboral. */
const ETIQUETAS: Record<string, string> = {
  nombre: 'nombre',
  primerApellido: 'primer apellido',
  segundoApellido: 'segundo apellido',
  fechaNacimiento: 'fecha de nacimiento',
  profesion: 'profesión',
  correoPersonal: 'correo personal',
  correoInstitucional: 'correo institucional',
  telefonoPersonal: 'teléfono',
  direccion: 'dirección',
  puesto: 'puesto',
  departamento: 'departamento',
  jefatura: 'jefatura',
  tipoNombramiento: 'tipo de nombramiento',
  regimenVacaciones: 'régimen de vacaciones',
  fechaIngreso: 'fecha de ingreso',
  numeroEmpleado: 'código de empleado',
};

/** Una referencia a catalogo tal como se devuelve: id y nombre. */
interface Referencia {
  id: string;
  nombre: string;
}

/** Una fila de la lista de funcionarios. */
export interface FuncionarioEnLista {
  id: string;
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  correoInstitucional: string | null;
  correoPersonal: string;
  puesto: Referencia | null;
  departamento: Referencia | null;
  estado: 'activo' | 'inactivo';
  tieneCuenta: boolean;
  /** Es el funcionario de quien consulta (no puede editarse a si mismo aqui). */
  esPropio: boolean;
}

/** Ficha completa (ventana "Ver funcionario" y pagina "Editar funcionario"). */
export interface DetalleDeFuncionario extends FuncionarioEnLista {
  fechaNacimiento: string | null;
  profesion: Referencia | null;
  telefonoPersonal: string | null;
  direccion: string | null;
  jefatura: Referencia | null;
  tipoNombramiento: TipoDeNombramiento;
  regimenVacaciones: Referencia & { descripcion: string | null };
  fechaIngreso: string;
  fechaSalida: string | null;
  motivoSalida: string | null;
  numeroEmpleado: string | null;
  /** Funcionarios ACTIVOS que tienen a esta persona como jefatura. */
  cantidadACargo: number;
  cuenta: { id: string; correo: string; estado: 'activo' | 'inactivo' | 'bloqueado' } | null;
  fechaRegistro: string;
}

/** Listas para los formularios de registrar y editar. */
export interface OpcionesDeFormulario {
  departamentos: Referencia[];
  puestos: Referencia[];
  profesiones: Referencia[];
  regimenes: (Referencia & { descripcion: string | null })[];
  /** Funcionarios activos que pueden ser jefatura. */
  jefaturas: (Referencia & { puesto: string | null })[];
  tiposNombramiento: { valor: TipoDeNombramiento; texto: string }[];
}

/** Lo que se pide de un funcionario para armar su ficha. */
const SELECCION_DETALLE = {
  id: true,
  cedula: true,
  nombre: true,
  primerApellido: true,
  segundoApellido: true,
  fechaNacimiento: true,
  correoInstitucional: true,
  correoPersonal: true,
  telefonoPersonal: true,
  direccion: true,
  tipoNombramiento: true,
  estado: true,
  fechaIngreso: true,
  fechaSalida: true,
  motivoSalida: true,
  numeroEmpleado: true,
  fechaRegistro: true,
  profesion: { select: { id: true, nombre: true } },
  puesto: { select: { id: true, nombre: true } },
  departamento: { select: { id: true, nombre: true } },
  jefatura: { select: { id: true, nombre: true, primerApellido: true, segundoApellido: true } },
  regimenVacaciones: { select: { id: true, nombre: true, descripcion: true } },
  usuario: { select: { id: true, correo: true, estado: true } },
  _count: { select: { personalACargo: { where: { estado: 'activo' } } } },
} as const;

type FilaDeDetalle = Prisma.funcionarioGetPayload<{ select: typeof SELECCION_DETALLE }>;

function nombreCompleto(f: { nombre: string; primerApellido: string; segundoApellido: string | null }): string {
  return [f.nombre, f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');
}

/* ================================================================== */

/**
 * Funcionarios de la Municipalidad (la persona; la cuenta de acceso vive en
 * el modulo de usuarios).
 *
 * Decisiones que aplica (ver docs/CONTEXTO_SIGEL.md):
 *   - Consultar pide funcionarios.ver; registrar, funcionarios.crear;
 *     editar, registrar salida y reingreso, funcionarios.editar.
 *   - "Crear tambien su cuenta": funcionario y cuenta en la MISMA
 *     transaccion (reutiliza UsuariosService.crearCuentaEnTransaccion). El
 *     correo de ingreso es el institucional; sin el, no se crea la cuenta
 *     aqui (se puede despues desde Usuarios con otro correo). Pide ademas
 *     usuarios.crear y aplica las reglas de reparto de acceso a los roles.
 *   - La cedula es el identificador permanente: se normaliza (ver cedula.ts),
 *     no se repite y no se edita.
 *   - Nadie edita su propio registro ni registra su propia salida desde
 *     aqui (FUNCIONARIO_PROPIO): los datos personales propios se cambian en
 *     "Mi cuenta" y los laborales los cambia otra persona de RRHH.
 *   - La jefatura debe ser un funcionario activo, distinto de la persona y
 *     sin ciclos (A jefe de B y B jefe de A). Sin jefatura = tope de la
 *     jerarquia (se autoaprueba).
 *   - Solo se eligen departamentos, puestos, profesiones y regimenes
 *     ACTIVOS; si la persona ya tenia uno que despues se inactivo, lo
 *     conserva mientras no se cambie.
 *   - No se borra: se registra la SALIDA (queda inactivo con fecha y
 *     motivo) y su cuenta, si tiene, se inactiva en la misma transaccion.
 *     Si vuelve, se registra el REINGRESO (la cuenta se reactiva aparte,
 *     desde Usuarios, a proposito: que alguien decida su acceso de nuevo).
 *   - Cada cambio queda en la bitacora con el valor anterior y el nuevo, en
 *     texto legible (nombre del puesto, no su id): de ahi sale el historial
 *     laboral del expediente.
 */
@Injectable()
export class FuncionariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly usuarios: UsuariosService,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Consultas                                                         */
  /* ---------------------------------------------------------------- */

  async consultar(filtros: ConsultarFuncionariosDto, quienActua: UsuarioAutenticado): Promise<PaginaDeResultados<FuncionarioEnLista>> {
    const { pagina, tamano } = filtros;
    // Cada palabra tiene que aparecer en algun campo ("ana vargas").
    const palabras = (filtros.busqueda ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
    const donde: Prisma.funcionarioWhereInput = {
      estado: filtros.estado,
      departamentoId: filtros.departamentoId,
      AND: palabras.map((palabra) => ({
        OR: [
          { cedula: { contains: palabra } },
          { nombre: { contains: palabra } },
          { primerApellido: { contains: palabra } },
          { segundoApellido: { contains: palabra } },
          { correoInstitucional: { contains: palabra } },
          { correoPersonal: { contains: palabra } },
        ],
      })),
    };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.funcionario.count({ where: donde }),
      this.prisma.funcionario.findMany({
        where: donde,
        orderBy: [{ primerApellido: 'asc' }, { segundoApellido: 'asc' }, { nombre: 'asc' }],
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: {
          id: true,
          cedula: true,
          nombre: true,
          primerApellido: true,
          segundoApellido: true,
          correoInstitucional: true,
          correoPersonal: true,
          estado: true,
          puesto: { select: { id: true, nombre: true } },
          departamento: { select: { id: true, nombre: true } },
          usuario: { select: { id: true } },
        },
      }),
    ]);

    return armarPagina(
      filas.map(({ usuario, ...f }) => ({ ...f, tieneCuenta: usuario !== null, esPropio: f.id === quienActua.funcionarioId })),
      total,
      pagina,
      tamano,
    );
  }

  async consultarUno(id: string, quienActua: UsuarioAutenticado): Promise<DetalleDeFuncionario> {
    return this.aDetalle(await this.cargar(this.prisma, id), quienActua);
  }

  /** Listas para los formularios: solo lo ACTIVO. */
  async opcionesDeFormulario(): Promise<OpcionesDeFormulario> {
    const soloActivos = { where: { activo: true }, orderBy: { nombre: 'asc' as const }, select: { id: true, nombre: true } };
    const [departamentos, puestos, profesiones, regimenes, jefaturas] = await Promise.all([
      this.prisma.departamento.findMany(soloActivos),
      this.prisma.puesto.findMany(soloActivos),
      this.prisma.profesion.findMany(soloActivos),
      this.prisma.regimenVacaciones.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, descripcion: true } }),
      this.prisma.funcionario.findMany({
        where: { estado: 'activo', id: { in: [...(await this.idsQueAprueban(this.prisma))] } },
        orderBy: [{ primerApellido: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, primerApellido: true, segundoApellido: true, puesto: { select: { nombre: true } } },
      }),
    ]);
    return {
      departamentos,
      puestos,
      profesiones,
      regimenes,
      // Solo quien puede aprobar solicitudes (ver PERMISO_PARA_APROBAR).
      jefaturas: jefaturas.map((j) => ({ id: j.id, nombre: nombreCompleto(j), puesto: j.puesto?.nombre ?? null })),
      tiposNombramiento: Object.entries(NOMBRES_DE_NOMBRAMIENTO).map(([valor, texto]) => ({ valor: valor as TipoDeNombramiento, texto })),
    };
  }

  /* ---------------------------------------------------------------- */
  /* Registrar                                                         */
  /* ---------------------------------------------------------------- */

  async registrar(
    datos: RegistrarFuncionarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<{ funcionario: DetalleDeFuncionario; cuenta: CuentaCreada | null }> {
    const cedula = normalizarCedula(datos.cedula);
    if (cedula.length < 5 || cedula.length > 20) {
      throw new BadRequestException({ codigo: 'DATOS_INVALIDOS', message: 'La cédula debe tener entre 5 y 20 caracteres.' });
    }

    // La cuenta se revisa ANTES de escribir nada.
    if (datos.cuenta) {
      if (!quienActua.permisos.includes('usuarios.crear')) {
        throw new ForbiddenException({
          codigo: 'SIN_PERMISO',
          message: 'Su cuenta no tiene permiso para crear cuentas de usuario. Registre al funcionario sin cuenta.',
        });
      }
      if (!datos.correoInstitucional) {
        throw new BadRequestException({
          codigo: 'CUENTA_SIN_CORREO_INSTITUCIONAL',
          message:
            'Para crear la cuenta aquí hace falta el correo institucional (es el correo de ingreso). ' +
            'Regístrelo sin cuenta y créela después desde Usuarios con otro correo.',
        });
      }
    }

    const nacimiento = datos.fechaNacimiento ? interpretarFechaSola(datos.fechaNacimiento, 'de nacimiento') : null;
    const ingreso = interpretarFechaSola(datos.fechaIngreso, 'de ingreso');
    this.revisarFechas(nacimiento, ingreso);

    const resultado = await this.prisma.$transaction(async (tx) => {
      await this.verificarUnicos(tx, { cedula, correoInstitucional: datos.correoInstitucional, numeroEmpleado: datos.numeroEmpleado });
      const refs = await this.validarReferencias(tx, {
        profesionId: datos.profesionId ?? null,
        puestoId: datos.puestoId,
        departamentoId: datos.departamentoId,
        regimenVacacionesId: datos.regimenVacacionesId,
      });
      const jefatura = datos.jefaturaId ? await this.validarJefatura(tx, null, datos.jefaturaId) : null;

      const creado = await tx.funcionario.create({
        data: {
          cedula,
          nombre: datos.nombre,
          primerApellido: datos.primerApellido,
          segundoApellido: datos.segundoApellido ?? null,
          fechaNacimiento: nacimiento,
          profesionId: datos.profesionId ?? null,
          correoPersonal: datos.correoPersonal,
          correoInstitucional: datos.correoInstitucional ?? null,
          telefonoPersonal: datos.telefonoPersonal ?? null,
          direccion: datos.direccion ?? null,
          puestoId: datos.puestoId,
          departamentoId: datos.departamentoId,
          jefaturaId: datos.jefaturaId ?? null,
          tipoNombramiento: datos.tipoNombramiento,
          regimenVacacionesId: datos.regimenVacacionesId,
          fechaIngreso: ingreso,
          numeroEmpleado: datos.numeroEmpleado ?? null,
          estado: 'activo',
        },
        select: { id: true, nombre: true, primerApellido: true, segundoApellido: true },
      });

      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'funcionario',
          registroAfectadoId: creado.id,
          funcionarioAfectadoId: creado.id,
          accion: 'crear',
          direccionIp,
          datosNuevos: {
            cedula,
            nombre: nombreCompleto(creado),
            puesto: refs.puesto,
            departamento: refs.departamento,
            jefatura: jefatura?.nombre ?? 'Sin jefatura (tope de la jerarquía)',
            tipoNombramiento: NOMBRES_DE_NOMBRAMIENTO[datos.tipoNombramiento],
            regimenVacaciones: refs.regimenVacaciones,
            fechaIngreso: datos.fechaIngreso,
          },
          descripcion: `Registró a ${nombreCompleto(creado)} (cédula ${cedula}), con ingreso el ${formatear(datos.fechaIngreso)}.`,
        },
        tx,
      );

      const cuenta = datos.cuenta
        ? await this.usuarios.crearCuentaEnTransaccion(tx, { funcionarioId: creado.id, roles: datos.cuenta.roles }, quienActua, direccionIp)
        : null;

      return { id: creado.id, cuenta };
    });

    // El correo de bienvenida va DESPUES de confirmar (ver UsuariosService.crear).
    if (resultado.cuenta) await this.usuarios.enviarBienvenida(resultado.cuenta);

    return { funcionario: await this.consultarUno(resultado.id, quienActua), cuenta: resultado.cuenta };
  }

  /* ---------------------------------------------------------------- */
  /* Editar                                                            */
  /* ---------------------------------------------------------------- */

  async editar(
    id: string,
    datos: EditarFuncionarioDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DetalleDeFuncionario> {
    this.impedirSobreSiMismo(id, quienActua, 'editar sus propios datos desde aquí. Sus datos personales se cambian en "Mi cuenta"; los laborales los cambia otra persona de Recursos Humanos');

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, id);
      const cambios: Prisma.funcionarioUncheckedUpdateInput = {};
      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};

      /** Anota un cambio si el valor nuevo vino y es distinto del actual. */
      const anotar = (campo: string, nuevo: unknown, viejo: unknown, legibleViejo: unknown = viejo, legibleNuevo: unknown = nuevo) => {
        if (nuevo === undefined || nuevo === viejo) return false;
        antes[campo] = legibleViejo ?? null;
        despues[campo] = legibleNuevo ?? null;
        return true;
      };

      // ---- Texto simple ----
      for (const campo of ['nombre', 'primerApellido', 'segundoApellido', 'correoPersonal', 'correoInstitucional', 'telefonoPersonal', 'direccion', 'numeroEmpleado'] as const) {
        // El DTO ya garantiza que los obligatorios (nombre, correo personal...) no llegan en null.
        if (anotar(campo, datos[campo], actual[campo])) (cambios as Record<string, unknown>)[campo] = datos[campo];
      }
      if (anotar('tipoNombramiento', datos.tipoNombramiento, actual.tipoNombramiento, NOMBRES_DE_NOMBRAMIENTO[actual.tipoNombramiento], datos.tipoNombramiento && NOMBRES_DE_NOMBRAMIENTO[datos.tipoNombramiento])) {
        cambios.tipoNombramiento = datos.tipoNombramiento;
      }

      // ---- Fechas ----
      const nacimientoActual = aFechaSola(actual.fechaNacimiento);
      const ingresoActual = aFechaSola(actual.fechaIngreso)!;
      if (anotar('fechaNacimiento', datos.fechaNacimiento, nacimientoActual)) {
        cambios.fechaNacimiento = datos.fechaNacimiento ? interpretarFechaSola(datos.fechaNacimiento, 'de nacimiento') : null;
      }
      if (anotar('fechaIngreso', datos.fechaIngreso, ingresoActual)) {
        cambios.fechaIngreso = interpretarFechaSola(datos.fechaIngreso!, 'de ingreso');
      }
      if ('fechaNacimiento' in cambios || 'fechaIngreso' in cambios) {
        const nacimiento = 'fechaNacimiento' in cambios ? (cambios.fechaNacimiento as Date | null) : actual.fechaNacimiento;
        const ingreso = 'fechaIngreso' in cambios ? (cambios.fechaIngreso as Date) : actual.fechaIngreso;
        this.revisarFechas(nacimiento, ingreso, actual.fechaSalida);
      }

      // ---- Catalogos (solo se validan los que cambian) ----
      const refsNuevas = await this.validarReferencias(tx, {
        profesionId: datos.profesionId !== undefined && datos.profesionId !== (actual.profesion?.id ?? null) ? datos.profesionId : undefined,
        puestoId: datos.puestoId !== undefined && datos.puestoId !== actual.puesto?.id ? datos.puestoId : undefined,
        departamentoId: datos.departamentoId !== undefined && datos.departamentoId !== actual.departamento?.id ? datos.departamentoId : undefined,
        regimenVacacionesId:
          datos.regimenVacacionesId !== undefined && datos.regimenVacacionesId !== actual.regimenVacaciones.id ? datos.regimenVacacionesId : undefined,
      });
      if (refsNuevas.profesion !== undefined) {
        anotar('profesion', datos.profesionId, actual.profesion?.id ?? null, actual.profesion?.nombre ?? null, refsNuevas.profesion);
        cambios.profesionId = datos.profesionId;
      }
      if (refsNuevas.puesto !== undefined) {
        anotar('puesto', datos.puestoId, actual.puesto?.id ?? null, actual.puesto?.nombre ?? null, refsNuevas.puesto);
        cambios.puestoId = datos.puestoId;
      }
      if (refsNuevas.departamento !== undefined) {
        anotar('departamento', datos.departamentoId, actual.departamento?.id ?? null, actual.departamento?.nombre ?? null, refsNuevas.departamento);
        cambios.departamentoId = datos.departamentoId;
      }
      if (refsNuevas.regimenVacaciones !== undefined) {
        anotar('regimenVacaciones', datos.regimenVacacionesId, actual.regimenVacaciones.id, actual.regimenVacaciones.nombre, refsNuevas.regimenVacaciones);
        cambios.regimenVacacionesId = datos.regimenVacacionesId;
      }

      // ---- Jefatura ----
      if (datos.jefaturaId !== undefined && datos.jefaturaId !== (actual.jefatura?.id ?? null)) {
        const jefatura = datos.jefaturaId ? await this.validarJefatura(tx, id, datos.jefaturaId) : null;
        anotar(
          'jefatura',
          datos.jefaturaId,
          actual.jefatura?.id ?? null,
          actual.jefatura ? nombreCompleto(actual.jefatura) : 'Sin jefatura',
          jefatura?.nombre ?? 'Sin jefatura',
        );
        cambios.jefaturaId = datos.jefaturaId;
      }

      if (Object.keys(cambios).length === 0) {
        throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay cambios que guardar: el funcionario ya tiene esos datos.' });
      }

      await this.verificarUnicos(
        tx,
        {
          correoInstitucional: 'correoInstitucional' in cambios ? (cambios.correoInstitucional as string | null) : undefined,
          numeroEmpleado: 'numeroEmpleado' in cambios ? (cambios.numeroEmpleado as string | null) : undefined,
        },
        id,
      );

      await tx.funcionario.update({ where: { id }, data: cambios });

      const lista = Object.keys(despues).map((campo) => ETIQUETAS[campo] ?? campo);
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'funcionario',
          registroAfectadoId: id,
          funcionarioAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: antes,
          datosNuevos: despues,
          descripcion: `Actualizó los datos de ${nombreCompleto(actual)}: ${lista.join(', ')}.`,
        },
        tx,
      );
    });

    return this.consultarUno(id, quienActua);
  }

  /* ---------------------------------------------------------------- */
  /* Salida y reingreso                                                */
  /* ---------------------------------------------------------------- */

  /**
   * La persona deja de trabajar en la Municipalidad: queda inactiva con
   * fecha y motivo, y su cuenta (si tiene) se inactiva en la misma
   * transaccion, para que no quede nadie que ya se fue con acceso.
   */
  async registrarSalida(
    id: string,
    datos: RegistrarSalidaDto,
    quienActua: UsuarioAutenticado,
    direccionIp?: string,
  ): Promise<DetalleDeFuncionario> {
    this.impedirSobreSiMismo(id, quienActua, 'registrar su propia salida. Debe hacerlo otra persona de Recursos Humanos');
    const salida = interpretarFechaSola(datos.fechaSalida, 'de salida');

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, id);
      const nombre = nombreCompleto(actual);
      if (actual.estado !== 'activo') {
        throw new BadRequestException({ codigo: 'FUNCIONARIO_YA_INACTIVO', message: `${nombre} ya está inactivo: su salida ya se registró.` });
      }
      if (salida < actual.fechaIngreso) {
        throw new BadRequestException({
          codigo: 'FECHA_SALIDA_NO_VALIDA',
          message: `La fecha de salida no puede ser anterior a la de ingreso (${formatear(aFechaSola(actual.fechaIngreso)!)}).`,
        });
      }
      if (salida > sumarAnios(hoyEnCostaRica(), 1)) {
        throw new BadRequestException({ codigo: 'FECHA_SALIDA_NO_VALIDA', message: 'La fecha de salida no puede pasar de un año hacia adelante.' });
      }
      if (actual._count.personalACargo > 0) {
        const n = actual._count.personalACargo;
        throw new ConflictException({
          codigo: 'FUNCIONARIO_CON_PERSONAL_A_CARGO',
          message: `${n} funcionario${n === 1 ? ' tiene' : 's tienen'} a ${nombre} como jefatura. Asígneles otra jefatura antes de registrar la salida, para que sus solicitudes no queden sin quien las apruebe.`,
          cantidadACargo: n,
        });
      }

      // La cuenta, si tiene y sigue activa o bloqueada: se inactiva.
      if (actual.usuario && actual.usuario.estado !== 'inactivo') {
        await this.inactivarCuentaPorSalida(tx, actual.usuario.id, nombre, quienActua, direccionIp, id);
      }

      await tx.funcionario.update({
        where: { id },
        data: { estado: 'inactivo', fechaSalida: salida, motivoSalida: datos.motivoSalida },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'funcionario',
          registroAfectadoId: id,
          funcionarioAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { estado: 'activo' },
          datosNuevos: { estado: 'inactivo', fechaSalida: datos.fechaSalida, motivoSalida: datos.motivoSalida },
          descripcion: `Registró la salida de ${nombre} el ${formatear(datos.fechaSalida)}: ${datos.motivoSalida}.`,
        },
        tx,
      );
    });

    return this.consultarUno(id, quienActua);
  }

  /**
   * La persona vuelve a trabajar: queda activa con la nueva fecha de
   * ingreso. Su cuenta NO se reactiva sola: alguien con usuarios.cambiarEstado
   * decide su acceso desde Usuarios.
   */
  async reingreso(id: string, datos: ReingresoDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<DetalleDeFuncionario> {
    this.impedirSobreSiMismo(id, quienActua, 'registrar su propio reingreso');
    const ingreso = interpretarFechaSola(datos.fechaIngreso, 'de reingreso');

    await this.prisma.$transaction(async (tx) => {
      const actual = await this.cargar(tx, id);
      const nombre = nombreCompleto(actual);
      if (actual.estado === 'activo') {
        throw new BadRequestException({ codigo: 'FUNCIONARIO_YA_ACTIVO', message: `${nombre} ya está activo.` });
      }
      if (actual.fechaSalida && ingreso < actual.fechaSalida) {
        throw new BadRequestException({
          codigo: 'FECHA_INGRESO_NO_VALIDA',
          message: `La fecha de reingreso no puede ser anterior a la de salida (${formatear(aFechaSola(actual.fechaSalida)!)}).`,
        });
      }
      this.revisarFechas(actual.fechaNacimiento, ingreso);

      await tx.funcionario.update({
        where: { id },
        data: { estado: 'activo', fechaIngreso: ingreso, fechaSalida: null, motivoSalida: null },
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'funcionario',
          registroAfectadoId: id,
          funcionarioAfectadoId: id,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: {
            estado: 'inactivo',
            fechaIngreso: aFechaSola(actual.fechaIngreso),
            fechaSalida: aFechaSola(actual.fechaSalida),
            motivoSalida: actual.motivoSalida,
          },
          datosNuevos: { estado: 'activo', fechaIngreso: datos.fechaIngreso },
          descripcion: `Registró el reingreso de ${nombre} el ${formatear(datos.fechaIngreso)}.`,
        },
        tx,
      );
    });

    return this.consultarUno(id, quienActua);
  }

  /* ---------------------------------------------------------------- */
  /* Ayudantes                                                         */
  /* ---------------------------------------------------------------- */

  private async cargar(cliente: Prisma.TransactionClient | PrismaService, id: string): Promise<FilaDeDetalle> {
    const fila = await cliente.funcionario.findUnique({ where: { id }, select: SELECCION_DETALLE });
    if (!fila) {
      throw new NotFoundException({ codigo: 'FUNCIONARIO_NO_ENCONTRADO', message: 'No se encontró el funcionario indicado.' });
    }
    return fila;
  }

  private aDetalle(f: FilaDeDetalle, quienActua: UsuarioAutenticado): DetalleDeFuncionario {
    return {
      id: f.id,
      cedula: f.cedula,
      nombre: f.nombre,
      primerApellido: f.primerApellido,
      segundoApellido: f.segundoApellido,
      fechaNacimiento: aFechaSola(f.fechaNacimiento),
      profesion: f.profesion,
      correoInstitucional: f.correoInstitucional,
      correoPersonal: f.correoPersonal,
      telefonoPersonal: f.telefonoPersonal,
      direccion: f.direccion,
      puesto: f.puesto,
      departamento: f.departamento,
      jefatura: f.jefatura ? { id: f.jefatura.id, nombre: nombreCompleto(f.jefatura) } : null,
      tipoNombramiento: f.tipoNombramiento,
      regimenVacaciones: f.regimenVacaciones,
      estado: f.estado,
      fechaIngreso: aFechaSola(f.fechaIngreso)!,
      fechaSalida: aFechaSola(f.fechaSalida),
      motivoSalida: f.motivoSalida,
      numeroEmpleado: f.numeroEmpleado,
      cantidadACargo: f._count.personalACargo,
      cuenta: f.usuario,
      tieneCuenta: f.usuario !== null,
      esPropio: f.id === quienActua.funcionarioId,
      fechaRegistro: f.fechaRegistro.toISOString(),
    };
  }

  /** Nadie edita su propio registro de funcionario desde aqui. */
  private impedirSobreSiMismo(id: string, quienActua: UsuarioAutenticado, que: string): void {
    if (id === quienActua.funcionarioId) {
      throw new ForbiddenException({ codigo: 'FUNCIONARIO_PROPIO', message: `No puede ${que}.` });
    }
  }

  /**
   * Revisa que las fechas tengan sentido:
   *   - nacimiento: al menos 15 anios antes de hoy y despues de 1900;
   *   - ingreso: despues de cumplir 15 anios, desde 1950 y a no mas de un
   *     anio hacia adelante (alguien que empieza el mes que viene);
   *   - si ya salio, el ingreso no puede quedar despues de la salida.
   */
  private revisarFechas(nacimiento: Date | null, ingreso: Date, salida?: Date | null): void {
    const hoy = hoyEnCostaRica();
    if (nacimiento) {
      if (nacimiento < new Date('1900-01-01T00:00:00Z') || nacimiento > sumarAnios(hoy, -EDAD_MINIMA)) {
        throw new BadRequestException({
          codigo: 'FECHA_NACIMIENTO_NO_VALIDA',
          message: `La fecha de nacimiento no es válida: la persona debe tener al menos ${EDAD_MINIMA} años.`,
        });
      }
      if (ingreso < sumarAnios(nacimiento, EDAD_MINIMA)) {
        throw new BadRequestException({
          codigo: 'FECHA_INGRESO_NO_VALIDA',
          message: `La fecha de ingreso no puede ser antes de que la persona cumpliera ${EDAD_MINIMA} años.`,
        });
      }
    }
    if (ingreso < new Date('1950-01-01T00:00:00Z') || ingreso > sumarAnios(hoy, 1)) {
      throw new BadRequestException({
        codigo: 'FECHA_INGRESO_NO_VALIDA',
        message: 'La fecha de ingreso debe estar entre 1950 y un año hacia adelante.',
      });
    }
    if (salida && ingreso > salida) {
      throw new BadRequestException({ codigo: 'FECHA_INGRESO_NO_VALIDA', message: 'La fecha de ingreso no puede quedar después de la de salida.' });
    }
  }

  /** Cedula, correo institucional y codigo de empleado no se repiten. */
  private async verificarUnicos(
    tx: Prisma.TransactionClient,
    valores: { cedula?: string; correoInstitucional?: string | null; numeroEmpleado?: string | null },
    exceptoId?: string,
  ): Promise<void> {
    const otro = exceptoId ? { NOT: { id: exceptoId } } : {};
    if (valores.cedula && (await tx.funcionario.findFirst({ where: { cedula: valores.cedula, ...otro }, select: { id: true } }))) {
      throw new ConflictException({ codigo: 'CEDULA_EN_USO', message: `Ya existe un funcionario con la cédula ${valores.cedula}. No se puede duplicar.` });
    }
    if (
      valores.correoInstitucional &&
      (await tx.funcionario.findFirst({ where: { correoInstitucional: valores.correoInstitucional, ...otro }, select: { id: true } }))
    ) {
      throw new ConflictException({ codigo: 'CORREO_INSTITUCIONAL_EN_USO', message: 'Ese correo institucional ya lo tiene otro funcionario.' });
    }
    if (
      valores.numeroEmpleado &&
      (await tx.funcionario.findFirst({ where: { numeroEmpleado: valores.numeroEmpleado, ...otro }, select: { id: true } }))
    ) {
      throw new ConflictException({ codigo: 'NUMERO_EMPLEADO_EN_USO', message: 'Ese código de empleado ya lo tiene otro funcionario.' });
    }
  }

  /**
   * Revisa que cada catalogo indicado exista y este ACTIVO, y devuelve su
   * nombre (para la bitacora). Lo que no viene (undefined) no se revisa.
   */
  private async validarReferencias(
    tx: Prisma.TransactionClient,
    ids: { profesionId?: string | null; puestoId?: string; departamentoId?: string; regimenVacacionesId?: string },
  ): Promise<{ profesion?: string | null; puesto?: string; departamento?: string; regimenVacaciones?: string }> {
    const salida: { profesion?: string | null; puesto?: string; departamento?: string; regimenVacaciones?: string } = {};
    const buscar = async (
      modelo: 'profesion' | 'puesto' | 'departamento' | 'regimenVacaciones',
      id: string,
      codigo: string,
      texto: string,
    ): Promise<string> => {
      const delegado = tx[modelo] as unknown as {
        findUnique(a: unknown): Promise<{ nombre: string; activo: boolean } | null>;
      };
      const fila = await delegado.findUnique({ where: { id }, select: { nombre: true, activo: true } });
      if (!fila || !fila.activo) throw new BadRequestException({ codigo, message: `${texto} elegido no existe o está inactivo.` });
      return fila.nombre;
    };
    if (ids.profesionId !== undefined) {
      salida.profesion = ids.profesionId ? await buscar('profesion', ids.profesionId, 'PROFESION_NO_VALIDA', 'La profesión') : null;
    }
    if (ids.puestoId !== undefined) salida.puesto = await buscar('puesto', ids.puestoId, 'PUESTO_NO_VALIDO', 'El puesto');
    if (ids.departamentoId !== undefined) salida.departamento = await buscar('departamento', ids.departamentoId, 'DEPARTAMENTO_NO_VALIDO', 'El departamento');
    if (ids.regimenVacacionesId !== undefined) {
      salida.regimenVacaciones = await buscar('regimenVacaciones', ids.regimenVacacionesId, 'REGIMEN_NO_VALIDO', 'El régimen de vacaciones');
    }
    return salida;
  }

  /**
   * La jefatura: un funcionario activo, con cuenta activa que pueda aprobar
   * solicitudes (PERMISO_PARA_APROBAR), que no sea la misma persona y que
   * no cree un ciclo (que la jefatura elegida no dependa, directa o
   * indirectamente, de esta persona).
   */
  private async validarJefatura(tx: Prisma.TransactionClient, funcionarioId: string | null, jefaturaId: string): Promise<{ id: string; nombre: string }> {
    if (jefaturaId === funcionarioId) {
      throw new BadRequestException({ codigo: 'JEFATURA_NO_VALIDA', message: 'Una persona no puede ser su propia jefatura.' });
    }
    const jefatura = await tx.funcionario.findUnique({
      where: { id: jefaturaId },
      select: { id: true, estado: true, nombre: true, primerApellido: true, segundoApellido: true, jefaturaId: true },
    });
    if (!jefatura || jefatura.estado !== 'activo') {
      throw new BadRequestException({ codigo: 'JEFATURA_NO_VALIDA', message: 'La jefatura elegida no existe o ya no trabaja en la Municipalidad.' });
    }
    if (!(await this.idsQueAprueban(tx)).has(jefatura.id)) {
      throw new BadRequestException({
        codigo: 'JEFATURA_NO_VALIDA',
        message: `${nombreCompleto(jefatura)} no puede ser jefatura: su cuenta no tiene permiso para aprobar solicitudes (rol Aprobador).`,
      });
    }
    if (funcionarioId) {
      // Se sube por la cadena de jefaturas desde la elegida; si aparece esta
      // persona, habria un ciclo. Tope de 50 niveles por seguridad.
      let siguiente = jefatura.jefaturaId;
      for (let nivel = 0; siguiente && nivel < 50; nivel++) {
        if (siguiente === funcionarioId) {
          throw new BadRequestException({
            codigo: 'JEFATURA_CICLICA',
            message: `${nombreCompleto(jefatura)} depende (directa o indirectamente) de esta persona: no puede ser su jefatura.`,
          });
        }
        const arriba = await tx.funcionario.findUnique({ where: { id: siguiente }, select: { jefaturaId: true } });
        siguiente = arriba?.jefaturaId ?? null;
      }
    }
    return { id: jefatura.id, nombre: nombreCompleto(jefatura) };
  }

  /**
   * Ids de los funcionarios ACTIVOS cuya cuenta ACTIVA tiene hoy el permiso
   * de aprobar (por un rol vigente o por un permiso individual). Se calcula
   * igual que el guard de sesion (resolverAcceso), asi que una suplencia con
   * fecha cuenta mientras este vigente.
   */
  private async idsQueAprueban(cliente: Prisma.TransactionClient | PrismaService): Promise<Set<string>> {
    const vigente = soloVigentes();
    const cuentas = await cliente.usuario.findMany({
      where: { estado: 'activo', funcionario: { is: { estado: 'activo' } } },
      select: {
        funcionarioId: true,
        roles: {
          where: vigente,
          select: { rol: { select: { nombre: true, activo: true, permisos: { select: { permiso: { select: { clave: true, activo: true } } } } } } },
        },
        permisos: { where: vigente, select: { otorgado: true, permiso: { select: { clave: true, activo: true } } } },
      },
    });
    return new Set(
      cuentas.filter((c) => resolverAcceso(c.roles, c.permisos).permisos.includes(PERMISO_PARA_APROBAR)).map((c) => c.funcionarioId!),
    );
  }

  /**
   * Inactiva la cuenta de alguien que sale. Aplica la regla 3 de reparto de
   * acceso: si la cuenta tiene permisos que quien actua no tiene, NO se
   * registra la salida (la debe registrar alguien con ese acceso, para que
   * la cuenta quede inactiva a la vez y nadie que ya se fue conserve acceso).
   */
  private async inactivarCuentaPorSalida(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    nombre: string,
    quienActua: UsuarioAutenticado,
    direccionIp: string | undefined,
    funcionarioId: string,
  ): Promise<void> {
    const vigente = soloVigentes();
    const cuenta = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: {
        correo: true,
        estado: true,
        roles: {
          where: vigente,
          select: { rol: { select: { nombre: true, activo: true, permisos: { select: { permiso: { select: { clave: true, activo: true } } } } } } },
        },
        permisos: { where: vigente, select: { otorgado: true, permiso: { select: { clave: true, activo: true } } } },
      },
    });
    const { permisos } = resolverAcceso(cuenta.roles, cuenta.permisos);
    if (permisosQueFaltan(quienActua.permisos, permisos).length > 0) {
      throw new ForbiddenException({
        codigo: 'CUENTA_CON_MAYOR_ACCESO',
        message: `${nombre} tiene una cuenta con permisos que usted no tiene. La salida la debe registrar alguien con ese acceso, para que la cuenta se inactive a la vez.`,
      });
    }
    await tx.usuario.update({ where: { id: usuarioId }, data: { estado: 'inactivo', bloqueadoHasta: null, intentosFallidos: 0 } });
    await this.bitacora.registrar(
      {
        usuarioId: quienActua.id,
        entidad: 'usuario',
        registroAfectadoId: usuarioId,
        funcionarioAfectadoId: funcionarioId,
        accion: 'modificar',
        direccionIp,
        datosAnteriores: { estado: cuenta.estado },
        datosNuevos: { estado: 'inactivo', motivo: 'Salida del funcionario' },
        descripcion: `Inactivó la cuenta ${cuenta.correo} por la salida de ${nombre}.`,
      },
      tx,
    );
  }
}

/** "2026-10-31" -> "31/10/2026" (para los textos de la bitacora). */
function formatear(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}`;
}
