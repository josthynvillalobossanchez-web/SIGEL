import { IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ESTADOS_DE_USUARIO, type EstadoDeUsuario } from './consultar-usuarios.dto.js';

/**
 * Datos para activar, inactivar o bloquear una cuenta.
 *
 * Los tres estados significan cosas distintas:
 *   activo     la persona puede entrar.
 *   inactivo   ya no trabaja en la Municipalidad o no debe usar el sistema.
 *   bloqueado  se le corto el acceso por una razon puntual (seguridad,
 *              investigacion) y se espera reactivarla.
 *
 * No confundir "bloqueado" con el bloqueo de tres minutos por intentos
 * fallidos: ese es automatico, temporal, y no cambia el estado de la cuenta.
 */
export class CambiarEstadoUsuarioDto {
  @IsIn(ESTADOS_DE_USUARIO, { message: 'El estado indicado no existe.' })
  estado!: EstadoDeUsuario;

  /**
   * Obligatorio al inactivar o bloquear: queda en la bitacora y es lo que
   * permite entender despues por que se le corto el acceso a alguien.
   * Al reactivar es opcional.
   */
  @ValidateIf((datos: CambiarEstadoUsuarioDto) => datos.estado !== 'activo' || datos.motivo !== undefined)
  @IsString({ message: 'El motivo debe ser texto.' })
  @IsNotEmpty({ message: 'Indique el motivo al inactivar o bloquear una cuenta.' })
  @MaxLength(255, { message: 'El motivo no puede pasar de 255 caracteres.' })
  motivo?: string;
}
