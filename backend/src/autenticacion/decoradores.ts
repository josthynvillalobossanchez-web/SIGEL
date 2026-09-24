import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PeticionAutenticada, UsuarioAutenticado } from './tipos.js';

export const CLAVE_PUBLICO = 'esPublico';

/**
 * Marca una ruta como abierta, sin sesion.
 *
 * La regla del sistema es al reves de lo habitual: todo esta cerrado por
 * omision y solo se abre lo que lleva este decorador. Asi, si alguien agrega
 * un endpoint y se olvida de protegerlo, queda protegido igual.
 */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/**
 * Entrega el usuario de la sesion al controlador.
 *
 *   consultar(@UsuarioActual() usuario: UsuarioAutenticado) { ... }
 *
 * Nunca se toma el identificador del usuario desde el cuerpo o la URL de la
 * peticion: siempre desde aqui, que es lo unico que el cliente no puede
 * falsificar.
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado | undefined => {
    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    return peticion.usuario;
  },
);

export const CLAVE_PERMISOS = 'permisosRequeridos';

/**
 * Exige uno o varios permisos para poder ejecutar la operacion.
 *
 *   @RequierePermisos('funcionarios.crear')
 *   @Post()
 *   registrarFuncionario(...) { ... }
 *
 * Si se indican varios, la persona debe tenerlos TODOS. Es la opcion
 * prudente: si hiciera falta "uno u otro", se separan en dos endpoints.
 *
 * Las claves siguen siempre el patron "modulo.accion" y deben existir en la
 * tabla "permiso". Si se escribe una clave que no esta sembrada, nadie va a
 * poder usar ese endpoint, porque ningun rol la tendra asignada.
 */
export const RequierePermisos = (...claves: string[]) => SetMetadata(CLAVE_PERMISOS, claves);

export const CLAVE_CONTRASENA_TEMPORAL = 'permitidoConContrasenaTemporal';

/**
 * Permite usar el endpoint aunque la persona todavia tenga la contrasena
 * temporal del primer ingreso.
 *
 * Mientras "debeCambiarContrasena" este en true, el guard de sesion bloquea
 * TODA la API salvo lo marcado con este decorador. La idea es que alguien
 * que entra por primera vez solo pueda hacer tres cosas: ver quien es,
 * cambiar su contrasena y cerrar sesion. Nada mas.
 */
export const PermitirConContrasenaTemporal = () => SetMetadata(CLAVE_CONTRASENA_TEMPORAL, true);
