import { Transform } from 'class-transformer';
import { MENSAJE_TELEFONO, normalizarTelefono, TELEFONO_DE_COSTA_RICA } from '../../comun/validadores.js';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';

/** Quita espacios; un texto vacio se toma como "sin dato" (null). */
const limpiar = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const recortado = value.trim();
  return recortado === '' ? null : recortado;
};

/**
 * Datos personales y de contacto que la propia persona mantiene desde
 * "Mi cuenta" (permiso perfilPropio.editar). Los datos laborales (puesto,
 * departamento, jefatura, fechas) solo los cambia Recursos Humanos.
 *
 * Todos son opcionales: se cambia lo que venga. Para borrar un dato
 * opcional se manda "" o null.
 */
export class ActualizarDatosPersonalesDto {
  @IsOptional()
  @Transform(limpiar)
  @Transform(({ value }) => normalizarTelefono(value))
  @ValidateIf((_o, valor) => valor !== null)
  @Matches(TELEFONO_DE_COSTA_RICA, { message: MENSAJE_TELEFONO })
  telefonoPersonal?: string | null;

  /** Obligatorio en la base: es el canal de respaldo de las notificaciones. */
  @IsOptional()
  @Transform(limpiar)
  @IsEmail({}, { message: 'El correo personal no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo personal no puede pasar de 150 caracteres.' })
  correoPersonal?: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, valor) => valor !== null)
  @IsEmail({}, { message: 'El correo institucional no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo institucional no puede pasar de 150 caracteres.' })
  correoInstitucional?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, valor) => valor !== null)
  @IsUUID(undefined, { message: 'La profesión indicada no es válida.' })
  profesionId?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, valor) => valor !== null)
  @IsString({ message: 'La dirección debe ser texto.' })
  @MaxLength(255, { message: 'La dirección no puede pasar de 255 caracteres.' })
  direccion?: string | null;
}
