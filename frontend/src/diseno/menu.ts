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
  subopciones?: SubopcionDeMenu[];
}

export interface GrupoDeMenu {
  titulo: string;
  opciones: OpcionDeMenu[];
}

export const MENU: GrupoDeMenu[] = [
  {
    titulo: 'General',
    opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio', permisos: [] }],
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
        subopciones: [
          { texto: 'Registrar funcionario', ruta: '/funcionarios/nuevo', permisos: ['funcionarios.crear'] },
          { texto: 'Editar funcionario', patron: /^\/funcionarios\/[^/]+\/editar$/, permisos: ['funcionarios.editar'] },
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
        subopciones: [
          { texto: 'Crear rol', ruta: '/roles/nuevo', permisos: ['roles.editar'] },
          { texto: 'Editar rol', patron: /^\/roles\/[^/]+\/editar$/, permisos: ['roles.editar'] },
        ],
      },
    ],
  },
  {
    // Mismo grupo del prototipo. En la epica 3 se agrega "Tipos de documento".
    titulo: 'Catálogos',
    opciones: [{ texto: 'Catálogos de personal', ruta: '/catalogos', icono: 'carpeta', permisos: ['catalogos.editar'] }],
  },
  {
    titulo: 'Mi acceso',
    opciones: [{ texto: 'Mi cuenta', ruta: '/mi-cuenta', icono: 'cuenta', permisos: [] }],
  },
];
