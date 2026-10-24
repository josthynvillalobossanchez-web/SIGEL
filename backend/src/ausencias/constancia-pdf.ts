/**
 * PDF de las constancias (HU 26 y HU 33): vacaciones, permisos con y sin goce
 * de salario y licencias. Cambian el titulo, el parrafo y la nota segun el
 * tipo; el saldo solo aparece en las de vacaciones.
 *
 * Funcion pura: recibe los datos ya armados y devuelve el PDF (Buffer). Usa
 * pdf-lib con la fuente Helvetica estandar (cubre tildes, enie y signos del
 * espanol). Los logos se leen de backend/contenido/ (RUTA_CONTENIDO); si no
 * estan, la constancia sale igual, sin logos.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface DatosDeConstancia {
  /** Clave del tipo de solicitud: vacaciones, permisoConGoce, permisoSinGoce, licencia... */
  clave: string;
  /** Nombre del tipo tal como esta en el catalogo ("Permiso con goce de salario"). */
  nombreDelTipo: string;
  /** false = es un derecho (licencia): se registro, nadie la aprobo. */
  requiereAprobacion: boolean;
  consecutivo: string;
  nombreCompleto: string;
  cedula: string;
  puesto: string | null;
  departamento: string | null;
  /** "lunes 12 de octubre de 2026" */
  desde: string;
  hasta: string;
  diasHabiles: number;
  /** Feriados que cayeron en el rango y no se descontaron. */
  feriados: string[];
  aprobadaPor: string;
  /** "12/10/2026 14:35" (hora de Costa Rica) */
  aprobadaEl: string;
  emitidaEl: string;
  /** Solo vacaciones. */
  saldoDisponible: number | null;
  motivo: string | null;
}

const AZUL = rgb(0.11, 0.2, 0.32);
const GRIS = rgb(0.38, 0.42, 0.47);
const VERDE = rgb(0.4, 0.45, 0.02);

async function leerOpcional(nombre: string): Promise<Uint8Array | null> {
  try {
    return await readFile(join(process.env.RUTA_CONTENIDO ?? join(process.cwd(), 'contenido'), nombre));
  } catch {
    return null;
  }
}

