import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import { ConsultarUsuariosDto, type EstadoDeUsuario } from './dto/consultar-usuarios.dto.js';
import { AjustarPermisoDto } from './dto/ajustar-permiso.dto.js';
import { AjustarVariosPermisosDto } from './dto/ajustar-varios-permisos.dto.js';
import { BuscarFuncionariosDisponiblesDto } from './dto/buscar-funcionarios-disponibles.dto.js';
import { CrearUsuarioDto, RolAsignadoDto } from './dto/crear-usuario.dto.js';
import { EditarUsuarioDto } from './dto/editar-usuario.dto.js';
import { UsuariosService, type CuentaCreada } from './usuarios.service.js';

/**
 * Cuentas de usuario del sistema.
 *
 * Una cuenta es el acceso; el funcionario es la persona. No son lo mismo:
 * hay funcionarios sin cuenta, y puede haber cuentas que no correspondan a
 * un funcionario, como la de Informatica.
 */
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /**
   * GET /api/usuarios
   *
   * Lista las cuentas, paginadas y ordenadas por correo. Acepta busqueda por
   * texto y filtros por estado y por rol.
   *
   * Ejemplos:
   *   /api/usuarios?pagina=1&tamano=20
   *   /api/usuarios?busqueda=maria
   *   /api/usuarios?estado=bloqueado
   *   /api/usuarios?rolId=...
   *
   * Consultar la lista NO se anota en la bitacora: por decision de la
   * Municipalidad solo se auditan las operaciones sobre datos y los accesos
   * al expediente, no las consultas generales.
   */
  @RequierePermisos('usuarios.ver')
  @Get()
  consultar(
    @Query() filtros: ConsultarUsuariosDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<unknown>> {
    return this.usuarios.consultar(filtros, quienActua);
  }

  /**
   * GET /api/usuarios/:id
   *
   * Detalle de una cuenta, con sus roles y sus permisos individuales. Es lo
   * que alimenta la pantalla de edicion.
   *
   * El pipe rechaza cualquier cosa que no tenga forma de identificador antes
   * de que llegue a la base, y responde con el formato de error del sistema.
   */
  /**
   * GET /api/usuarios/funcionarios-disponibles?busqueda=...
   *
   * Funcionarios activos que todavia no tienen cuenta (maximo 20), para
   * elegir a quien crearle una. Pide "usuarios.crear".
   *
   * IMPORTANTE: tiene que ir ANTES de GET /usuarios/:id. Nest revisa las
   * rutas en orden y, si fuera despues, tomaria "funcionarios-disponibles"
   * como si fuera un id.
   */
  @RequierePermisos('usuarios.crear')
  @Get('funcionarios-disponibles')
  buscarFuncionariosDisponibles(@Query() filtros: BuscarFuncionariosDisponiblesDto): Promise<unknown[]> {
    return this.usuarios.buscarFuncionariosDisponibles(filtros.busqueda);
  }

  /**
   * Ademas de los datos, devuelve "permisosEfectivos" (lo que la cuenta puede
   * hacer de verdad), "puedoModificar" y "motivoNoModificable"
   * (CUENTA_PROPIA o CUENTA_CON_MAYOR_ACCESO) respecto de quien consulta.
   */
  @RequierePermisos('usuarios.ver')
  @Get(':id')
  consultarUno(
    @Param('id', uuidValido('usuario')) id: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
  ): Promise<unknown> {
    return this.usuarios.consultarUno(id, quienActua);
  }

  /**
   * POST /api/usuarios
   *
   * Crea la cuenta de acceso de un funcionario.
   *
   * El sistema genera la contrasena temporal, se la envia por correo y la
   * devuelve una sola vez en la respuesta, por si el correo no llega. La
   * cuenta queda obligada a cambiarla en el primer ingreso.
   *
   * Quien la crea solo puede asignar roles cuyos permisos tenga todos. Por
   * eso Recursos Humanos no puede crear un Super Administrador.
   *
   * Ejemplo de cuerpo:
   *   {
   *     "funcionarioId": "...",
   *     "roles": [
   *       { "rolId": "id de Solicitante" },
   *       { "rolId": "id de Aprobador", "fechaVencimiento": "2026-10-31" }
   *     ]
   *   }
   *
   * Si no se indica "correo", se usa el institucional del funcionario.
   */
  @RequierePermisos('usuarios.crear')
  @Post()
  crear(
    @Body() datos: CrearUsuarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<CuentaCreada> {
    return this.usuarios.crear(datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/usuarios/:id/estado
   *
   * Activa, inactiva o bloquea una cuenta. El efecto es inmediato: la
   * persona queda fuera en su siguiente peticion.
   *
   * El motivo es obligatorio al inactivar o bloquear, y queda en la bitacora.
   *
   * No se puede cambiar el estado de la propia cuenta, ni el de una cuenta
   * que tenga permisos que uno no tiene.
   *
   * Ejemplo de cuerpo:
   *   { "estado": "bloqueado", "motivo": "Revision de accesos solicitada por TI" }
   */
  @RequierePermisos('usuarios.cambiarEstado')
  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', uuidValido('usuario')) id: string,
    @Body() datos: CambiarEstadoUsuarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ id: string; correo: string; estado: EstadoDeUsuario }> {
    return this.usuarios.cambiarEstado(id, datos, quienActua, direccionIp);
  }

  /**
   * PATCH /api/usuarios/:id
   *
   * Ventana "Editar usuario": cambia el correo de ingreso y/o deja a la
   * cuenta con exactamente la lista de roles indicada (con su vigencia), en
   * una sola transaccion. Cada cambio queda en la bitacora. Si cambio el
   * correo, se avisa a la direccion anterior y a la nueva.
   *
   * Ejemplo de cuerpo:
   *   { "correo": "nuevo@munipalmares.go.cr",
   *     "roles": [ { "rolId": "..." }, { "rolId": "...", "fechaVencimiento": "2026-10-31" } ] }
   *
   * Errores propios: SIN_CAMBIOS, CORREO_EN_USO, CUENTA_SIN_ROL_PERMANENTE,
   * ROL_NO_ASIGNABLE, ROL_NO_QUITABLE, ROL_INACTIVO, FECHA_VENCIMIENTO_PASADA,
   * NO_PUEDE_MODIFICAR_SU_PROPIA_CUENTA, CUENTA_CON_MAYOR_ACCESO.
   * Devuelve el detalle actualizado de la cuenta (igual que GET /usuarios/:id).
   */
  @RequierePermisos('usuarios.editar')
  @Patch(':id')
  editar(
    @Param('id', uuidValido('usuario')) id: string,
    @Body() datos: EditarUsuarioDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.editar(id, datos, quienActua, direccionIp);
  }

  /**
   * POST /api/usuarios/:id/roles
   *
   * Asigna un rol a la cuenta, o cambia la fecha de vencimiento de uno que
   * ya tiene. Sin fecha es permanente; con fecha, el rol deja de contar solo
   * al terminar ese dia (hora de Costa Rica). Es lo que se usa para las
   * suplencias por vacaciones o incapacidad.
   *
   * Ejemplo de cuerpo:
   *   { "rolId": "id de Aprobador", "fechaVencimiento": "2026-10-31" }
   *
   * Responde 200 (no 201) porque puede tanto crear como actualizar.
   * Errores propios: ROL_NO_ENCONTRADO, ROL_INACTIVO, ROL_NO_ASIGNABLE,
   * ROL_YA_ASIGNADO, FECHA_VENCIMIENTO_PASADA, mas los de reglas 3 y 4.
   */
  @RequierePermisos('usuarios.editar')
  @Post(':id/roles')
  @HttpCode(HttpStatus.OK)
  asignarRol(
    @Param('id', uuidValido('usuario')) id: string,
    @Body() datos: RolAsignadoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.asignarRol(id, datos, quienActua, direccionIp);
  }

  /**
   * DELETE /api/usuarios/:id/roles/:rolId
   *
   * Quita un rol a la cuenta (lo vence en este momento; no borra el
   * historial). La cuenta no puede quedar sin ningun rol vigente.
   *
   * Errores propios: ROL_NO_ASIGNADO, ROL_NO_QUITABLE, CUENTA_SIN_ROLES,
   * mas los de reglas 3 y 4.
   */
  @RequierePermisos('usuarios.editar')
  @Delete(':id/roles/:rolId')
  quitarRol(
    @Param('id', uuidValido('usuario')) id: string,
    @Param('rolId', uuidValido('rol')) rolId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.quitarRol(id, rolId, quienActua, direccionIp);
  }

  /**
   * PUT /api/usuarios/:id/permisos/:permisoId
   *
   * Crea o cambia un permiso individual: una excepcion a lo que dan los
   * roles, para conceder (otorgado: true) o quitar (otorgado: false).
   *
   * Ejemplo de cuerpo:
   *   { "otorgado": true, "fechaVencimiento": "2026-10-31",
   *     "observacion": "Cubre a la jefatura durante sus vacaciones" }
   *
   * Errores propios: PERMISO_NO_ENCONTRADO, PERMISO_INACTIVO,
   * PERMISO_NO_ASIGNABLE, PERMISO_SIN_CAMBIO, FECHA_VENCIMIENTO_PASADA,
   * mas los de reglas 3 y 4.
   */
  @RequierePermisos('usuarios.editar')
  @Put(':id/permisos/:permisoId')
  ajustarPermiso(
    @Param('id', uuidValido('usuario')) id: string,
    @Param('permisoId', uuidValido('permiso')) permisoId: string,
    @Body() datos: AjustarPermisoDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.ajustarPermiso(id, permisoId, datos, quienActua, direccionIp);
  }

  /**
   * POST /api/usuarios/:id/permisos
   *
   * Pagina "Agregar excepcion": concede o quita VARIOS permisos de una vez
   * con la misma fecha limite y el mismo motivo (obligatorio). Todo junto o
   * nada; cada permiso queda en la bitacora.
   *
   * Errores propios: los de ajustarPermiso, PERMISO_REPETIDO,
   * FECHA_NO_VALIDA y FECHA_VENCIMIENTO_MUY_LEJANA.
   */
  @RequierePermisos('usuarios.editar')
  @Post(':id/permisos')
  @HttpCode(HttpStatus.OK)
  ajustarVariosPermisos(
    @Param('id', uuidValido('usuario')) id: string,
    @Body() datos: AjustarVariosPermisosDto,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.ajustarVariosPermisos(id, datos, quienActua, direccionIp);
  }

  /**
   * DELETE /api/usuarios/:id/permisos/:permisoId
   *
   * Elimina la excepcion individual: la cuenta vuelve a tener lo que le dan
   * sus roles para ese permiso.
   *
   * Errores propios: PERMISO_INDIVIDUAL_NO_ASIGNADO, PERMISO_NO_ASIGNABLE,
   * mas los de reglas 3 y 4.
   */
  @RequierePermisos('usuarios.editar')
  @Delete(':id/permisos/:permisoId')
  quitarPermisoIndividual(
    @Param('id', uuidValido('usuario')) id: string,
    @Param('permisoId', uuidValido('permiso')) permisoId: string,
    @UsuarioActual() quienActua: UsuarioAutenticado,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<unknown> {
    return this.usuarios.quitarPermisoIndividual(id, permisoId, quienActua, direccionIp);
  }
}
