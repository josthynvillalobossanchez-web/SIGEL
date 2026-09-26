import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

/**
 * Filtros de la lista de funcionarios (pgFuncionarios). Todos opcionales;
 * la lista siempre viene paginada (hereda pagina y tamano).
 */
export class ConsultarFuncionariosDto extends PaginacionDto {
  /**
   * Cedula, nombre, apellidos o correo. Con varias palabras ("ana vargas"),
   * cada una tiene que aparecer en algun campo.
   */
  @IsOptional()
  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MaxLength(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
  busqueda?: string;

  @IsOptional()
  @IsIn(['activo', 'inactivo'], { message: 'El estado indicado no existe.' })
  estado?: 'activo' | 'inactivo';

  @IsOptional()
  @IsUUID(undefined, { message: 'El departamento indicado no es válido.' })
  departamentoId?: string;
}