/** Corta un texto en lineas que caben en "ancho" puntos. */
function partir(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, tamano) > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function generarConstanciaPdf(d: DatosDeConstancia): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const esVacaciones = d.clave === 'vacaciones';
  pdf.setTitle(`Constancia de ${d.nombreDelTipo.toLowerCase()} ${d.consecutivo}`);
  pdf.setAuthor('Municipalidad de Palmares');
  pdf.setCreator('ARCA');
  pdf.setProducer('ARCA');
  const pagina: PDFPage = pdf.addPage([612, 792]); // carta
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margen = 64;
  const ancho = 612 - margen * 2;
  let y = 792 - 60;

  // --- Encabezado: logo de la Municipalidad, nombre, y SINERGIA a la derecha ---
  const logoMuni = await leerOpcional('logo-municipalidad.png');
  if (logoMuni) {
    const img = await pdf.embedPng(logoMuni);
    const h = 46;
    pagina.drawImage(img, { x: margen, y: y - h + 6, width: (img.width / img.height) * h, height: h });
  }
  pagina.drawText('Municipalidad de Palmares', { x: margen + 48, y: y - 12, size: 15, font: negrita, color: AZUL });
  pagina.drawText('Departamento de Recursos Humanos', { x: margen + 48, y: y - 30, size: 10.5, font: normal, color: GRIS });
  const logoSinergia = await leerOpcional('logo-sinergia.png');
  if (logoSinergia) {
    const img = await pdf.embedPng(logoSinergia);
    pagina.drawImage(img, { x: 612 - margen - 34, y: y - 34, width: 34, height: 34 });
  }
  y -= 58;
  pagina.drawLine({ start: { x: margen, y }, end: { x: 612 - margen, y }, thickness: 1.2, color: VERDE });
  y -= 44;

  // --- Titulo ---
  const titulo = `CONSTANCIA DE ${d.nombreDelTipo.toUpperCase()}`;
  const tamanoTitulo = negrita.widthOfTextAtSize(titulo, 17) > ancho ? 14 : 17;
  pagina.drawText(titulo, { x: (612 - negrita.widthOfTextAtSize(titulo, tamanoTitulo)) / 2, y, size: tamanoTitulo, font: negrita, color: AZUL });
  y -= 20;
  const sub = `${d.consecutivo}  ·  Emitida el ${d.emitidaEl}`;
  pagina.drawText(sub, { x: (612 - normal.widthOfTextAtSize(sub, 10)) / 2, y, size: 10, font: normal, color: GRIS });
  y -= 40;

  // --- Cuerpo ---
  const quien = [d.puesto, d.departamento].filter(Boolean).join(', ');
  const queHara = esVacaciones
    ? 'disfrutará de vacaciones'
    : d.clave === 'licencia'
      ? 'disfrutará de una licencia'
      : `contará con un ${d.nombreDelTipo.toLowerCase()}`;
  const comoQuedo = d.requiereAprobacion
    ? `aprobada por ${d.aprobadaPor} el ${d.aprobadaEl}`
    : `registrada el ${d.aprobadaEl} con su comprobante (es un derecho: no requiere aprobación)`;
  const parrafo =
    `Se hace constar que ${d.nombreCompleto}, cédula ${d.cedula}${quien ? `, ${quien}` : ''}, ` +
    `${queHara} del ${d.desde} al ${d.hasta}, para un total de ${d.diasHabiles} ` +
    `${d.diasHabiles === 1 ? 'día hábil' : 'días hábiles'}, según la solicitud ${d.consecutivo}, ${comoQuedo}.`;
  for (const linea of partir(parrafo, normal, 12, ancho)) {
    pagina.drawText(linea, { x: margen, y, size: 12, font: normal, color: rgb(0.1, 0.12, 0.15) });
    y -= 19;
  }
  y -= 14;

  // --- Detalle en filas ---
  const filas: [string, string][] = [
    ['Primer día', d.desde],
    ['Último día', d.hasta],
    ['Días hábiles', String(d.diasHabiles)],
    ['Feriados no contados', d.feriados.length ? d.feriados.join('; ') : 'Ninguno'],
  ];
  if (esVacaciones && d.saldoDisponible !== null) {
    filas.push(['Saldo disponible después de esta solicitud', `${d.saldoDisponible} ${d.saldoDisponible === 1 ? 'día' : 'días'}`]);
  }
  if (d.motivo) filas.push(['Motivo indicado', d.motivo]);
  for (const [etiqueta, valor] of filas) {
    pagina.drawText(etiqueta, { x: margen, y, size: 10, font: negrita, color: GRIS });
    const lineas = partir(valor, normal, 11, ancho - 210);
    lineas.forEach((l, i) => pagina.drawText(l, { x: margen + 210, y: y - i * 15, size: 11, font: normal }));
    y -= Math.max(1, lineas.length) * 15 + 9;
  }
  y -= 10;
  const queDescuenta = esVacaciones
    ? 'Los días se descontaron del saldo de vacaciones al aprobarse la solicitud.'
    : d.clave === 'permisoSinGoce'
      ? 'Es un permiso sin goce de salario: esos días no se pagan. No se descuenta de las vacaciones.'
      : d.clave === 'licencia'
        ? 'Licencia con goce de salario prevista por la normativa; el comprobante quedó en el expediente. No se descuenta de las vacaciones.'
        : 'Permiso con goce de salario: no se rebaja del salario ni de las vacaciones.';
  const nota = `${queDescuenta} Los fines de semana y los feriados registrados en el sistema no se cuentan como días hábiles.`;
  for (const linea of partir(nota, normal, 9.5, ancho)) {
    pagina.drawText(linea, { x: margen, y, size: 9.5, font: normal, color: GRIS });
    y -= 14;
  }

  // --- Pie: generado por SINERGIA y codigo de verificacion ---
  const codigo = createHash('sha256').update(`${d.consecutivo}|${d.cedula}|${d.desde}|${d.hasta}|${d.aprobadaEl}`).digest('hex').slice(0, 12).toUpperCase();
  pagina.drawLine({ start: { x: margen, y: 92 }, end: { x: 612 - margen, y: 92 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.85) });
  pagina.drawText(`Documento generado automáticamente por ARCA. No requiere firma: ${d.requiereAprobacion ? 'la aprobación' : 'el registro'} quedó en el sistema.`, {
    x: margen,
    y: 76,
    size: 8.5,
    font: normal,
    color: GRIS,
  });
  pagina.drawText(`Código de verificación: ${codigo}`, { x: margen, y: 62, size: 8.5, font: negrita, color: GRIS });

  return Buffer.from(await pdf.save());
}
