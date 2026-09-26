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
}

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
  },
};

export const TIPOS: TipoDeCatalogo[] = ['departamentos', 'puestos', 'profesiones'];
