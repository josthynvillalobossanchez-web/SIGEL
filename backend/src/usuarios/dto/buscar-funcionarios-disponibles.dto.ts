import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Busqueda de funcionarios a los que se les puede crear una cuenta
 * (activos y sin cuenta). La usa la pantalla "Crear usuario".
 */
export class BuscarFuncionariosDisponiblesDto {
  /** Cedula, nombre, apellidos o correo institucional. Vacio = los primeros 20. */
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MaxLength(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
  busqueda?: string;
}
