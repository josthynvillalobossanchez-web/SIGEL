import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';

/** Un error de validacion por campo, con la ruta completa (por ejemplo "lines.0.quantity"). */
export interface ErrorDeCampo {
  field: string;
  message: string;
}

function porCampo(errores: ValidationError[], padre = ''): ErrorDeCampo[] {
  return errores.flatMap((e) => {
    const ruta = padre ? `${padre}.${e.property}` : e.property;
    const propios = Object.values(e.constraints ?? {}).map((message) => ({ field: ruta, message }));
    return [...propios, ...porCampo(e.children ?? [], ruta)];
  });
}

/**
 * El ValidationPipe global de siempre, con un agregado (23/10/2026, ARCA):
 * ademas de la lista de mensajes que ya usaba el sistema ("message", que el
 * filtro de excepciones convierte en "detalles"), el error trae "fieldErrors"
 * con el campo de cada mensaje. La interfaz de ARCA marca con eso el campo
 * con error. Para el resto del sistema la respuesta no cambia.
 */
export class ValidacionConCampos extends ValidationPipe {
  public override createExceptionFactory() {
    return (errores: ValidationError[] = []) =>
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: this.flattenValidationErrors(errores),
        code: 'VALIDATION_ERROR',
        fieldErrors: porCampo(errores),
      });
  }
}
