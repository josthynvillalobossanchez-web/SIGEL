import { Injectable, Logger } from '@nestjs/common';

/** Un correo que el sistema quiere enviar. */
export interface MensajeDeCorreo {
  para: string;
  asunto: string;
  cuerpo: string;
}

/**
 * Salida de correo del sistema.
 *
 * Todo el envio pasa por aqui, de modo que el resto del codigo nunca sepa
 * como se manda un correo. Eso permite que hoy, sin los datos del servidor
 * de la Municipalidad, el codigo de recuperacion se imprima en la consola y
 * el desarrollo pueda seguir; y que el dia que TI entregue esos datos solo
 * haya que tocar este archivo.
 *
 * El transporte se elige con CORREO_TRANSPORTE en el .env:
 *   consola  imprime el mensaje en la terminal (desarrollo)
 *   smtp     envia de verdad (pendiente, ver COSAS_POR_CORREGIR)
 */
@Injectable()
export class CorreoService {
  private readonly registro = new Logger(CorreoService.name);

  async enviar(mensaje: MensajeDeCorreo): Promise<void> {
    const transporte = process.env.CORREO_TRANSPORTE ?? 'consola';

    if (transporte === 'consola') {
      this.registro.warn(
        [
          '',
          '--- CORREO SIMULADO (no se envio nada de verdad) ---',
          `Para:   ${mensaje.para}`,
          `Asunto: ${mensaje.asunto}`,
          '',
          mensaje.cuerpo,
          '----------------------------------------------------',
        ].join('\n'),
      );
      return Promise.resolve();
    }

    /**
     * Aqui va el envio real cuando TI entregue servidor, puerto, cuenta y
     * si exige TLS. La implementacion esperada es nodemailer leyendo esos
     * valores del .env. Hasta entonces se falla de frente, en vez de fingir
     * que el correo salio.
     */
    throw new Error(
      `CORREO_TRANSPORTE="${transporte}" todavia no esta implementado. ` +
        'Use "consola" mientras no esten los datos del servidor de correo.',
    );
  }
}
