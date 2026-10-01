/*
 * Opciones del menu lateral.
 *
 * Cada opcion dice que permisos necesita (TODOS los de la lista, igual que
 * @RequierePermisos en el backend). Si la cuenta no los tiene, la opcion no
 * aparece. Un grupo sin opciones visibles tampoco aparece.
 *
 * Para agregar una pagina nueva:
 *   1. Crear la pagina en src/paginas/...
 *   2. Agregar la ruta en src/App.tsx (con <ConPermisos> si pide permisos).
 *   3. Agregar la opcion aqui con los MISMOS permisos que la ruta.
 * Los codigos de permiso son los de la tabla `permiso` (prisma/seed.ts).
 *
 * Grupos plegables (decision de Josthyn, 01/10): cada titulo (Vacaciones y
 * permisos, Personal, Seguridad...) es un boton que despliega sus opciones.
 * Abierto por omision solo el grupo de la pagina en la que se esta.
 *
 * Subsecciones (clase "nav-sub" del prototipo): toda pagina de crear o
 * editar va como subseccion de su seccion, para que la persona vea donde
 * esta (p. ej. Usuarios -> Editar usuario). Hay dos tipos:
 *   - con "ruta": siempre visibles (si se tienen los permisos), p. ej.
 *     "Crear usuario";
 *   - con "patron": solo aparecen mientras se esta en esa pagina, porque
 *     dependen de a quien se edita (p. ej. /usuarios/<id>/editar).
 */
import type { NombreDeIcono } from '../componentes/Icono';

export interface SubopcionDeMenu {
  texto: string;
  /** Subseccion fija (siempre visible). */
  ruta?: string;
  /** Subseccion de contexto: visible solo si la direccion actual coincide. */
  patron?: RegExp;
  permisos: string[];
}

export interface OpcionDeMenu {
  texto: string;
  ruta: string;
  icono: NombreDeIcono;
  /** Permisos necesarios. Lista vacia = cualquiera con sesion. */
  permisos: string[];
  /** Ademas, al menos UNO de estos (p. ej. la jefatura o RRHH). */
  algunoDe?: string[];
  /** Otras direcciones que cuentan como "esta seccion" (subsecciones fuera de su ruta). */
  tambienEn?: string[];
  /** Texto distinto si a la cuenta le falta un permiso (p. ej. la jefatura ve "Mi personal"). */
  textoSinPermiso?: { permiso: string; texto: string; descripcion?: string };
  /** Solo para cuentas ligadas a un funcionario (no la cuenta tecnica). */
  requiereFuncionario?: boolean;
  /** Texto corto de la tarjeta de acceso directo en Inicio. */
  descripcion?: string;
  subopciones?: SubopcionDeMenu[];
}

export interface GrupoDeMenu {
  titulo: string;
  /** Sin titulo ni boton para plegar (Inicio). */
  sinTitulo?: boolean;
  opciones: OpcionDeMenu[];
}

