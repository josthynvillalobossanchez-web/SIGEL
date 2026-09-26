import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RolAsignadoDto } from '../../usuarios/dto/crear-usuario.dto.js';
import { MENSAJE_TELEFONO, NombreDePersona, normalizarTelefono, TELEFONO_DE_COSTA_RICA } from '../../comun/validadores.js';

/** Quita espacios; un texto vacio se toma como "sin dato" (null). */
const limpiar = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const recortado = value.trim().replace(/\s{2,}/g, ' ');
  return recortado === '' ? null : recortado;
};

/** Correos siempre en minuscula (se comparan asi). */
const limpiarCorreo = ({ value }: { value: unknown }): unknown => {
  const limpio = limpiar({ value });
  return typeof limpio === 'string' ? limpio.toLowerCase() : limpio;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const TIPOS_DE_NOMBRAMIENTO = ['propiedad', 'interino', 'contratacionServicios'] as const;
export type TipoDeNombramiento = (typeof TIPOS_DE_NOMBRAMIENTO)[number];

/**
 * Cuenta de acceso que se crea junto con el funcionario (casilla "crear
 * tambien su cuenta"). El correo de ingreso es SIEMPRE el institucional
 * (decision del 24/09/2026); los roles, con su vigencia opcional.
 */
export class CuentaNuevaDto {
  @IsArray({ message: 'Los roles deben venir en una lista.' })
  @ArrayMinSize(1, { message: 'La cuenta debe tener al menos un rol.' })
  @ArrayMaxSize(10, { message: 'No se pueden asignar más de 10 roles a la vez.' })
  @ValidateNested({ each: true })
  @Type(() => RolAsignadoDto)
  roles!: RolAsignadoDto[];
}

/**
 * "Registrar funcionario" (pagina por pasos). Los tres bloques del
 * prototipo: datos personales, contacto y datos laborales.
 *
 * Las fechas van como "AAAA-MM-DD" (sin hora). El servicio revisa que
 * tengan sentido (edad, ingreso despues del nacimiento, etc.).
 */
export class RegistrarFuncionarioDto {
  // ----- Datos personales -----
  @Transform(limpiar)
  @IsString({ message: 'La cédula debe ser texto.' })
  @Matches(/^[0-9A-Za-z -]{5,25}$/, { message: 'La cédula solo puede tener números, letras y guiones (entre 5 y 20 caracteres).' })
  cedula!: string;

  @Transform(limpiar)
  @NombreDePersona('El nombre', 50, 5)
  nombre!: string;

  @Transform(limpiar)
  @NombreDePersona('El primer apellido', 40, 4)
  primerApellido!: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @NombreDePersona('El segundo apellido', 40, 4)
  segundoApellido?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @Matches(FECHA, { message: 'La fecha de nacimiento debe venir como AAAA-MM-DD.' })
  fechaNacimiento?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsUUID(undefined, { message: 'La profesión indicada no es válida.' })
  profesionId?: string | null;

  // ----- Contacto -----
  @Transform(limpiarCorreo)
  @IsNotEmpty({ message: 'El correo personal es obligatorio: es el canal de respaldo para los avisos.' })
  @IsEmail({}, { message: 'El correo personal no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo personal no puede pasar de 150 caracteres.' })
  correoPersonal!: string;

  @IsOptional()
  @Transform(limpiarCorreo)
  @ValidateIf((_o, v) => v !== null)
  @IsEmail({}, { message: 'El correo institucional no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo institucional no puede pasar de 150 caracteres.' })
  correoInstitucional?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @Transform(({ value }) => normalizarTelefono(value))
  @ValidateIf((_o, v) => v !== null)
  @Matches(TELEFONO_DE_COSTA_RICA, { message: MENSAJE_TELEFONO })
  telefonoPersonal?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @MaxLength(255, { message: 'La dirección no puede pasar de 255 caracteres.' })
  direccion?: string | null;

  // ----- Datos laborales (solo Recursos Humanos) -----
  @IsUUID(undefined, { message: 'Elija el puesto.' })
  puestoId!: string;

  @IsUUID(undefined, { message: 'Elija el departamento.' })
  departamentoId!: string;

  /** null = tope de la jerarquia (se autoaprueba). */
  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsUUID(undefined, { message: 'La jefatura indicada no es válida.' })
  jefaturaId?: string | null;

  @IsIn(TIPOS_DE_NOMBRAMIENTO, { message: 'Elija el tipo de nombramiento.' })
  tipoNombramiento!: TipoDeNombramiento;

  @IsUUID(undefined, { message: 'Elija el régimen de vacaciones.' })
  regimenVacacionesId!: string;

  @Transform(limpiar)
  @IsString({ message: 'La fecha de ingreso es obligatoria.' })
  @Matches(FECHA, { message: 'La fecha de ingreso debe venir como AAAA-MM-DD.' })
  fechaIngreso!: string;

  /** Codigo de empleado de la Municipalidad (formato por definir con Joseph). */
  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^[0-9A-Za-z-]{1,30}$/, { message: 'El código de empleado solo puede tener números, letras y guiones (hasta 30).' })
  numeroEmpleado?: string | null;

  // ----- Cuenta de acceso (opcional) -----
  @IsOptional()
  @ValidateNested()
  @Type(() => CuentaNuevaDto)
  cuenta?: CuentaNuevaDto;
}

