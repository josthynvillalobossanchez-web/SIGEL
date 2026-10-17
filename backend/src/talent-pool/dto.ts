import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../comun/dto/paginacion.dto.js';
import { MENSAJE_TELEFONO, NombreDePersona, normalizarTelefono, TELEFONO_DE_COSTA_RICA } from '../comun/validadores.js';

/** Quita espacios de mas; un texto vacio es "sin dato" (null). */
const limpiar = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const recortado = value.trim().replace(/\s{2,}/g, ' ');
  return recortado === '' ? null : recortado;
};
/** Igual, pero conserva los saltos de linea (textos largos). */
const limpiarParrafo = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const recortado = value.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return recortado === '' ? null : recortado;
};
const minuscula = ({ value }: { value: unknown }): unknown => {
  const limpio = limpiar({ value });
  return typeof limpio === 'string' ? limpio.toLowerCase() : limpio;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

export const NIVELES_EDUCATIVOS = ['primaria', 'secundaria', 'tecnico', 'universitaria', 'posgrado', 'curso'] as const;
export type NivelEducativo = (typeof NIVELES_EDUCATIVOS)[number];
export const CATEGORIAS_DE_HABILIDAD = ['tecnica', 'blanda', 'idioma', 'herramienta'] as const;
export type CategoriaDeHabilidad = (typeof CATEGORIAS_DE_HABILIDAD)[number];
export const NIVELES_DE_HABILIDAD = ['basico', 'intermedio', 'avanzado'] as const;
export const ESTADOS_DE_CANDIDATO = ['activo', 'inactivo', 'contratado', 'descartado'] as const;
export type EstadoDeCandidato = (typeof ESTADOS_DE_CANDIDATO)[number];

/* ===================================================================== */
/* Formulario publico (Ficha 32/33)                                       */
/* ===================================================================== */

export class FormacionDto {
  @IsIn(NIVELES_EDUCATIVOS, { message: 'Elija el nivel de cada estudio.' })
  nivel!: NivelEducativo;

  // 17/10: todos los datos del estudio son obligatorios (el año, salvo si esta en curso).
  @Transform(limpiar)
  @IsString({ message: 'Indique el título o nombre de cada estudio.' })
  @MinLength(2, { message: 'Indique el título o nombre de cada estudio.' })
  @MaxLength(180, { message: 'El nombre del título no puede pasar de 180 caracteres.' })
  titulo!: string;

  @Transform(limpiar)
  @IsString({ message: 'Indique la institución de cada estudio.' })
  @MinLength(2, { message: 'Indique la institución de cada estudio.' })
  @MaxLength(180, { message: 'La institución no puede pasar de 180 caracteres.' })
  institucion!: string;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(150, { message: 'El área de estudio no puede pasar de 150 caracteres.' })
  areaEstudio?: string | null;

  /** Obligatorio si el estudio esta concluido. */
  @ValidateIf((o: FormacionDto) => o.concluido !== false || (o.anioFinalizacion !== null && o.anioFinalizacion !== undefined))
  @Type(() => Number)
  @IsInt({ message: 'Indique el año en que terminó cada estudio concluido.' })
  @Min(1950, { message: 'El año de finalización no es válido.' })
  @Max(2100, { message: 'El año de finalización no es válido.' })
  anioFinalizacion?: number | null;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}

export class ExperienciaDto {
  @Transform(limpiar)
  @IsString({ message: 'Indique la empresa o institución de cada experiencia.' })
  @MinLength(2, { message: 'Indique la empresa o institución de cada experiencia.' })
  @MaxLength(180, { message: 'La empresa no puede pasar de 180 caracteres.' })
  empresa!: string;

  @Transform(limpiar)
  @IsString({ message: 'Indique el puesto de cada experiencia.' })
  @MinLength(2, { message: 'Indique el puesto de cada experiencia.' })
  @MaxLength(150, { message: 'El puesto no puede pasar de 150 caracteres.' })
  puesto!: string;

  /** Mes de inicio, "AAAA-MM". Obligatorio (17/10). */
  @Transform(limpiar)
  @IsString({ message: 'Indique el mes en que empezó cada experiencia.' })
  @Matches(MES, { message: 'Los meses de la experiencia deben venir como AAAA-MM.' })
  desde!: string;

  /** Obligatorio salvo que sea el trabajo actual (17/10). */
  @ValidateIf((o: ExperienciaDto) => !o.esActual)
  @Transform(limpiar)
  @IsString({ message: 'Indique hasta cuándo trabajó en cada experiencia (o marque que es su trabajo actual).' })
  @Matches(MES, { message: 'Los meses de la experiencia deben venir como AAAA-MM.' })
  hasta?: string | null;

  @IsOptional()
  @IsBoolean()
  esActual?: boolean;

  /** Funciones principales: obligatorias (17/10). */
  @Transform(limpiarParrafo)
  @IsString({ message: 'Describa las funciones principales de cada experiencia.' })
  @MinLength(5, { message: 'Describa las funciones principales de cada experiencia.' })
  @MaxLength(500, { message: 'La descripción de cada experiencia no puede pasar de 500 caracteres.' })
  descripcion!: string;
}

/** "Otra": habilidad que el candidato escribe para SI mismo (no pasa al catalogo, 17/10). */
export class HabilidadPropiaDto {
  @Transform(limpiar)
  @IsString({ message: 'Escriba el nombre de cada habilidad que agrega.' })
  @MinLength(2, { message: 'Escriba el nombre de cada habilidad que agrega.' })
  @MaxLength(80, { message: 'Cada habilidad que agrega puede tener hasta 80 caracteres.' })
  nombre!: string;

  @IsIn(CATEGORIAS_DE_HABILIDAD, { message: 'La categoría de una habilidad agregada no es válida.' })
  categoria!: CategoriaDeHabilidad;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsIn(NIVELES_DE_HABILIDAD, { message: 'El nivel de la habilidad no es válido.' })
  nivel?: (typeof NIVELES_DE_HABILIDAD)[number] | null;
}

export class HabilidadElegidaDto {
  @IsUUID(undefined, { message: 'Una de las habilidades no es válida.' })
  habilidadId!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsIn(NIVELES_DE_HABILIDAD, { message: 'El nivel de la habilidad no es válido.' })
  nivel?: (typeof NIVELES_DE_HABILIDAD)[number] | null;
}

/**
 * Lo que envia el formulario publico, como JSON en el campo "datos" (el
 * curriculum va aparte, en el campo "curriculum"). Siempre el registro
 * COMPLETO: si la cedula ya existe, se reemplaza todo (privacidad, 13/10).
 */
export class RegistroDeCandidatoDto {
  @Transform(limpiar)
  @IsString({ message: 'La cédula es obligatoria.' })
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

  @Transform(minuscula)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo no puede pasar de 150 caracteres.' })
  correo!: string;

  @IsOptional()
  @Transform(limpiar)
  @Transform(({ value }) => normalizarTelefono(value))
  @ValidateIf((_o, v) => v !== null)
  @Matches(TELEFONO_DE_COSTA_RICA, { message: MENSAJE_TELEFONO })
  telefono?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @Matches(FECHA, { message: 'La fecha de nacimiento debe venir como AAAA-MM-DD.' })
  fechaNacimiento?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(150, { message: 'El lugar de residencia no puede pasar de 150 caracteres.' })
  residencia?: string | null;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsUUID(undefined, { message: 'La profesión indicada no es válida.' })
  profesionId?: string | null;

  /** Solo si no encontro su profesion en la lista. */
  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(150, { message: 'La profesión no puede pasar de 150 caracteres.' })
  profesionTexto?: string | null;

  @IsOptional()
  @Transform(limpiarParrafo)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000, { message: 'El resumen profesional no puede pasar de 2000 caracteres.' })
  descripcion?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Puede indicar hasta 10 estudios.' })
  @ValidateNested({ each: true })
  @Type(() => FormacionDto)
  formacion: FormacionDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Puede indicar hasta 10 experiencias.' })
  @ValidateNested({ each: true })
  @Type(() => ExperienciaDto)
  experiencia: ExperienciaDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30, { message: 'Puede elegir hasta 30 habilidades.' })
  @ValidateNested({ each: true })
  @Type(() => HabilidadElegidaDto)
  habilidades: HabilidadElegidaDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12, { message: 'Puede agregar hasta 12 habilidades propias.' })
  @ValidateNested({ each: true })
  @Type(() => HabilidadPropiaDto)
  habilidadesPropias: HabilidadPropiaDto[] = [];

  /** La version del consentimiento que se le mostro. */
  @IsUUID(undefined, { message: 'Vuelva a cargar la página: el consentimiento no es válido.' })
  consentimientoId!: string;

  @Equals(true, { message: 'Debe aceptar el consentimiento informado para registrarse.' })
  aceptaConsentimiento!: boolean;

  /** Campo trampa: el formulario lo deja oculto y vacio; si viene lleno, es un robot. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sitioWeb?: string;
}

/* ===================================================================== */
/* Recursos Humanos (Fichas 34, 35 y 41)                                  */
/* ===================================================================== */

