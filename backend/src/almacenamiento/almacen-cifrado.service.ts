import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cifrar, descifrar, ErrorDeCifrado, versionDeLlaveDe } from './cifrado-de-archivos.js';

/** Carpetas de primer nivel dentro de RUTA_ARCHIVOS. */
export type CategoriaDeArchivo = 'expedientes' | 'fotos';

/** UUID en minusculas, como los genera randomUUID() y la base de datos. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Forma unica que puede tener una ruta guardada: categoria/funcionario/archivo.enc */
const RUTA_VALIDA = new RegExp(`^(expedientes|fotos)/${UUID}/${UUID}\\.enc$`);

/**
 * Almacen de archivos cifrados del expediente (y fotos de perfil).
 *
 * Que hace: recibe el contenido en claro, lo cifra con AES-256-GCM y lo
 * guarda en RUTA_ARCHIVOS (por omision backend/archivos), organizado por
 * funcionario y con un nombre generado (nunca el original). Devuelve la ruta
 * RELATIVA, que es lo unico que va a la base de datos. Al leer, descifra en
 * memoria. Jamas se sirve la carpeta como publica: todo pasa por el backend.
 *
 * La llave (ARCHIVOS_LLAVE) vive solo en el .env del servidor, nunca en git
 * ni en la base. Si falta o es invalida, el backend NO arranca: es preferible
 * a guardar documentos sin cifrar por un descuido.
 *
 * Rotacion de llave: cada archivo guarda con cual version se cifro. Para
 * cambiar la llave se sube ARCHIVOS_LLAVE_VERSION, la anterior pasa a
 * ARCHIVOS_LLAVES_ANTERIORES ("1:base64,2:base64") y los archivos viejos
 * siguen abriendo. Para recifrar los viejos con la nueva: `npm run
 * archivos:recifrar` (prisma/recifrar-archivos.ts, GUIA_DESARROLLO.md §10.6).
 */
@Injectable()
export class AlmacenCifradoService {
  private readonly registro = new Logger('Archivos');
  private readonly base: string;
  private readonly versionActual: number;
  private readonly llaves = new Map<number, Buffer>();

  constructor(config: ConfigService) {
    this.base = resolve(config.get<string>('RUTA_ARCHIVOS')?.trim() || './archivos');

    this.versionActual = Number(config.get<string>('ARCHIVOS_LLAVE_VERSION')?.trim() || '1');
    if (!Number.isInteger(this.versionActual) || this.versionActual < 1 || this.versionActual > 65535) {
      throw new Error('ARCHIVOS_LLAVE_VERSION debe ser un número entero entre 1 y 65535.');
    }

    this.llaves.set(this.versionActual, leerLlave('ARCHIVOS_LLAVE', config.get<string>('ARCHIVOS_LLAVE')));

    // Llaves anteriores, para poder abrir archivos cifrados antes de una rotacion.
    const anteriores = config.get<string>('ARCHIVOS_LLAVES_ANTERIORES')?.trim();
    if (anteriores) {
      for (const par of anteriores.split(',')) {
        const [version, valor] = par.split(':');
        const numero = Number(version);
        if (!Number.isInteger(numero) || numero < 1 || numero === this.versionActual) {
          throw new Error('ARCHIVOS_LLAVES_ANTERIORES debe ser "version:llave,version:llave" con versiones distintas de la actual.');
        }
        this.llaves.set(numero, leerLlave(`ARCHIVOS_LLAVES_ANTERIORES (versión ${numero})`, valor));
      }
    }
  }

  /**
   * Cifra y guarda. Devuelve la ruta relativa (categoria/funcionario/uuid.enc).
   * Se escribe primero a un archivo temporal y se renombra, para que nunca
   * quede un archivo a medias si el servidor se cae.
   */
  async guardar(categoria: CategoriaDeArchivo, funcionarioId: string, contenido: Buffer): Promise<string> {
    const ruta = `${categoria}/${funcionarioId}/${randomUUID()}.enc`;
    if (!RUTA_VALIDA.test(ruta)) throw new Error('Ruta de archivo no válida.');
    const destino = this.resolverRuta(ruta);

    const paquete = cifrar(contenido, this.llaves.get(this.versionActual)!, this.versionActual, ruta);
    await mkdir(dirname(destino), { recursive: true, mode: 0o700 });
    const temporal = `${destino}.tmp`;
    await writeFile(temporal, paquete, { mode: 0o600 });
    await rename(temporal, destino);
    return ruta;
  }

  /** Lee y descifra. Si falla, responde un error generico y deja el detalle en los registros. */
  async leer(ruta: string): Promise<Buffer> {
    const destino = this.resolverRuta(ruta);
    try {
      const paquete = await readFile(destino);
      const llave = this.llaves.get(versionDeLlaveDe(paquete));
      if (!llave) throw new ErrorDeCifrado('El archivo se cifró con una llave que ya no está configurada.');
      return descifrar(paquete, llave, ruta);
    } catch (error) {
      // El detalle va al registro del servidor; la ruta no es secreta, pero el contenido nunca se anota.
      this.registro.error(`No se pudo leer el archivo ${ruta}: ${error instanceof Error ? error.message : String(error)}`);
      throw new InternalServerErrorException({
        codigo: 'ARCHIVO_NO_DISPONIBLE',
        message: 'No se pudo abrir el archivo. Avise al Departamento de TI.',
      });
    }
  }

  /**
   * Quita un archivo que se acaba de guardar pero cuyo registro en la base no
   * se pudo completar (para no dejar huerfanos). Solo para ese caso: los
   * documentos dados de baja NUNCA se borran del disco.
   */
  async descartarRecienGuardado(ruta: string): Promise<void> {
    try {
      await unlink(this.resolverRuta(ruta));
    } catch (error) {
      this.registro.warn(`No se pudo limpiar el archivo huérfano ${ruta}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Convierte la ruta relativa en absoluta, verificando que no se salga de la carpeta de archivos. */
  private resolverRuta(ruta: string): string {
    if (!RUTA_VALIDA.test(ruta)) throw new Error('Ruta de archivo no válida.');
    const absoluta = resolve(join(this.base, ...ruta.split('/')));
    if (!absoluta.startsWith(this.base + sep)) throw new Error('Ruta de archivo fuera de la carpeta permitida.');
    return absoluta;
  }
}

/** Lee una llave en base64 y exige 32 bytes exactos. Nunca imprime su valor. */
function leerLlave(nombre: string, valor: string | undefined): Buffer {
  const texto = valor?.trim();
  const ayuda = 'Genere una con "npm run archivos:generar-llave" y péguela en el .env (ver GUIA_DESARROLLO.md, cifrado de archivos).';
  if (!texto) throw new Error(`Falta ${nombre} en el .env. ${ayuda}`);
  const llave = Buffer.from(texto, 'base64');
  if (llave.length !== 32) throw new Error(`${nombre} debe ser una llave de 32 bytes en base64. ${ayuda}`);
  return llave;
}
