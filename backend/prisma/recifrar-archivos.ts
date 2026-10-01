/**
 * Recifra los archivos del expediente (y las fotos) con la llave actual.
 *
 * Cuando se usa: se sospecha que la llave se filtro, se rota por politica o
 * cambio quien la custodia. Procedimiento completo en
 * docs/GUIA_DESARROLLO.md (seccion "Recifrar los archivos").
 *
 *   npm run archivos:recifrar                 simulacro: no cambia nada
 *   npm run archivos:recifrar -- --aplicar    recifra de verdad
 *
 * Lee el mismo .env que el backend (RUTA_ARCHIVOS, ARCHIVOS_LLAVE,
 * ARCHIVOS_LLAVE_VERSION, ARCHIVOS_LLAVES_ANTERIORES). No toca la base de
 * datos ni borra nada: solo reescribe archivos .enc que estan en una version
 * de llave distinta de la actual.
 *
 * Por cada archivo a recifrar: lo descifra en memoria (GCM ya comprueba que
 * no esta alterado), lo cifra con la llave actual, lo escribe en un archivo
 * temporal y SOLO entonces reemplaza el original. Antes de escribir se
 * comprueba que la copia nueva descifra igual. Si algo falla, el original
 * queda intacto. Se puede interrumpir y volver a correr: salta los que ya
 * estan al dia.
 *
 * Termina con codigo 1 si hubo archivos ilegibles o errores.
 */
import 'dotenv/config';
import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { cifrar, descifrar, versionDeLlaveDe } from '../src/almacenamiento/cifrado-de-archivos.js';

const aplicar = process.argv.includes('--aplicar');

function leerLlave(nombre: string, valor: string | undefined): Buffer {
  const llave = Buffer.from(valor?.trim() ?? '', 'base64');
  if (llave.length !== 32) throw new Error(`${nombre} falta o no es una llave de 32 bytes en base64.`);
  return llave;
}

/** Misma lectura de llaves que usa el backend al arrancar. */
function cargarLlaves(): { actual: number; llaves: Map<number, Buffer> } {
  const actual = Number(process.env.ARCHIVOS_LLAVE_VERSION?.trim() || '1');
  if (!Number.isInteger(actual) || actual < 1 || actual > 65535) {
    throw new Error('ARCHIVOS_LLAVE_VERSION debe ser un número entero entre 1 y 65535.');
  }
  const llaves = new Map<number, Buffer>([[actual, leerLlave('ARCHIVOS_LLAVE', process.env.ARCHIVOS_LLAVE)]]);
  for (const par of process.env.ARCHIVOS_LLAVES_ANTERIORES?.trim().split(',').filter(Boolean) ?? []) {
    const [version, valor] = par.split(':');
    const numero = Number(version);
    if (!Number.isInteger(numero) || numero < 1 || numero === actual) {
      throw new Error('ARCHIVOS_LLAVES_ANTERIORES debe ser "version:llave,version:llave" con versiones distintas de la actual.');
    }
    llaves.set(numero, leerLlave(`ARCHIVOS_LLAVES_ANTERIORES (versión ${numero})`, valor));
  }
  return { actual, llaves };
}

async function listar(carpeta: string): Promise<string[]> {
  const resultado: string[] = [];
  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) resultado.push(...(await listar(ruta)));
    else resultado.push(ruta);
  }
  return resultado;
}

async function main(): Promise<void> {
  const { actual, llaves } = cargarLlaves();
  const base = resolve(process.env.RUTA_ARCHIVOS?.trim() || './archivos');

  console.log(aplicar ? 'MODO APLICAR: se recifrarán los archivos.' : 'SIMULACRO: no se cambia ningún archivo (use --aplicar para recifrar).');
  console.log(`Carpeta: ${base}`);
  console.log(`Llave actual: versión ${actual}. Llaves anteriores configuradas: ${[...llaves.keys()].filter((v) => v !== actual).join(', ') || 'ninguna'}.\n`);

  const todos = await listar(base).catch(() => {
    throw new Error(`No se pudo leer la carpeta de archivos (${base}).`);
  });
  const temporales = todos.filter((r) => r.endsWith('.tmp'));
  const cifrados = todos.filter((r) => r.endsWith('.enc'));

  const porVersion = new Map<number, number>();
  const ilegibles: string[] = [];
  const conError: string[] = [];
  let recifrados = 0;
  let alDia = 0;
  let porRecifrar = 0;

  for (const archivo of cifrados) {
    const ruta = relative(base, archivo).split(sep).join('/'); // el contexto del cifrado es esta ruta
    try {
      const paquete = await readFile(archivo);
      const version = versionDeLlaveDe(paquete);
      porVersion.set(version, (porVersion.get(version) ?? 0) + 1);

      if (version === actual) {
        alDia++;
        continue;
      }
      const llaveVieja = llaves.get(version);
      if (!llaveVieja) {
        ilegibles.push(`${ruta} (cifrado con la versión ${version}, que no está configurada)`);
        continue;
      }

      let contenido: Buffer;
      try {
        contenido = descifrar(paquete, llaveVieja, ruta);
      } catch {
        ilegibles.push(`${ruta} (no descifra: llave incorrecta o archivo alterado)`);
        continue;
      }

      porRecifrar++;
      if (!aplicar) continue;

      const nuevo = cifrar(contenido, llaves.get(actual)!, actual, ruta);
      if (!descifrar(nuevo, llaves.get(actual)!, ruta).equals(contenido)) {
        throw new Error('la copia recifrada no coincide con el original');
      }
      const temporal = `${archivo}.tmp`;
      await writeFile(temporal, nuevo, { mode: 0o600 });
      await rename(temporal, archivo);
      recifrados++;
    } catch (error) {
      conError.push(`${ruta}: ${error instanceof Error ? error.message : String(error)}`);
      await unlink(`${archivo}.tmp`).catch(() => undefined);
    }
  }

  console.log(`Archivos cifrados encontrados: ${cifrados.length}`);
  for (const [version, cantidad] of [...porVersion].sort((a, b) => a[0] - b[0])) {
    console.log(`  versión ${version}${version === actual ? ' (actual)' : ''}: ${cantidad}`);
  }
  console.log(`\nYa están con la llave actual: ${alDia}`);
  console.log(aplicar ? `Recifrados ahora: ${recifrados}` : `Se recifrarían con --aplicar: ${porRecifrar}`);
  console.log(`Ilegibles (no se tocan): ${ilegibles.length}`);
  for (const linea of ilegibles) console.log(`  - ${linea}`);
  console.log(`Con error (el original quedó intacto): ${conError.length}`);
  for (const linea of conError) console.log(`  - ${linea}`);
  if (temporales.length) {
    console.log(`\nAviso: hay ${temporales.length} archivo(s) .tmp sobrantes de un corte anterior; revíselos con TI.`);
  }

  const todoAlDia = porRecifrar === 0 && ilegibles.length === 0 && conError.length === 0;
  if (aplicar && recifrados > 0 && ilegibles.length === 0 && conError.length === 0) {
    console.log('\nListo. Corra el simulacro otra vez: debe decir 0 por recifrar y 0 ilegibles antes de retirar la llave vieja.');
  } else if (todoAlDia) {
    console.log('\nTodo está con la llave actual: ya se puede retirar la llave vieja de ARCHIVOS_LLAVES_ANTERIORES.');
  }
  if (ilegibles.length > 0 || conError.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
