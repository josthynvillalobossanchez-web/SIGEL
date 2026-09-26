import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { ActualizarDatosPersonalesDto } from './dto/actualizar-datos-personales.dto.js';
import { MiCuentaService } from './mi-cuenta.service.js';

/**
 * "Mi cuenta". Todo lo de aqui es sobre la propia persona: el id sale
 * SIEMPRE de la sesion, nunca de la URL ni del cuerpo (asi nadie puede
 * pedir o cambiar la cuenta de otro cambiando un numero).
 */
@Controller('mi-cuenta')
export class MiCuentaController {
  constructor(private readonly miCuenta: MiCuentaService) {}

  /**
   * GET /api/mi-cuenta
   * Perfil de la pantalla "Mi cuenta": datos de la cuenta, del funcionario
   * (si tiene) y el catalogo de profesiones para el formulario.
   * Solo pide tener sesion.
   */
  @Get()
  consultar(@UsuarioActual() usuario: UsuarioAutenticado): Promise<unknown> {
    return this.miCuenta.consultar(usuario);
  }

  /**
   * PATCH /api/mi-cuenta/datos-personales
   * La persona actualiza sus datos de contacto (telefono, correos,
   * profesion, direccion). Pide perfilPropio.editar. Queda en la bitacora.
   */
  @RequierePermisos('perfilPropio.editar')
  @Patch('datos-personales')
  actualizarDatosPersonales(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: ActualizarDatosPersonalesDto,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.miCuenta.actualizarDatosPersonales(usuario, datos, direccionIp);
  }
}
