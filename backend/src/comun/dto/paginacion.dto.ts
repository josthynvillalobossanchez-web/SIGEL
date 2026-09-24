import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Tope duro de registros por pagina. */
export const TAMANO_MAXIMO_PAGINA = 100;

/**
 * Parametros de paginacion comunes a todas las consultas del sistema.
 *
 * Toda lista que pueda crecer se pagina desde el primer dia. El expediente
 * de una municipalidad junta miles de documentos y de movimientos de
 * bitacora, y traerlos todos de un golpe tumba tanto al navegador como al
 * servidor.
 *
 * El cliente pide el tamano de pagina, pero NO decide el maximo: aunque
 * mande tamano=100000, la validacion lo rechaza. Nunca se confia en el
 * frontend para limitar cuanto devuelve la API.
 */
export class PaginacionDto {
  /**
   * @Type convierte el texto que llega en la URL a numero. Sin el, "2"
   * llegaria como cadena y @IsInt lo rechazaria.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero.' })
  @Min(1, { message: 'La pagina empieza en 1.' })
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tamano de pagina debe ser un numero entero.' })
  @Min(1)
  @Max(TAMANO_MAXIMO_PAGINA, { message: `No se pueden pedir mas de ${TAMANO_MAXIMO_PAGINA} registros por pagina.` })
  tamano: number = 20;
}

/** Envoltura con la que responden todas las consultas paginadas. */
export interface PaginaDeResultados<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Arma la respuesta paginada, para no repetir el calculo en cada servicio. */
export function armarPagina<T>(
  datos: T[],
  total: number,
  pagina: number,
  tamano: number,
): PaginaDeResultados<T> {
  return {
    datos,
    total,
    pagina,
    tamano,
    totalPaginas: Math.max(1, Math.ceil(total / tamano)),
  };
}
