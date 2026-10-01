import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

/** Fecha de calendario AAAA-MM-DD (que el dia exista lo revisa el servicio). */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Quita espacios al inicio y al final. */
const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * En formularios con archivo (multipart) un campo vacio llega como "".
 * Para los opcionales, "" significa "no vino".
 */
const vacioEsNada = ({ value }: { value: unknown }): unknown => {
  const limpio = recortar({ value });
  return limpio === '' ? undefined : limpio;
};

/**
 * En una edicion, "" significa "quitar el valor" (queda null). Un campo que
 * no viene no se toca.
 */
const vacioEsNulo = ({ value }: { value: unknown }): unknown => {
  const limpio = recortar({ value });
  return limpio === '' ? null : limpio;
};

/**
 * Datos que acompanan al archivo al subirlo (el archivo va en el campo
 * "archivo" del formulario multipart; aqui solo los textos).
 */
export class SubirDocumentoDto {
  @IsUUID(undefined, { message: 'Elija el tipo de documento.' })
  tipoDocumentoId!: string;

  @Transform(recortar)
  @IsString({ message: 'El título debe ser texto.' })
  @Length(2, 180, { message: 'El título debe tener entre 2 y 180 caracteres.' })
  titulo!: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string;

  /** Fecha del documento (por ejemplo, la de emision). Opcional. */
  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha del documento debe venir como AAAA-MM-DD.' })
  fechaDocumento?: string;
}

/**
 * Editar un documento: solo titulo, tipo, descripcion y fecha. El archivo
 * nunca se reemplaza (si esta malo, se da de baja y se sube el correcto).
 * Un campo que no viene no se toca; "" en descripcion o fecha las quita.
 */
export class EditarDocumentoDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El título debe ser texto.' })
  @Length(2, 180, { message: 'El título debe tener entre 2 y 180 caracteres.' })
  titulo?: string;

  @IsOptional()
  @IsUUID(undefined, { message: 'El tipo de documento indicado no es válido.' })
  tipoDocumentoId?: string;

  @IsOptional()
  @Transform(vacioEsNulo)
  @ValidateIf((_o, v) => v !== null)
  @IsString({ message: 'La descripción debe ser texto.' })
  @MaxLength(500, { message: 'La descripción no puede pasar de 500 caracteres.' })
  descripcion?: string | null;

  @IsOptional()
  @Transform(vacioEsNulo)
  @ValidateIf((_o, v) => v !== null)
  @Matches(FECHA, { message: 'La fecha del documento debe venir como AAAA-MM-DD.' })
  fechaDocumento?: string | null;
}

/** Dar de baja un documento: el motivo es corto y opcional. */
export class DarDeBajaDocumentoDto {
  @IsOptional()
  @Transform(vacioEsNada)
  @IsString({ message: 'El motivo debe ser texto.' })
  @MaxLength(255, { message: 'El motivo no puede pasar de 255 caracteres.' })
  motivo?: string;
}

/** Filtros de la lista de documentos de un expediente (paginada). */
export class ConsultarDocumentosDto extends PaginacionDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'El tipo de documento indicado no es válido.' })
  tipoDocumentoId?: string;

  /** Busca en el titulo y en el nombre del archivo. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MaxLength(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
  busqueda?: string;

  /** Solo Recursos Humanos ve bajas; para los demas siempre son los vigentes. */
  @IsOptional()
  @IsIn(['vigentes', 'bajas', 'todos'], { message: 'El estado indicado no existe.' })
  estado?: 'vigentes' | 'bajas' | 'todos';
}

/** "ver" abre el archivo en pantalla; "descargar" lo baja. Las dos quedan en la bitacora. */
export class AbrirArchivoDto {
  @IsOptional()
  @IsIn(['ver', 'descargar'], { message: 'El modo debe ser "ver" o "descargar".' })
  modo?: 'ver' | 'descargar';
}