/**
 * "Editar funcionario": todo opcional, se cambia lo que venga. La cedula
 * NO se cambia (es el identificador permanente de la persona) y el estado
 * tampoco: para eso estan "Registrar salida" y "Reingreso".
 */
export class EditarFuncionarioDto {
  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(limpiar)
  @NombreDePersona('El nombre', 50, 5)
  nombre?: string;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(limpiar)
  @NombreDePersona('El primer apellido', 40, 4)
  primerApellido?: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @NombreDePersona('El segundo apellido', 40, 4)
  segundoApellido?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @Matches(FECHA, { message: 'La fecha de nacimiento debe venir como AAAA-MM-DD.' })
  fechaNacimiento?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsUUID(undefined, { message: 'La profesión indicada no es válida.' })
  profesionId?: string | null;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(limpiarCorreo)
  @IsNotEmpty({ message: 'El correo personal es obligatorio: es el canal de respaldo para los avisos.' })
  @IsEmail({}, { message: 'El correo personal no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo personal no puede pasar de 150 caracteres.' })
  correoPersonal?: string;

  @IsOptional()
  @Transform(limpiarCorreo)
  @ValidateIf((_o, v) => v !== null)
  @IsEmail({}, { message: 'El correo institucional no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo institucional no puede pasar de 150 caracteres.' })
  correoInstitucional?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @Transform(({ value }) => normalizarTelefono(value))
  @ValidateIf((_o, v) => v !== null)
  @Matches(TELEFONO_DE_COSTA_RICA, { message: MENSAJE_TELEFONO })
  telefonoPersonal?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @MaxLength(255, { message: 'La dirección no puede pasar de 255 caracteres.' })
  direccion?: string | null;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID(undefined, { message: 'Elija el puesto.' })
  puestoId?: string;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID(undefined, { message: 'Elija el departamento.' })
  departamentoId?: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsUUID(undefined, { message: 'La jefatura indicada no es válida.' })
  jefaturaId?: string | null;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(TIPOS_DE_NOMBRAMIENTO, { message: 'Elija el tipo de nombramiento.' })
  tipoNombramiento?: TipoDeNombramiento;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID(undefined, { message: 'Elija el régimen de vacaciones.' })
  regimenVacacionesId?: string;

  // Puede no venir, pero si viene no puede ser null (la columna es obligatoria).
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(limpiar)
  @IsString({ message: 'La fecha de ingreso no puede quedar vacía.' })
  @Matches(FECHA, { message: 'La fecha de ingreso debe venir como AAAA-MM-DD.' })
  fechaIngreso?: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^[0-9A-Za-z-]{1,30}$/, { message: 'El código de empleado solo puede tener números, letras y guiones (hasta 30).' })
  numeroEmpleado?: string | null;
}

/** "Registrar salida": fecha y motivo (obligatorio, queda en el expediente). */
export class RegistrarSalidaDto {
  @Transform(limpiar)
  @IsString({ message: 'Indique la fecha de salida.' })
  @Matches(FECHA, { message: 'La fecha de salida debe venir como AAAA-MM-DD.' })
  fechaSalida!: string;

  @Transform(limpiar)
  @IsString({ message: 'Indique el motivo de la salida.' })
  @Length(3, 150, { message: 'El motivo debe tener entre 3 y 150 caracteres.' })
  motivoSalida!: string;
}

/** "Reingreso": la persona vuelve a trabajar en la Municipalidad. */
export class ReingresoDto {
  @Transform(limpiar)
  @IsString({ message: 'Indique la fecha de reingreso.' })
  @Matches(FECHA, { message: 'La fecha de reingreso debe venir como AAAA-MM-DD.' })
  fechaIngreso!: string;
}
