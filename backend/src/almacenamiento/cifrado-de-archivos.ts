import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/*
 * Cifrado de los archivos del expediente (AES-256-GCM).
 *
 * Son funciones puras: reciben la llave y el contenido, devuelven bytes. No
 * tocan el disco ni el .env (eso lo hace AlmacenCifradoService), asi se
 * pueden probar y entender por separado.
 *
 * Por que AES-256-GCM: cifra Y ademas detecta cualquier alteracion. Si
 * alguien cambia un solo byte del archivo guardado, o lo copia a otro
 * nombre, descifrar falla en lugar de entregar basura.
 *
 * Formato del archivo guardado (todo en binario):
 *
 *   "SNRG"      4 bytes  marca de SINERGIA, para reconocer el formato
 *   formato     1 byte   version del formato (hoy 1)
 *   versionLlave 2 bytes  cual llave se uso (permite rotar la llave despues)
 *   iv         12 bytes  numero unico al azar POR ARCHIVO (nunca se repite)
 *   cifrado     N bytes  el contenido cifrado
 *   etiqueta   16 bytes  sello de autenticidad de GCM
 *
 * Los datos autenticados (AAD) son la marca, el formato, la version de la
 * llave y el "contexto" (la ruta relativa del archivo). Por eso un archivo
 * cifrado copiado a la ruta de otro documento NO se puede descifrar.
 */

const MARCA = Buffer.from('SNRG', 'ascii');
const VERSION_DE_FORMATO = 1;
const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;
/** marca (4) + formato (1) + versionLlave (2) + iv (12) */
const LARGO_CABECERA = 19;
/** Parte de la cabecera que entra como dato autenticado (sin el iv). */
const LARGO_AUTENTICADO = 7;

/** Error al cifrar o descifrar. El mensaje es para el registro del servidor, no para la persona. */
export class ErrorDeCifrado extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeCifrado';
  }
}

/** Cifra "contenido" con "llave" (32 bytes). "contexto" es la ruta relativa del archivo. */
export function cifrar(contenido: Buffer, llave: Buffer, versionLlave: number, contexto: string): Buffer {
  if (llave.length !== 32) throw new ErrorDeCifrado('La llave de cifrado debe tener 32 bytes.');
  const iv = randomBytes(LARGO_IV);

  const cabecera = Buffer.alloc(LARGO_CABECERA);
  MARCA.copy(cabecera, 0);
  cabecera.writeUInt8(VERSION_DE_FORMATO, 4);
  cabecera.writeUInt16BE(versionLlave, 5);
  iv.copy(cabecera, LARGO_AUTENTICADO);

  const cifrador = createCipheriv('aes-256-gcm', llave, iv);
  cifrador.setAAD(datosAutenticados(cabecera, contexto));
  const cifrado = Buffer.concat([cifrador.update(contenido), cifrador.final()]);
  return Buffer.concat([cabecera, cifrado, cifrador.getAuthTag()]);
}

/** Lee de la cabecera con cual version de llave se cifro el archivo. */
export function versionDeLlaveDe(paquete: Buffer): number {
  if (paquete.length < LARGO_CABECERA + LARGO_ETIQUETA || !paquete.subarray(0, 4).equals(MARCA)) {
    throw new ErrorDeCifrado('El archivo no tiene el formato cifrado de SINERGIA.');
  }
  if (paquete.readUInt8(4) !== VERSION_DE_FORMATO) {
    throw new ErrorDeCifrado(`Formato de archivo cifrado no reconocido (${paquete.readUInt8(4)}).`);
  }
  return paquete.readUInt16BE(5);
}

/** Descifra. Falla si la llave es otra, si el archivo se altero o si se movio de ruta. */
export function descifrar(paquete: Buffer, llave: Buffer, contexto: string): Buffer {
  versionDeLlaveDe(paquete); // valida marca y formato
  const cabecera = paquete.subarray(0, LARGO_CABECERA);
  const iv = cabecera.subarray(LARGO_AUTENTICADO, LARGO_CABECERA);
  const etiqueta = paquete.subarray(paquete.length - LARGO_ETIQUETA);
  const cifrado = paquete.subarray(LARGO_CABECERA, paquete.length - LARGO_ETIQUETA);

  try {
    const descifrador = createDecipheriv('aes-256-gcm', llave, iv);
    descifrador.setAAD(datosAutenticados(cabecera, contexto));
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]);
  } catch {
    // Mensaje unico a proposito: no se distingue "llave mala" de "archivo alterado".
    throw new ErrorDeCifrado('No se pudo descifrar el archivo: llave incorrecta o archivo alterado.');
  }
}

function datosAutenticados(cabecera: Buffer, contexto: string): Buffer {
  return Buffer.concat([cabecera.subarray(0, LARGO_AUTENTICADO), Buffer.from(contexto, 'utf8')]);
}
