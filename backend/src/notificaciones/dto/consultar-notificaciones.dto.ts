import { IsIn, IsOptional } from 'class-validator';
import { PaginacionDto } from '../../comun/dto/paginacion.dto.js';

/** GET /notificaciones?estado=sinLeer|leidas|todas&pagina=&tamano= */
export class ConsultarNotificacionesDto extends PaginacionDto {
  @IsOptional()
  @IsIn(['sinLeer', 'leidas', 'todas'], { message: 'El estado debe ser sinLeer, leidas o todas.' })
  estado: 'sinLeer' | 'leidas' | 'todas' = 'todas';
}
