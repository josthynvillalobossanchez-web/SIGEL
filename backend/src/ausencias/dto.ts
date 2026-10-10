import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { PaginacionDto } from '../comun/dto/paginacion.dto.js';

/** Fecha de calendario AAAA-MM-DD (que el dia exista lo revisa el servicio). */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** En formularios con archivo (multipart) un campo vacio llega como "": para los opcionales significa "no vino". */
const vacioEsNada = ({ value }: { value: unknown }): unknown => {
  const limpio = recortar({ value });
  return limpio === '' ? undefined : limpio;
};
/** "true"/"false" de un formulario multipart a booleano. */
const aBooleano = ({ value }: { value: unknown }): unknown => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);
const aNumero = ({ value }: { value: unknown }): unknown => {
  const limpio = vacioEsNada({ value });
  return typeof limpio === 'string' ? Number(limpio.replace(',', '.')) : limpio;
};

/* ------------------------------------------------------------------ */
/* Incapacidades                                                       */
/* ------------------------------------------------------------------ */

/** POST /incapacidades (multipart; la boleta va en el campo "boleta"). */
export class RegistrarIncapacidadDto {
  /** Solo RRHH: la persona, cuando la registra por ella. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId?: string;

  @IsUUID(undefined, { message: 'Elija el tipo de incapacidad.' })
  tipoIncapacidadId!: string;

  @Matches(FECHA, { message: 'La fecha de inicio debe tener el formato AAAA-MM-DD.' })
  fechaInicio!: string;

  @Matches(FECHA, { message: 'La fecha de fin debe tener el formato AAAA-MM-DD.' })
  fechaFin!: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(2, 120, { message: 'La entidad que la emitió debe tener entre 2 y 120 caracteres.' })
  entidadEmisora?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 50, { message: 'El número de boleta no puede pasar de 50 caracteres.' })
  numeroBoleta?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 500, { message: 'La observación no puede pasar de 500 caracteres.' })
  observacion?: string;
}

export class AnularDto {
  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto.' })
  @Length(5, 255, { message: 'Explique el motivo (entre 5 y 255 caracteres).' })
  motivo!: string;
}

export class ConsultarIncapacidadesDto extends PaginacionDto {
  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 100)
  busqueda?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El tipo indicado no es válido.' })
  tipoIncapacidadId?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El departamento indicado no es válido.' })
  departamentoId?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "desde" debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD.' })
  hasta?: string;

  /** "vigentes" (por omision), "anuladas" o "todas". */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsIn(['vigentes', 'anuladas', 'todas'], { message: 'El estado indicado no es válido.' })
  estado?: 'vigentes' | 'anuladas' | 'todas';
}

/* ------------------------------------------------------------------ */
/* Capacitaciones                                                      */
/* ------------------------------------------------------------------ */

export const MODALIDADES = ['presencial', 'virtual', 'mixta'] as const;

/** POST /capacitaciones (multipart; el certificado, opcional, va en el campo "certificado"). */
export class RegistrarCapacitacionDto {
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId?: string;

  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto.' })
  @Length(2, 200, { message: 'El nombre del curso debe tener entre 2 y 200 caracteres.' })
  nombre!: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(2, 180, { message: 'La institución debe tener entre 2 y 180 caracteres.' })
  institucion?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsIn(MODALIDADES, { message: 'La modalidad debe ser presencial, virtual o mixta.' })
  modalidad?: (typeof MODALIDADES)[number];

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha de inicio debe tener el formato AAAA-MM-DD.' })
  fechaInicio?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha de fin debe tener el formato AAAA-MM-DD.' })
  fechaFin?: string;

  @IsOptional()
  @Transform(aNumero)
  @IsNumber({}, { message: 'Las horas deben ser un número.' })
  @Min(0.5, { message: 'Las horas deben ser al menos 0,5.' })
  @Max(2000, { message: 'Las horas no pueden pasar de 2000.' })
  cantidadHoras?: number;

  /** Choca con el horario: se crea la solicitud para que la jefatura la apruebe. */
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'Indique si choca con el horario (sí o no).' })
  afectaJornada?: boolean;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 500, { message: 'La observación no puede pasar de 500 caracteres.' })
  observacion?: string;
}

export class ConsultarCapacitacionesDto {
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId!: string;
}

/* ------------------------------------------------------------------ */
/* Horas extra                                                         */
/* ------------------------------------------------------------------ */

export class RegistrarHoraExtraDto {
  @IsUUID(undefined, { message: 'Elija a la persona.' })
  funcionarioId!: string;

  @Matches(FECHA, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  fecha!: string;

  @Matches(HORA, { message: 'La hora de inicio debe tener el formato HH:MM (24 horas).' })
  horaInicio!: string;

  @Matches(HORA, { message: 'La hora de fin debe tener el formato HH:MM (24 horas).' })
  horaFin!: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 500, { message: 'El motivo no puede pasar de 500 caracteres.' })
  motivo?: string;
}

export class ConsultarHorasExtraDto extends PaginacionDto {
  /** "AAAA-MM": el mes que se consulta (por omision, el actual). */
  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'El mes debe tener el formato AAAA-MM.' })
  mes?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El departamento indicado no es válido.' })
  departamentoId?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 100)
  busqueda?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluirAnuladas?: boolean;
}
