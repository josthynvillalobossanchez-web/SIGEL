import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * Comprueba que un parametro de la ruta sea un identificador valido, y
 * responde en el formato de error del sistema si no lo es.
 *
 *   @Get(':id')
 *   consultarUno(@Param('id', uuidValido('usuario')) id: string) { ... }
 *
 * Sin esto, el ParseUUIDPipe de Nest lanza su propio error con un texto en
 * ingles que el filtro global descarta por seguridad, dejando al cliente con
 * un mensaje generico. Vale mas dar uno propio, claro y en espaniol.
 *
 * Ademas evita consultas de mas: si el identificador ni siquiera tiene forma
 * de identificador, no hace falta ir a preguntarle nada a la base de datos.
 */
export function uuidValido(queCosa = 'registro'): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        codigo: 'IDENTIFICADOR_INVALIDO',
        message: `El identificador de ${queCosa} indicado no es valido.`,
      }),
  });
}
