import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

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
 * como se manda un correo.
 *
 * El transporte se elige con CORREO_TRANSPORTE en el .env:
 *   consola  imprime el mensaje en la terminal, sin enviar nada (desarrollo)
 *   smtp     envia de verdad por SMTP
 *
 * Cuenta de envio (Joseph, 30/09/2026): una cuenta de Gmail que ya usa la
 * Municipalidad para esto (no es del dominio institucional). Gmail pide una
 * "contrasena de aplicacion" (cuenta con verificacion en dos pasos); la
 * contrasena normal de la cuenta NO sirve por SMTP. Los datos van en el .env
 * del servidor (CORREO_*), nunca en el codigo ni en git. Pasos en
 * docs/GUIA_DESARROLLO.md, seccion 10.
 *
 * Gmail:  CORREO_SERVIDOR=smtp.gmail.com  CORREO_PUERTO=465
 *
 * Seguridad: el envio siempre va cifrado. Puerto 465 = TLS desde el inicio;
 * cualquier otro puerto (587) exige STARTTLS o no envia. Nunca se desactiva
 * la verificacion del certificado del servidor de correo.
 */
@Injectable()
export class CorreoService implements OnModuleInit {
  private readonly registro = new Logger(CorreoService.name);
  private readonly transporte = (process.env.CORREO_TRANSPORTE ?? 'consola').trim();
  private smtp: Transporter | null = null;
  private remitente = '';

  /**
   * Al arrancar, con smtp, se arma la conexion y se prueba contra el
   * servidor. Si falla, la aplicacion arranca igual (el resto no depende del
   * correo) y queda el error en los registros para que TI lo revise. Si
   * falta alguna variable, si se detiene: es un error de configuracion.
   */
  onModuleInit(): void {
    if (this.transporte === 'consola') {
      this.registro.warn('Correo en modo consola: los mensajes se imprimen en la terminal y no se envían.');
      return;
    }
    if (this.transporte !== 'smtp') {
      throw new Error(`CORREO_TRANSPORTE="${this.transporte}" no existe. Use "consola" o "smtp".`);
    }

    const servidor = variable('CORREO_SERVIDOR');
    const puerto = Number(variable('CORREO_PUERTO'));
    const usuario = variable('CORREO_USUARIO');
    const contrasena = variable('CORREO_CONTRASENA');
    if (!Number.isInteger(puerto) || puerto <= 0) throw new Error('CORREO_PUERTO debe ser un número (465 para Gmail).');
    // Nombre visible + la misma cuenta: Gmail cambia el remitente si no es la cuenta que envia.
    const nombre = process.env.CORREO_NOMBRE_REMITENTE?.trim() || 'SINERGIA - Municipalidad de Palmares';
    this.remitente = `"${nombre.replace(/"/g, '')}" <${usuario}>`;

    this.smtp = nodemailer.createTransport({
      host: servidor,
      port: puerto,
      secure: puerto === 465, // 465: TLS desde el inicio
      requireTLS: puerto !== 465, // otro puerto: STARTTLS obligatorio
      auth: { user: usuario, pass: contrasena },
      tls: { minVersion: 'TLSv1.2' },
      // Que una peticion no se quede colgada si el servidor no responde.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    // La prueba corre aparte: si el servidor tarda, SINERGIA no espera para arrancar.
    this.smtp.verify().then(
      () => this.registro.log(`Correo listo: ${servidor}:${puerto} como ${usuario}.`),
      (error: unknown) =>
        // Nunca se anota la contrasena: solo el motivo que da el servidor.
        this.registro.error(
          `No se pudo conectar con el correo (${servidor}:${puerto} como ${usuario}). Revise CORREO_* en el .env. Motivo: ${motivo(error)}`,
        ),
    );
  }

  async enviar(mensaje: MensajeDeCorreo): Promise<void> {
    if (!this.smtp) {
      // Solo a la CONSOLA, nunca a los archivos de registros: el mensaje trae
      // la contrasena temporal o el codigo de recuperacion (ver comun/registros.ts).
      process.stdout.write(
        [
          '',
          '--- CORREO SIMULADO (no se envió nada de verdad) ---',
          `Para:   ${mensaje.para}`,
          `Asunto: ${mensaje.asunto}`,
          '',
          mensaje.cuerpo,
          '----------------------------------------------------',
          '',
        ].join('\n'),
      );
      this.registro.warn(`Correo simulado a ${mensaje.para}: "${mensaje.asunto}" (el contenido se ve solo en la consola).`);
      return;
    }

    try {
      await this.smtp.sendMail({ from: this.remitente, to: mensaje.para, subject: mensaje.asunto, text: mensaje.cuerpo });
      // Solo destinatario y asunto: el cuerpo puede traer contrasenas o codigos.
      this.registro.log(`Correo enviado a ${mensaje.para}: "${mensaje.asunto}".`);
    } catch (error) {
      // Quien llama decide si el fallo detiene la operacion; aqui se lanza
      // un error limpio, sin el cuerpo del mensaje.
      throw new Error(`No se pudo enviar el correo a ${mensaje.para}: ${motivo(error)}`);
    }
  }
}

/** Lee una variable obligatoria del .env (modo smtp). */
function variable(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) throw new Error(`Falta ${nombre} en el .env (CORREO_TRANSPORTE=smtp).`);
  return valor;
}

/** Motivo corto de un error de envio, sin datos sensibles. */
function motivo(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; responseCode?: number; message?: string };
    return [e.code, e.responseCode, e.message?.split('\n')[0]].filter(Boolean).join(' ');
  }
  return String(error);
}
