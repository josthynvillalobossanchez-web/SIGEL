/*
 * Como se nombra cada catalogo en pantalla (singular, genero, ejemplo...).
 * Un solo lugar para que la pagina y las ventanas digan lo mismo.
 */
import type { TipoDeCatalogo } from '../../api/catalogos';

export interface TextosDeCatalogo {
  /** Nombre de la pestana. */
  titulo: string;
  singular: string;
  /** "el" / "la". */
  el: string;
  /** "un" / "una". */
  un: string;
  /** Terminacion de genero: "o" / "a" (activo/activa). */
  o: string;
  /** Para que sirve, bajo el titulo. */
  explicacion: string;
  /** Ejemplo para el campo nombre. */
  ejemplo: string;
  /** Largo maximo del nombre (igual que la columna de la base). */
  largoMaximo: number;
  /** Titulo de la columna de uso. */
  columnaDeUso: string;
  /** "3 funcionarios activos lo tienen" / "3 incapacidades registradas lo usan". */
  uso: (n: number) => string;
  /** Lo que pasa con los que ya lo usan al inactivarlo o renombrarlo. */
  alInactivar: string;
  alRenombrar: string;
}

const usoDeFuncionarios = (n: number) => `${n} funcionario${n === 1 ? ' activo lo tiene' : 's activos lo tienen'}`;
const DE_FUNCIONARIOS = {
  columnaDeUso: 'Funcionarios',
  uso: usoDeFuncionarios,
  alInactivar: 'Lo conservan, pero no se podrá elegir para nadie más hasta que lo reactive.',
  alRenombrar: 'el nombre nuevo se verá en su expediente.',
};

export const TEXTOS: Record<TipoDeCatalogo, TextosDeCatalogo> = {
  departamentos: {
    titulo: 'Departamentos',
    singular: 'departamento',
    el: 'el',
    un: 'un',
    o: 'o',
    explicacion: 'Las unidades de la Municipalidad. Cada funcionario pertenece a un departamento.',
    ejemplo: 'Recursos Humanos',
    largoMaximo: 120,
    ...DE_FUNCIONARIOS,
  },
  puestos: {
    titulo: 'Puestos',
    singular: 'puesto',
    el: 'el',
    un: 'un',
    o: 'o',
    explicacion: 'Los cargos que puede ocupar un funcionario.',
    ejemplo: 'Asistente de Recursos Humanos',
    largoMaximo: 120,
    ...DE_FUNCIONARIOS,
  },
  profesiones: {
    titulo: 'Profesiones',
    singular: 'profesión',
    el: 'la',
    un: 'una',
    o: 'a',
    explicacion: 'La formación de cada persona. La elige RRHH o la propia persona en "Mi cuenta".',
    ejemplo: 'Administración de Empresas',
    largoMaximo: 150,
    ...DE_FUNCIONARIOS,
  },
  tiposIncapacidad: {
    titulo: 'Tipos de incapacidad',
    singular: 'tipo de incapacidad',
    el: 'el',
    un: 'un',
    o: 'o',
    explicacion: 'Lo que se elige al registrar una incapacidad (enfermedad, maternidad, riesgo del trabajo…). Solo lo ven la persona y RRHH.',
    ejemplo: 'Licencia de paternidad',
    largoMaximo: 120,
    columnaDeUso: 'Incapacidades',
    uso: (n) => `${n} incapacidad${n === 1 ? ' registrada lo usa' : 'es registradas lo usan'}`,
    alInactivar: 'Las incapacidades ya registradas lo conservan, pero no se podrá elegir para nuevas hasta que lo reactive.',
    alRenombrar: 'el nombre nuevo se verá en esas incapacidades.',
  },
};

export const TIPOS: TipoDeCatalogo[] = ['departamentos', 'puestos', 'profesiones', 'tiposIncapacidad'];
