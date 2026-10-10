import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { GuardarRegimenDto } from './dto/reglas-de-vacaciones.dto.js';
import { ReglasDeVacacionesService, type RegimenDeVacaciones } from './reglas-de-vacaciones.service.js';

/** Reglas de vacaciones por regimen (HU 27 CA04). Solo RRHH (catalogos.editar). */
@Controller('reglas-vacaciones')
export class ReglasDeVacacionesController {
  constructor(private readonly reglas: ReglasDeVacacionesService) {}

  /** GET /api/reglas-vacaciones  Los regimenes con sus tramos, tope y aviso. */
  @RequierePermisos('catalogos.editar')
  @Get()
  consultar(): Promise<RegimenDeVacaciones[]> {
    return this.reglas.consultar();
  }

  /**
   * PUT /api/reglas-vacaciones/:regimenId
   * { descripcion?, periodosMaximosAcumulables, diasAvisoAntesDeVencer, tramos: [{ aniosMinimos, aniosMaximos|null, diasPorPeriodo }] }
   * Errores: REGLA_NO_VALIDA (tramos con huecos o mal cerrados), SIN_CAMBIOS, REGIMEN_NO_ENCONTRADO.
   */
  @RequierePermisos('catalogos.editar')
  @Put(':regimenId')
  guardar(
    @Param('regimenId', uuidValido('régimen')) regimenId: string,
    @Body() datos: GuardarRegimenDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<RegimenDeVacaciones> {
    return this.reglas.guardar(regimenId, datos, quienActua, direccionIp);
  }
}
