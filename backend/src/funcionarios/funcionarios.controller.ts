import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import type { CuentaCreada } from '../usuarios/usuarios.service.js';
import { ConsultarFuncionariosDto } from './dto/consultar-funcionarios.dto.js';
import { EditarFuncionarioDto, RegistrarFuncionarioDto, RegistrarSalidaDto, ReingresoDto } from './dto/datos-de-funcionario.dto.js';
import {
  FuncionariosService,
  type DetalleDeFuncionario,
  type FuncionarioEnLista,
  type OpcionesDeFormulario,
} from './funcionarios.service.js';

/**
 * Funcionarios (la persona). Ver funcionarios.service.ts para las reglas.
 *
 * Consultar la lista o la ficha resumida NO se anota en la bitacora
 * (decision T-4: solo se auditan la apertura del expediente y los
 * documentos, que llegan en la siguiente parte).
 */
@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly funcionarios: FuncionariosService) {}

  /**
   * GET /api/funcionarios?busqueda=&estado=activo&departamentoId=&pagina=1&tamano=20
   * Paginada, por apellidos. La busqueda acepta varias palabras.
   */
  @RequierePermisos('funcionarios.ver')
  @Get()
  consultar(
    @Query() filtros: ConsultarFuncionariosDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<FuncionarioEnLista>> {
    return this.funcionarios.consultar(filtros, quienActua);
  }

  /**
   * GET /api/funcionarios/opciones
   * Listas ACTIVAS para los formularios: departamentos, puestos,
   * profesiones, regimenes, jefaturas posibles y tipos de nombramiento.
   * (Va antes de ":id" para que "opciones" no se tome como un id.)
   */
  @RequierePermisos('funcionarios.ver')
  @Get('opciones')
  opciones(): Promise<OpcionesDeFormulario> {
    return this.funcionarios.opcionesDeFormulario();
  }

  /** GET /api/funcionarios/:id  Ficha completa (ventana "Ver" y pagina "Editar"). */
  @RequierePermisos('funcionarios.ver')
  @Get(':id')
  consultarUno(
    @Param('id', uuidValido('funcionario')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<DetalleDeFuncionario> {
    return this.funcionarios.consultarUno(id, quienActua);
  }

  /**
   * POST /api/funcionarios  (pagina "Registrar funcionario")
   * Con "cuenta": { roles: [...] } crea tambien su cuenta (pide ademas
   * usuarios.crear); la respuesta trae la contrasena temporal UNA sola vez.
   * Errores propios: CEDULA_EN_USO, CORREO_INSTITUCIONAL_EN_USO,
   * NUMERO_EMPLEADO_EN_USO, PUESTO/DEPARTAMENTO/PROFESION/REGIMEN_NO_VALIDO,
   * JEFATURA_NO_VALIDA, FECHA_*_NO_VALIDA, CUENTA_SIN_CORREO_INSTITUCIONAL
   * y los de crear una cuenta (CORREO_EN_USO, ROL_NO_ASIGNABLE, ...).
   */
  @RequierePermisos('funcionarios.ver', 'funcionarios.crear')
  @Post()
  registrar(
    @Body() datos: RegistrarFuncionarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ funcionario: DetalleDeFuncionario; cuenta: CuentaCreada | null }> {
    return this.funcionarios.registrar(datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/funcionarios/:id  (pagina "Editar funcionario")
   * Cambia lo que venga; la cedula y el estado no se cambian por aqui.
   * Errores propios: FUNCIONARIO_PROPIO, SIN_CAMBIOS, JEFATURA_CICLICA y los
   * de registrar.
   */
  @RequierePermisos('funcionarios.ver', 'funcionarios.editar')
  @Patch(':id')
  editar(
    @Param('id', uuidValido('funcionario')) id: string,
    @Body() datos: EditarFuncionarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DetalleDeFuncionario> {
    return this.funcionarios.editar(id, datos, quienActua, direccionIp);
  }

  /**
   * POST /api/funcionarios/:id/salida  { fechaSalida, motivoSalida }
   * Queda inactivo y su cuenta se inactiva a la vez.
   * Errores propios: FUNCIONARIO_YA_INACTIVO, FECHA_SALIDA_NO_VALIDA,
   * FUNCIONARIO_CON_PERSONAL_A_CARGO, CUENTA_CON_MAYOR_ACCESO.
   */
  @RequierePermisos('funcionarios.ver', 'funcionarios.editar')
  @Post(':id/salida')
  @HttpCode(HttpStatus.OK)
  registrarSalida(
    @Param('id', uuidValido('funcionario')) id: string,
    @Body() datos: RegistrarSalidaDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DetalleDeFuncionario> {
    return this.funcionarios.registrarSalida(id, datos, quienActua, direccionIp);
  }

  /**
   * POST /api/funcionarios/:id/reingreso  { fechaIngreso }
   * Vuelve a quedar activo; la cuenta se reactiva aparte, desde Usuarios.
   */
  @RequierePermisos('funcionarios.ver', 'funcionarios.editar')
  @Post(':id/reingreso')
  @HttpCode(HttpStatus.OK)
  reingreso(
    @Param('id', uuidValido('funcionario')) id: string,
    @Body() datos: ReingresoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<DetalleDeFuncionario> {
    return this.funcionarios.reingreso(id, datos, quienActua, direccionIp);
  }
}
