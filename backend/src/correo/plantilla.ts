/**
 * Plantilla de los correos de SINERGIA (22/10/2026, pedido de Josthyn).
 *
 * Cada correo se describe con un ContenidoDeCorreo y de ahi salen dos
 * versiones: HTML (con los logos y los colores del sistema) y texto plano
 * (para los programas que no muestran HTML y para el modo consola).
 *
 * Reglas del HTML de correo (Gmail y Outlook son muy limitados):
 *   - todo con tablas y estilos en linea; nada de CSS externo ni JavaScript;
 *   - las imagenes van ADJUNTAS e incrustadas (cid:), no como enlace: un
 *     enlace a la intranet no carga fuera de la Municipalidad y Gmail bloquea
 *     las imagenes en data:;
 *   - si faltan los logos en backend/contenido, el correo sale igual, sin ellos.
 */

/** Colores del sistema (frontend/src/estilos/sigel.css). */
const C = {
  navy: '#1F3140',
  navySec: '#B9C6D1',
  olive: '#667306',
  oliveOscuro: '#3D4504',
  tinte: '#F1F3E3',
  superficie: '#F7F8FA',
  borde: '#DDE3EA',
  texto: '#1F3140',
  textoSec: '#5F6B75',
  advertFondo: '#FDF3E2',
  advertTexto: '#965900',
} as const;

const LETRA = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "Consolas, 'Courier New', monospace";

export interface ContenidoDeCorreo {
  /** Titulo grande del correo ("Su cuenta de acceso"). */
  titulo: string;
  /** Parrafos antes de los datos. */
  parrafos: string[];
  /** Pares etiqueta/valor; "clave" los muestra en letra de maquina y resaltados. */
  datos?: { etiqueta: string; valor: string; clave?: boolean }[];
  /** Un codigo grande (recuperacion de contrasena). */
  codigo?: string;
  /** Parrafos despues de los datos. */
  despues?: string[];
  /** Aviso de seguridad en un recuadro ("Si usted no solicito..."). */
  aviso?: string;
  /** Boton para entrar al sistema. Si no hay direccion, no se muestra. */
  boton?: { texto: string; enlace: string | null };
}

/** Nombre de cada imagen incrustada (cid) y su archivo en backend/contenido. */
export const IMAGENES_DEL_CORREO = [
  { cid: 'simbolo-sinergia', archivo: 'logo-sinergia.png' },
  { cid: 'logo-municipalidad', archivo: 'logo-municipalidad-blanco.png' },
] as const;

const PIE = 'Este es un correo automático de SINERGIA. Por favor no lo responda; si tiene alguna consulta, comuníquese con Recursos Humanos.';

/** Version en texto plano (la de siempre). */
export function aTexto(c: ContenidoDeCorreo): string {
  const lineas: string[] = ['Buen día,', ''];
  for (const p of c.parrafos) lineas.push(p, '');
  if (c.datos?.length) {
    const ancho = Math.max(...c.datos.map((d) => d.etiqueta.length)) + 2;
    for (const d of c.datos) lineas.push(`${(d.etiqueta + ':').padEnd(ancho + 1)}${d.valor}`);
    lineas.push('');
  }
  if (c.codigo) lineas.push(`Código: ${c.codigo}`, '');
  for (const p of c.despues ?? []) lineas.push(p, '');
  if (c.aviso) lineas.push(c.aviso, '');
  if (c.boton?.enlace) lineas.push(`${c.boton.texto}: ${c.boton.enlace}`, '');
  lineas.push('Municipalidad de Palmares', '', PIE);
  return lineas.join('\n');
}

