import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { ActualizarDatosLaboralesDto, ActualizarDatosPersonalesDto } from './dto/actualizar-datos-personales.dto.js';
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
   * Perfil de la pantalla "Mi cuenta": datos de la cuenta, ficha completa
   * del funcionario (si tiene), profesiones y, para RRHH, las listas del
   * formulario laboral. Solo pide tener sesion.
   */
  @Get()
  consultar(@UsuarioActual() usuario: UsuarioAutenticado): Promise<unknown> {
    return this.miCuenta.consultar(usuario);
  }

  /**
   * PATCH /api/mi-cuenta/datos-personales
   * La persona actualiza sus datos personales: nombre, apellidos, fecha de
   * nacimiento, profesion y contacto (la cedula no). Pide perfilPropio.editar.
   * Queda en la bitacora.
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

  /**
   * PATCH /api/mi-cuenta/datos-laborales
   * Recursos Humanos actualiza SUS PROPIOS datos laborales (puesto,
   * departamento, jefatura, nombramiento, regimen, ingreso, codigo). Pide
   * funcionarios.editar: quien no es RRHH solo los ve. Queda en la bitacora.
   */
  @RequierePermisos('funcionarios.editar')
  @Patch('datos-laborales')
  actualizarDatosLaborales(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: ActualizarDatosLaboralesDto,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.miCuenta.actualizarDatosLaborales(usuario, datos, direccionIp);
  }
}
