import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequierePermisos, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { DireccionIp } from '../comun/decoradores.js';
import type { PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { uuidValido } from '../comun/pipes/uuid.pipe.js';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import { ConsultarUsuariosDto, type EstadoDeUsuario } from './dto/consultar-usuarios.dto.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
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
  consultar(@Query() filtros: ConsultarUsuariosDto): Promise<PaginaDeResultados<unknown>> {
    return this.usuarios.consultar(filtros);
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
  @RequierePermisos('usuarios.ver')
  @Get(':id')
  consultarUno(@Param('id', uuidValido('usuario')) id: string): Promise<unknown> {
    return this.usuarios.consultarUno(id);
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
}
