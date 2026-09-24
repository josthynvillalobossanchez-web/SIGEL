import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

/** Los mismos valores del enum "estadoUsuario" del modelo de datos. */
export const ESTADOS_DE_USUARIO = ['activo', 'inactivo', 'bloqueado'] as const;
export type EstadoDeUsuario = (typeof ESTADOS_DE_USUARIO)[number];

/**
 * Filtros de la pantalla de usuarios. Todos opcionales.
 *
 * Hereda pagina y tamano de PaginacionDto, asi que la lista siempre viene
 * paginada aunque no se pida nada.
 */
export class ConsultarUsuariosDto extends PaginacionDto {
  /**
   * Texto libre. Busca en el correo de la cuenta y, si la cuenta esta ligada
   * a un funcionario, tambien en su cedula, nombre y apellidos.
   *
   * Es lo que escribe la persona en la casilla de buscar, asi que se limita
   * el largo: nadie busca por 120 caracteres, y sin tope seria una forma
   * barata de hacerle trabajar de mas a la base.
   */
  @IsOptional()
  @IsString({ message: 'La busqueda debe ser texto.' })
  @MaxLength(120, { message: 'La busqueda no puede pasar de 120 caracteres.' })
  busqueda?: string;

  @IsOptional()
  @IsIn(ESTADOS_DE_USUARIO, { message: 'El estado indicado no existe.' })
  estado?: EstadoDeUsuario;

  /** Para ver, por ejemplo, quienes tienen el rol de Aprobador. */
  @IsOptional()
  @IsUUID(undefined, { message: 'El rol indicado no es valido.' })
  rolId?: string;
}
