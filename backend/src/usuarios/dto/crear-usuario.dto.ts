import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Un rol que se le asigna a la cuenta, con su fecha de vencimiento opcional.
 *
 * Sin fecha, la asignacion es permanente. Con fecha, deja de contar sola ese
 * dia: es lo que se usa para las suplencias.
 */
export class RolAsignadoDto {
  @IsUUID(undefined, { message: 'El rol indicado no es válido.' })
  rolId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vencimiento del rol no es válida.' })
  fechaVencimiento?: string;
}

/**
 * Datos para crear una cuenta de usuario.
 *
 * Toda cuenta queda ligada a un funcionario: por decision del 24/09/2026 no
 * se crean cuentas sueltas. La unica excepcion es la de Informatica, que
 * crea la semilla y no pasa por aqui.
 *
 * La contrasena NO viene en el cuerpo: la genera el sistema al azar. Asi
 * nadie elige "Palmares2026" para todo el mundo.
 */
export class CrearUsuarioDto {
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId!: string;

  /**
   * Opcional. Si no viene, se usa el correo institucional del funcionario.
   * Se puede indicar otro cuando el funcionario no tiene correo institucional
   * o cuando va a entrar con su correo personal.
   */
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede pasar de 150 caracteres.' })
  correo?: string;

  /** Al menos uno: una cuenta sin roles no puede hacer nada en el sistema. */
  @IsArray({ message: 'Los roles deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'La cuenta debe tener al menos un rol.' })
  @ArrayMaxSize(10, { message: 'No se pueden asignar más de 10 roles a la vez.' })
  @ValidateNested({ each: true })
  @Type(() => RolAsignadoDto)
  roles!: RolAsignadoDto[];
}