export const MENU: GrupoDeMenu[] = [
  {
    titulo: 'General',
    sinTitulo: true,
    opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio', permisos: [] }],
  },
  {
    // Lo principal del sistema para toda persona: pedir vacaciones y ver quien esta fuera.
    titulo: 'Vacaciones y permisos',
    opciones: [
      {
        texto: 'Calendario',
        ruta: '/calendario',
        icono: 'calendario',
        permisos: [],
        descripcion: 'Quién está de vacaciones o con permiso: el suyo, el de su equipo o el de todo el personal, según su acceso.',
        subopciones: [{ texto: 'Feriados', ruta: '/calendario/feriados', permisos: ['catalogos.editar'] }],
      },
      {
        texto: 'Mis vacaciones',
        ruta: '/mis-vacaciones',
        icono: 'sombrilla',
        permisos: ['solicitudes.crear'],
        requiereFuncionario: true,
        descripcion: 'Su saldo de días, sus solicitudes y el botón para pedir vacaciones o un permiso.',
        subopciones: [{ texto: 'Nueva solicitud', ruta: '/mis-vacaciones/nueva', permisos: ['solicitudes.crear'] }],
      },
      {
        // Aparte y a la vista (decision 01/10): la jefatura, para su personal; RRHH, para cualquiera.
        texto: 'Solicitud para otra persona',
        ruta: '/registrar-solicitud',
        icono: 'personaMas',
        permisos: [],
        algunoDe: ['solicitudes.administrar', 'solicitudes.aprobar'],
        descripcion: 'Registrar vacaciones o un permiso a nombre de alguien: primero se elige la persona y luego las fechas.',
      },
      {
        texto: 'Bandeja de solicitudes',
        ruta: '/bandeja',
        icono: 'bandeja',
        permisos: ['solicitudes.aprobar'],
        descripcion: 'Las solicitudes de su equipo que le toca aprobar o rechazar.',
      },
      {
        texto: 'Solicitudes del personal',
        ruta: '/solicitudes',
        icono: 'documento',
        permisos: ['solicitudes.administrar'],
        descripcion: 'Todas las solicitudes del personal, con filtros por departamento, tipo y estado.',
      },
    ],
  },
  {
    // Mismo grupo del prototipo ("Personal").
    titulo: 'Personal',
    opciones: [
      {
        texto: 'Funcionarios',
        ruta: '/funcionarios',
        icono: 'personas',
        permisos: ['funcionarios.ver'],
        descripcion: 'Buscar funcionarios, registrarlos por pasos, corregir sus datos, abrir su expediente y registrar salidas o reingresos.',
        // La jefatura (sin verTodos) solo ve a su personal a cargo.
        textoSinPermiso: { permiso: 'funcionarios.verTodos', texto: 'Mi personal', descripcion: 'Las personas a su cargo: sus datos laborales y de contacto.' },
        subopciones: [
          { texto: 'Registrar funcionario', ruta: '/funcionarios/nuevo', permisos: ['funcionarios.crear'] },
          { texto: 'Editar funcionario', patron: /^\/funcionarios\/[^/]+\/editar$/, permisos: ['funcionarios.editar'] },
          { texto: 'Expediente laboral', patron: /^\/funcionarios\/[^/]+\/expediente(\/documentos\/nuevo)?$/, permisos: ['expediente.verTodos'] },
          { texto: 'Subir documento', patron: /^\/funcionarios\/[^/]+\/expediente\/documentos\/nuevo$/, permisos: ['documentos.crear'] },
        ],
      },
    ],
  },
  {
    titulo: 'Seguridad',
    opciones: [
      {
        texto: 'Usuarios',
        ruta: '/usuarios',
        icono: 'usuarios',
        permisos: ['usuarios.ver'],
        descripcion: 'Cuentas de acceso: crear, editar roles y suplencias, permisos individuales y estado.',
        subopciones: [
          { texto: 'Crear usuario', ruta: '/usuarios/nuevo', permisos: ['usuarios.crear'] },
          { texto: 'Editar usuario', patron: /^\/usuarios\/[^/]+\/editar$/, permisos: ['usuarios.editar'] },
          { texto: 'Agregar excepción', patron: /^\/usuarios\/[^/]+\/excepciones\/nueva$/, permisos: ['usuarios.editar'] },
          { texto: 'Editar excepción', patron: /^\/usuarios\/[^/]+\/excepciones\/[^/]+\/editar$/, permisos: ['usuarios.editar'] },
        ],
      },
      {
        texto: 'Roles y permisos',
        ruta: '/roles',
        icono: 'roles',
        permisos: ['usuarios.ver'],
        descripcion: 'Qué permisos da cada rol, roles propios de la Municipalidad y catálogo de permisos.',
        subopciones: [
          { texto: 'Crear rol', ruta: '/roles/nuevo', permisos: ['roles.editar'] },
          { texto: 'Editar rol', patron: /^\/roles\/[^/]+\/editar$/, permisos: ['roles.editar'] },
        ],
      },
    ],
  },
  {
    // Mismo grupo del prototipo (departamentos, puestos, profesiones y tipos de documento).
    titulo: 'Catálogos',
    opciones: [
      {
        texto: 'Catálogos de personal',
        ruta: '/catalogos',
        icono: 'carpeta',
        permisos: ['catalogos.editar'],
        descripcion: 'Departamentos, puestos y profesiones que se eligen al registrar a un funcionario.',
      },
      {
        texto: 'Tipos de documento',
        ruta: '/tipos-documento',
        icono: 'documento',
        permisos: ['tiposDocumento.editar'],
        descripcion: 'Los tipos de documento del expediente y los formatos de archivo que acepta cada uno.',
      },
    ],
  },
  {
    titulo: 'Mi acceso',
    opciones: [
      // Cada persona ve su propio expediente (solo lectura). La cuenta tecnica
      // de Informatica no tiene funcionario: no le aparece (requiereFuncionario).
      {
        texto: 'Mi expediente',
        ruta: '/mi-expediente',
        icono: 'carpeta',
        permisos: ['expediente.ver'],
        requiereFuncionario: true,
        descripcion: 'Su expediente laboral: información personal y laboral, documentos e historial de movimientos.',
        subopciones: [{ texto: 'Subir documento', patron: /^\/mi-expediente\/documentos\/nuevo$/, permisos: ['documentos.crear'] }],
      },
      { texto: 'Mi cuenta', ruta: '/mi-cuenta', icono: 'cuenta', permisos: [], descripcion: 'Sus datos personales, sus datos laborales, sus roles y su contraseña.' },
    ],
  },
];

/**
 * Si una opcion se le muestra a la cuenta: tiene TODOS sus permisos y, si la
 * opcion lo pide, la cuenta esta ligada a un funcionario. La usan el menu
 * lateral (Marco) y las tarjetas de Inicio, para que siempre coincidan.
 */
export function puedeVerOpcion(opcion: OpcionDeMenu, tienePermisos: (...claves: string[]) => boolean, tieneFuncionario: boolean): boolean {
  return (
    tienePermisos(...opcion.permisos) &&
    (!opcion.algunoDe || opcion.algunoDe.some((p) => tienePermisos(p))) &&
    (!opcion.requiereFuncionario || tieneFuncionario)
  );
}

/** Texto (y descripcion) de la opcion para esta cuenta. */
export function textoDeOpcion(opcion: OpcionDeMenu, tienePermisos: (...claves: string[]) => boolean): { texto: string; descripcion?: string } {
  const alt = opcion.textoSinPermiso;
  if (alt && !tienePermisos(alt.permiso)) return { texto: alt.texto, descripcion: alt.descripcion ?? opcion.descripcion };
  return { texto: opcion.texto, descripcion: opcion.descripcion };
}
