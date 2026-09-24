import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AutenticacionService } from './autenticacion.service.js';
import { COOKIE_SESION, opcionesCookie } from './cookie-sesion.js';
import { DireccionIp } from '../comun/decoradores.js';
import { PermitirConContrasenaTemporal, Publico, UsuarioActual } from './decoradores.js';
import { CambiarContrasenaDto } from './dto/cambiar-contrasena.dto.js';
import { RestablecerContrasenaDto } from './dto/restablecer-contrasena.dto.js';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto.js';
import type { UsuarioAutenticado } from './tipos.js';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto.js';

/**
 * El controlador no decide nada: recibe la peticion, deja que el DTO la
 * valide y se la pasa al servicio. Toda la regla de negocio vive alla.
 *
 * Lo unico propio de esta capa es el manejo de la cookie de sesion, que es
 * cosa del transporte y no del negocio.
 */
@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly autenticacion: AutenticacionService) {}

  /**
   * POST /api/autenticacion/iniciar-sesion
   *
   * El limite por IP cubre lo que el bloqueo de cuenta no puede: alguien que
   * prueba correos distintos, porque si el correo no existe no hay cuenta que
   * bloquear. Diez intentos por minuto desde la misma direccion.
   */
  @Publico()
  @Post('iniciar-sesion')
  @HttpCode(HttpStatus.OK) // por omision un POST responde 201; aqui no se crea nada
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async iniciarSesion(
    @Body() datos: IniciarSesionDto,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<{ usuario: { id: string; correo: string; debeCambiarContrasena: boolean } }> {
    const sesion = await this.autenticacion.iniciarSesion(datos);

    respuesta.cookie(COOKIE_SESION, sesion.token, opcionesCookie(sesion.duracionMs));

    // El token no sale en el cuerpo: solo va en la cookie.
    return { usuario: sesion.usuario };
  }

  /**
   * POST /api/autenticacion/cerrar-sesion
   *
   * Borra la cookie del navegador. Ojo: el token sigue siendo valido hasta
   * que expira, asi que esto no revoca la sesion del lado del servidor. Eso
   * esta anotado como pendiente para produccion.
   */
  @Publico()
  @Post('cerrar-sesion')
  @HttpCode(HttpStatus.OK)
  cerrarSesion(@Res({ passthrough: true }) respuesta: Response): { mensaje: string } {
    respuesta.clearCookie(COOKIE_SESION, opcionesCookie(0));
    return { mensaje: 'Sesion cerrada.' };
  }

  /**
   * GET /api/autenticacion/mi-sesion
   *
   * Devuelve los datos de la persona que tiene la sesion abierta: su
   * identificador, su correo, si esta obligada a cambiar la contrasena, sus
   * roles y la lista completa de permisos que le corresponden.
   *
   * El frontend lo llama apenas carga, para armar el menu y esconder los
   * botones que esa persona no puede usar. Esconderlos es comodidad, no
   * seguridad: el permiso se vuelve a verificar en el backend cada vez que
   * se ejecuta la operacion.
   *
   * No recibe ningun parametro a proposito: la identidad sale de la cookie
   * de sesion, nunca de algo que el cliente pueda escribir.
   */
  @PermitirConContrasenaTemporal()
  @Get('mi-sesion')
  consultarMiSesion(@UsuarioActual() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }

  /**
   * POST /api/autenticacion/cambiar-contrasena
   *
   * Cambia la contrasena de quien tiene la sesion abierta. Cubre los dos
   * casos: el cambio obligatorio del primer ingreso y el cambio voluntario
   * desde la pantalla "Mi cuenta".
   *
   * Lleva @PermitirConContrasenaTemporal porque, si no, quien entra por
   * primera vez quedaria atrapado: el guard le bloquearia justamente el
   * endpoint que necesita para desbloquearse.
   *
   * El limite por IP es mas estrecho que el del login porque aqui se esta
   * adivinando la contrasena de una cuenta concreta.
   */
  @PermitirConContrasenaTemporal()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cambiar-contrasena')
  @HttpCode(HttpStatus.OK)
  async cambiarContrasena(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: CambiarContrasenaDto,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ mensaje: string }> {
    await this.autenticacion.cambiarContrasenaPropia(usuario.id, datos, direccionIp);
    return { mensaje: 'Contrasena actualizada.' };
  }

  /**
   * POST /api/autenticacion/solicitar-recuperacion
   *
   * Paso 1 de "Olvide mi contrasena": envia un codigo de 6 digitos al correo
   * de la cuenta. El codigo vence en 15 minutos y solo sirve una vez.
   *
   * Responde SIEMPRE lo mismo, exista o no la cuenta. Si respondiera
   * distinto, cualquiera podria usar este endpoint para averiguar que
   * correos estan registrados en la Municipalidad.
   *
   * El limite por IP es estrecho porque cada llamada manda un correo: sin
   * el, alguien podria inundar de mensajes el buzon de un funcionario.
   */
  @Publico()
  @Throttle({ default: { limit: 3, ttl: 900_000 } }) // 3 cada 15 minutos
  @Post('solicitar-recuperacion')
  @HttpCode(HttpStatus.OK)
  async solicitarRecuperacion(@Body() datos: SolicitarRecuperacionDto): Promise<{ mensaje: string }> {
    await this.autenticacion.solicitarRecuperacion(datos);

    return {
      mensaje: 'Si el correo corresponde a una cuenta activa, recibira un codigo en unos minutos.',
    };
  }

  /**
   * POST /api/autenticacion/restablecer-contrasena
   *
   * Paso 2 de "Olvide mi contrasena": cambia la contrasena usando el codigo
   * que llego al correo.
   *
   * A diferencia del cambio desde "Mi cuenta", aqui no se pide la contrasena
   * actual, porque precisamente el caso es que la persona no la recuerda. Lo
   * que demuestra su identidad es tener acceso al correo institucional.
   */
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 900_000 } }) // 5 cada 15 minutos
  @Post('restablecer-contrasena')
  @HttpCode(HttpStatus.OK)
  async restablecerContrasena(
    @Body() datos: RestablecerContrasenaDto,
    @DireccionIp() direccionIp: string | undefined,
  ): Promise<{ mensaje: string }> {
    await this.autenticacion.restablecerContrasenaConCodigo(datos, direccionIp);
    return { mensaje: 'Contrasena restablecida. Ya puede iniciar sesion.' };
  }
}
