import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

/** Fecha de calendario AAAA-MM-DD (que el dia exista lo revisa el servicio). */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const recortar = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const vacioEsNada = ({ value }: { value: unknown }): unknown => {
  const limpio = recortar({ value });
  return limpio === '' ? undefined : limpio;
};

export const ESTADOS_DE_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoDeSolicitud = (typeof ESTADOS_DE_SOLICITUD)[number];

/** Datos de una solicitud nueva (y de la vista previa del calculo). */
export class CrearSolicitudDto {
  @IsUUID(undefined, { message: 'Elija el tipo de solicitud.' })
  tipoSolicitudId!: string;

  @Matches(FECHA, { message: 'La fecha de inicio debe tener el formato AAAA-MM-DD.' })
  fechaInicio!: string;

  @Matches(FECHA, { message: 'La fecha de fin debe tener el formato AAAA-MM-DD.' })
  fechaFin!: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsString({ message: 'El motivo debe ser texto.' })
  @Length(1, 500, { message: 'El motivo no puede pasar de 500 caracteres.' })
  motivo?: string;

  /** Solo Recursos Humanos: la persona afectada, cuando la solicitud se hace en su nombre. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId?: string;

  /** Documento ya subido al expediente que respalda la solicitud (licencias, por ejemplo). */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El justificante indicado no es válido.' })
  justificanteDocumentoId?: string;
}

export class RechazarSolicitudDto {
  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto.' })
  @Length(5, 500, { message: 'Explique el motivo del rechazo (entre 5 y 500 caracteres).' })
  motivo!: string;
}

/** Filtros comunes de las listas de solicitudes. */
export class ConsultarSolicitudesDto extends PaginacionDto {
  @IsOptional()
  @Transform(vacioEsNada)
  @IsIn(ESTADOS_DE_SOLICITUD, { message: 'El estado indicado no es válido.' })
  estado?: EstadoDeSolicitud;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El tipo de solicitud indicado no es válido.' })
  tipoSolicitudId?: string;

  /** Solo RRHH (lista de todas): una persona en particular. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El funcionario indicado no es válido.' })
  funcionarioId?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El departamento indicado no es válido.' })
  departamentoId?: string;

  /** Nombre, cedula o consecutivo. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsString()
  @Length(1, 80, { message: 'La búsqueda no puede pasar de 80 caracteres.' })
  busqueda?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "desde" debe tener el formato AAAA-MM-DD.' })
  desde?: string;

  @IsOptional()
  @Transform(vacioEsNada)
  @Matches(FECHA, { message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD.' })
  hasta?: string;
}

export const ALCANCES_DE_CALENDARIO = ['propio', 'equipo', 'todos'] as const;
export type AlcanceDeCalendario = (typeof ALCANCES_DE_CALENDARIO)[number];

export class ConsultarCalendarioDto {
  @Matches(FECHA, { message: 'La fecha "desde" debe tener el formato AAAA-MM-DD.' })
  desde!: string;

  @Matches(FECHA, { message: 'La fecha "hasta" debe tener el formato AAAA-MM-DD.' })
  hasta!: string;

  @IsIn(ALCANCES_DE_CALENDARIO, { message: 'El alcance debe ser propio, equipo o todos.' })
  alcance!: AlcanceDeCalendario;

  /** Solo con alcance "todos": un departamento. */
  @IsOptional()
  @Transform(vacioEsNada)
  @IsUUID(undefined, { message: 'El departamento indicado no es válido.' })
  departamentoId?: string;
}