export class ConsultarCandidatosDto extends PaginacionDto {
  /** Cedula, nombre, correo, profesion, estudios, experiencia o resumen. */
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
  busqueda?: string;

  /** Por omision, solo los activos (Ficha 35: los inactivos no salen en la busqueda normal). */
  @IsOptional()
  @IsIn([...ESTADOS_DE_CANDIDATO, 'todos'], { message: 'El estado indicado no existe.' })
  estado?: EstadoDeCandidato | 'todos';

  @IsOptional()
  @IsUUID(undefined, { message: 'La profesión indicada no es válida.' })
  profesionId?: string;

  /** Nivel de estudio minimo que tiene que haber completado o cursado. */
  @IsOptional()
  @IsIn(NIVELES_EDUCATIVOS, { message: 'El nivel de estudio no existe.' })
  nivel?: NivelEducativo;

  /** Una o varias, separadas por coma: debe tenerlas todas. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  // Sin limite practico (17/10): el tope solo evita direcciones absurdas.
  @ArrayMaxSize(200, { message: 'Demasiadas habilidades en el filtro.' })
  @IsUUID(undefined, { each: true, message: 'Una de las habilidades no es válida.' })
  habilidades?: string[];

  /** Años minimos de experiencia laboral (sumando sus experiencias). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los años de experiencia deben ser un número entero.' })
  @Min(0)
  @Max(50)
  aniosExperiencia?: number;

  @IsOptional()
  @IsIn(['si', 'no'], { message: 'Indique si debe tener curriculum.' })
  conCurriculum?: 'si' | 'no';

  @IsOptional()
  @IsIn(['recientes', 'nombre'], { message: 'El orden indicado no existe.' })
  orden?: 'recientes' | 'nombre';
}

/** Cambiar el estado (no a "contratado": eso es Contratar) y/o la nota interna. */
export class CambiarCandidatoDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'descartado'], { message: 'El estado indicado no existe (para contratar use «Contratar»).' })
  estado?: 'activo' | 'inactivo' | 'descartado';

  @IsOptional()
  @Transform(limpiarParrafo)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(1000, { message: 'La nota no puede pasar de 1000 caracteres.' })
  notaInterna?: string | null;
}

/** Eliminar los datos a solicitud de la persona (Ley 8968). */
export class EliminarCandidatoDto {
  @Transform(limpiar)
  @IsString({ message: 'Indique el motivo.' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres.' })
  @MaxLength(300, { message: 'El motivo no puede pasar de 300 caracteres.' })
  motivo!: string;
}

export class HabilidadDto {
  @Transform(limpiar)
  @IsString({ message: 'El nombre es obligatorio.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre!: string;

  @IsIn(CATEGORIAS_DE_HABILIDAD, { message: 'Elija la categoría.' })
  categoria!: CategoriaDeHabilidad;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string | null;
}

export class EditarHabilidadDto {
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsIn(CATEGORIAS_DE_HABILIDAD, { message: 'Elija la categoría.' })
  categoria?: CategoriaDeHabilidad;

  @IsOptional()
  @Transform(limpiar)
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede pasar de 255 caracteres.' })
  descripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Campo "datos" del multipart del formulario publico. */
export class EnvioPublicoDto {
  @IsString({ message: 'Faltan los datos del formulario.' })
  @MaxLength(60_000, { message: 'El formulario es demasiado largo.' })
  datos!: string;
}