/** Version HTML. "conLogos" es falso si no se encontraron los archivos. */
export function aHtml(c: ContenidoDeCorreo, conLogos: boolean): string {
  const parrafo = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.texto};">${html(t)}</p>`;

  const datos = c.datos?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid ${C.borde};border-radius:10px;border-collapse:separate;background:${C.superficie};">
        ${c.datos
          .map(
            (d, i) => `<tr>
          <td style="padding:12px 16px;font-size:13px;color:${C.textoSec};width:42%;${i ? `border-top:1px solid ${C.borde};` : ''}">${html(d.etiqueta)}</td>
          <td style="padding:12px 16px;font-size:15px;color:${C.texto};font-weight:600;word-break:break-word;${i ? `border-top:1px solid ${C.borde};` : ''}${d.clave ? `font-family:${MONO};font-size:16px;letter-spacing:.5px;` : ''}">${
            d.clave ? `<span style="background:${C.tinte};color:${C.oliveOscuro};padding:3px 8px;border-radius:6px;">${html(d.valor)}</span>` : html(d.valor)
          }</td>
        </tr>`,
          )
          .join('')}
      </table>`
    : '';

  const codigo = c.codigo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;">
        <tr><td align="center" style="background:${C.tinte};border-left:4px solid ${C.olive};border-radius:10px;padding:20px 12px;">
          <div style="font-size:12px;color:${C.textoSec};margin-bottom:6px;">Su código</div>
          <div style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:10px;color:${C.oliveOscuro};">${html(c.codigo)}</div>
        </td></tr>
      </table>`
    : '';

  const aviso = c.aviso
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
        <tr><td style="background:${C.advertFondo};border-radius:10px;padding:12px 16px;font-size:13.5px;line-height:1.5;color:${C.advertTexto};">${html(c.aviso)}</td></tr>
      </table>`
    : '';

  const boton = c.boton?.enlace
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;">
        <tr><td style="background:${C.olive};border-radius:10px;">
          <a href="${atributo(c.boton.enlace)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;font-family:${LETRA};">${html(c.boton.texto)}</a>
        </td></tr>
      </table>
      <p style="margin:6px 0 0;font-size:12px;color:${C.textoSec};">Funciona desde la red de la Municipalidad.</p>`
    : '';

  const simbolo = conLogos
    ? `<td width="44" style="padding-right:12px;"><div style="width:44px;height:44px;background:#FFFFFF;border-radius:10px;text-align:center;"><img src="cid:simbolo-sinergia" width="36" height="36" alt="" style="display:block;margin:4px auto;border:0;"></div></td>`
    : '';
  const muni = conLogos
    ? `<img src="cid:logo-municipalidad" width="30" height="40" alt="Municipalidad de Palmares" style="display:block;border:0;">`
    : `<span style="font-size:12px;color:${C.navySec};">Municipalidad de Palmares</span>`;

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${html(c.titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.superficie};">
<div style="display:none;max-height:0;overflow:hidden;">${html(c.parrafos[0] ?? c.titulo)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.superficie};font-family:${LETRA};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${C.borde};border-radius:14px;overflow:hidden;">
      <tr><td style="background:${C.navy};padding:16px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${simbolo}
          <td style="vertical-align:middle;">
            <div style="font-size:18px;font-weight:800;letter-spacing:1.5px;color:#FFFFFF;">SINERGIA</div>
            <div style="font-size:12px;color:${C.navySec};">Gestión de personal</div>
          </td>
          <td align="right" style="vertical-align:middle;">${muni}</td>
        </tr></table>
      </td></tr>
      <tr><td style="height:4px;background:${C.olive};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${C.texto};">${html(c.titulo)}</h1>
        ${parrafo('Buen día,')}
        ${c.parrafos.map(parrafo).join('')}
        ${datos}${codigo}
        ${(c.despues ?? []).map(parrafo).join('')}
        ${aviso}${boton}
      </td></tr>
      <tr><td style="padding:20px 28px 26px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:${C.texto};">Municipalidad de Palmares</p>
        <p style="margin:2px 0 0;font-size:13px;color:${C.textoSec};">Recursos Humanos</p>
      </td></tr>
      <tr><td style="background:${C.superficie};border-top:1px solid ${C.borde};padding:14px 28px;font-size:12px;line-height:1.5;color:${C.textoSec};">${html(PIE)}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function html(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function atributo(t: string): string {
  return html(t).replace(/'/g, '&#39;');
}

/** Direccion para el boton "Ingresar": la de la interfaz (ORIGEN_FRONTEND), si es https. */
export function direccionDeSinergia(): string | null {
  const origen = process.env.ORIGEN_FRONTEND?.split(',')[0]?.trim();
  return origen && /^https:\/\//.test(origen) ? origen.replace(/\/+$/, '') : null;
}
