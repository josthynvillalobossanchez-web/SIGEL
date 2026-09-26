import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Pagina "Agregar excepcion": varios permisos individuales de una vez, con
 * el mismo efecto, la misma fecha limite y el mismo motivo.
 *
 * Ejemplo:
 *   { "permisoIds": ["...", "..."], "otorgado": true,
 *     "fechaVencimiento": "2026-10-31",
 *     "observacion": "Cubre a la jefatura durante sus vacaciones" }
 *
 * Aqui el motivo es OBLIGATORIO: una excepcion se sale de lo normal y
 * despues alguien va a preguntar por que se hizo.
 */
export class AjustarVariosPermisosDto {
  @IsArray({ message: 'Indique la lista de permisos.' })
  @ArrayMinSize(1, { message: 'Elija al menos un permiso.' })
  @ArrayMaxSize(100, { message: 'Son demasiados permisos de una vez.' })
  @IsUUID(undefined, { each: true, message: 'Alguno de los permisos indicados no es válido.' })
  permisoIds!: string[];

  @IsBoolean({ message: 'Indique si los permisos se conceden (true) o se quitan (false).' })
  otorgado!: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento no es válida.' })
  fechaVencimiento?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El motivo debe ser texto.' })
  @IsNotEmpty({ message: 'Indique el motivo de la excepción: queda en la bitácora.' })
  @MaxLength(255, { message: 'El motivo no puede pasar de 255 caracteres.' })
  observacion!: string;
}
