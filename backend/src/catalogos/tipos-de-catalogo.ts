import { NotFoundException, type PipeTransform } from '@nestjs/common';

/**
 * Los catalogos que se administran desde la pantalla "Catalogos".
 *
 * Los tres tienen la misma forma en la base (nombre unico, descripcion,
 * activo, y funcionarios que los usan), asi que comparten un solo servicio.
 * Lo unico que cambia es el modelo de Prisma, el largo del nombre y como se
 * nombran en los mensajes (articulos y genero: "el departamento" / "la profesion").
 *
 * Los regimenes de vacaciones NO estan aqui: tienen reglas propias (topes,
 * tramos) y se administran en el Sprint 2.
 */
export const TIPOS_DE_CATALOGO = {
  departamentos: {
    modelo: 'departamento',
    singular: 'departamento',
    el: 'el',
    del: 'del',
    un: 'un',
    o: 'o',
    llamado: 'llamado',
    largoMaximo: 120,
  },
  puestos: {
    modelo: 'puesto',
    singular: 'puesto',
    el: 'el',
    del: 'del',
    un: 'un',
    o: 'o',
    llamado: 'llamado',
    largoMaximo: 120,
  },
  profesiones: {
    modelo: 'profesion',
    singular: 'profesión',
    el: 'la',
    del: 'de la',
    un: 'una',
    o: 'a',
    llamado: 'llamada',
    largoMaximo: 150,
  },
} as const;

export type TipoDeCatalogo = keyof typeof TIPOS_DE_CATALOGO;
export type DatosDelTipo = (typeof TIPOS_DE_CATALOGO)[TipoDeCatalogo];

/**
 * Pipe para el parametro ":tipo" de la ruta. Un tipo que no existe responde
 * 404 con un codigo propio (y no llega a la base de datos).
 *
 *   @Get(':tipo') consultar(@Param('tipo', TipoDeCatalogoValido) tipo: TipoDeCatalogo)
 */
export class TipoDeCatalogoValido implements PipeTransform<string, TipoDeCatalogo> {
  transform(valor: string): TipoDeCatalogo {
    if (!Object.hasOwn(TIPOS_DE_CATALOGO, valor)) {
      throw new NotFoundException({
        codigo: 'CATALOGO_NO_EXISTE',
        message: 'Ese catálogo no existe. Los catálogos son: departamentos, puestos y profesiones.',
      });
    }
    return valor as TipoDeCatalogo;
  }
}
