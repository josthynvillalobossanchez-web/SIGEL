import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Registros (logs) de la aplicacion: todo lo que el sistema anota con
 * Logger (arranque, errores 500 con su traza, avisos, ingresos correctos...)
 * sale en la consola, como siempre, Y ademas se guarda en archivos de texto.
 *
 * Decision de Josthyn (30/09): se guardan en una carpeta DENTRO del proyecto
 * y TI decide despues que hace con ella (respaldo, limpieza). Por defecto:
 *
 *   backend/registros/sinergia-AAAA-MM-DD.log   (un archivo por dia, hora de Costa Rica)
 *
 * La carpeta se cambia con RUTA_REGISTROS en el .env. No se borra nada
 * automaticamente. La carpeta NO se sube a git (.gitignore).
 *
 * NUNCA deben llegar aqui contrasenas, codigos de recuperacion, tokens ni la
 * DATABASE_URL: por eso el correo simulado (que trae la contrasena temporal y
 * el codigo) se imprime solo en consola (ver correo.service.ts), y en los
 * registros de errores solo va el metodo y la ruta, nunca el cuerpo.
 *
 * Uso (main.ts):
 *   NestFactory.create(AppModule, { logger: new RegistrosDeSinergia(process.env.RUTA_REGISTROS) })
 */
export class RegistrosDeSinergia extends ConsoleLogger {
  private readonly carpeta: string;
  private archivo: WriteStream | null = null;
  private diaDelArchivo = '';

  constructor(carpeta?: string) {
    super();
    this.carpeta = resolve(carpeta?.trim() || './registros');
    mkdirSync(this.carpeta, { recursive: true });
  }

  /** Donde quedan los archivos (para anotarlo al arrancar). */
  get ruta(): string {
    return this.carpeta;
  }

  override log(mensaje: unknown, ...extra: unknown[]): void {
    super.log(mensaje, ...extra);
    this.guardar('log', mensaje, extra);
  }

  override warn(mensaje: unknown, ...extra: unknown[]): void {
    super.warn(mensaje, ...extra);
    this.guardar('warn', mensaje, extra);
  }

  override error(mensaje: unknown, ...extra: unknown[]): void {
    super.error(mensaje, ...extra);
    this.guardar('error', mensaje, extra);
  }

  override fatal(mensaje: unknown, ...extra: unknown[]): void {
    super.fatal(mensaje, ...extra);
    this.guardar('fatal', mensaje, extra);
  }

  // debug y verbose solo van a la consola: son para quien programa.

  /**
   * Una linea por mensaje: "2026-09-30 14:03:22 [WARN] [Errores] texto".
   * Nest pasa el contexto como ultimo parametro de texto; en error() puede
   * venir antes la traza (stack), que se guarda en las lineas siguientes.
   */
  private guardar(nivel: LogLevel, mensaje: unknown, extra: unknown[]): void {
    try {
      const textos = extra.filter((x): x is string => typeof x === 'string');
      const contexto = textos.length > 0 ? textos[textos.length - 1] : (this.context ?? '');
      const traza = nivel === 'error' && textos.length > 1 ? textos[0] : null;
      const cuerpo = typeof mensaje === 'string' ? mensaje : JSON.stringify(mensaje);
      const { dia, hora } = ahoraEnCostaRica();
      let linea = `${dia} ${hora} [${nivel.toUpperCase()}]${contexto ? ` [${contexto}]` : ''} ${cuerpo}\n`;
      if (traza) linea += `${traza}\n`;
      this.archivoDelDia(dia).write(linea);
    } catch {
      // Si el disco falla, la aplicacion sigue: el mensaje ya salio en consola.
    }
  }

  /** Abre (o cambia a medianoche) el archivo del dia. */
  private archivoDelDia(dia: string): WriteStream {
    if (!this.archivo || dia !== this.diaDelArchivo) {
      this.archivo?.end();
      this.archivo = createWriteStream(join(this.carpeta, `sinergia-${dia}.log`), { flags: 'a', encoding: 'utf8' });
      this.diaDelArchivo = dia;
    }
    return this.archivo;
  }
}

/** Fecha y hora de Costa Rica (UTC-6, sin horario de verano). */
function ahoraEnCostaRica(): { dia: string; hora: string } {
  const texto = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  return { dia: texto.slice(0, 10), hora: texto.slice(11, 19) };
}
