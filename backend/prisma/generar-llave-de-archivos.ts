import { randomBytes } from 'node:crypto';

/*
 * Genera una llave nueva para cifrar los archivos del expediente
 * (AES-256: 32 bytes al azar, en base64) y la imprime UNA sola vez.
 *
 * Uso:   npm run archivos:generar-llave
 *
 * Copie el valor a ARCHIVOS_LLAVE en el .env del servidor. NO se guarda en
 * ningun otro lado. IMPORTANTE: si esta llave se pierde, los documentos
 * cifrados con ella NO se pueden recuperar. Guarde una copia aparte, fuera
 * del respaldo de la carpeta de archivos (ver GUIA_DESARROLLO.md).
 */
console.log('Llave nueva para ARCHIVOS_LLAVE (cópiela al .env; no se vuelve a mostrar):');
console.log(randomBytes(32).toString('base64'));
