import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { FiltroDeExcepciones } from './comun/filtros/excepciones.filter.js';
import { RegistrosDeSinergia } from './comun/registros.js';

/*
 * Arranque de SINERGIA.
 *
 * Como se despliega (respuestas de Joseph, 30/09; ver docs/GUIA_DESARROLLO.md
 * "Despliegue"): en una maquina virtual Windows de la Municipalidad, por
 * HTTPS, en un subdominio de munipalmares, SIN proxy inverso (Nginx esta
 * instalado pero no se usa). Por eso este mismo proceso puede:
 *   - servir HTTPS directo con el certificado (CERTIFICADO_HTTPS y LLAVE_HTTPS);
 *   - servir tambien la interfaz ya compilada (RUTA_FRONTEND = frontend/dist),
 *     en el mismo dominio que /api: asi la cookie de sesion funciona sin CORS.
 * En desarrollo esas variables van vacias: HTTP en localhost y la interfaz
 * la sirve Vite.
 */
async function arrancar(): Promise<void> {
  const registros = new RegistrosDeSinergia(process.env.RUTA_REGISTROS);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: registros,
    httpsOptions: opcionesHttps(),
  });

  // Cabeceras de seguridad (CSP, X-Frame-Options, nosniff...). Va PRIMERO para que
  // lleguen en todas las respuestas, incluidos los errores.
  app.use(helmet(opcionesDeCabeceras(Boolean(process.env.CERTIFICADO_HTTPS?.trim()))));

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // Necesario para leer la cookie donde viaja la sesion.
  app.use(cookieParser());

  // No hay proxy inverso delante (confirmado por Joseph, 30/09), asi que el
  // limite de intentos por IP ya ve la direccion real de cada persona. Si
  // algun dia se pone Nginx o IIS delante, hay que descomentar esta linea:
  // app.set('trust proxy', 1);

  // En desarrollo el frontend (Vite) corre en otro puerto. credentials en
  // true es lo que permite que el navegador mande la cookie de sesion.
  // En produccion la interfaz se sirve desde aqui mismo (mismo origen).
  app.enableCors({
    origin: process.env.ORIGEN_FRONTEND ?? 'http://localhost:5173',
    credentials: true,
  });

  // Validacion de DTO en el backend: nunca se confia en el cliente.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta los campos que no estan en el DTO
      forbidNonWhitelisted: true, // y avisa si llegan campos de mas
      transform: true,
    }),
  );

  // Toda respuesta de error sale con la misma forma (statusCode, codigo,
  // message) y sin trazas ni datos internos.
  app.useGlobalFilters(new FiltroDeExcepciones());

  const interfaz = servirInterfaz(app);

  const puerto = Number(process.env.PUERTO ?? 3000);
  await app.listen(puerto);
  const protocolo = process.env.CERTIFICADO_HTTPS ? 'https' : 'http';
  const aviso = new Logger('SINERGIA');
  aviso.log(`API escuchando en ${protocolo}://localhost:${puerto}/api`);
  if (interfaz) aviso.log(`Interfaz servida desde ${interfaz}`);
  aviso.log(`Registros en ${registros.ruta}`);
}

/**
 * Cabeceras de seguridad (helmet) a la medida de SINERGIA.
 *
 * La politica de contenido (CSP) dice de donde puede cargar cosas la pagina:
 *   - scripts: solo los propios (por eso el tema se aplica con /tema.js y no con un script en el HTML);
 *   - estilos: propios y Google Fonts ('unsafe-inline' porque React pone estilos en linea);
 *   - tipografia: Google Fonts;
 *   - imagenes: propias, data: y blob: (la vista previa de la fotografia);
 *   - marcos: propios y blob: (el visor muestra el PDF en un marco con direccion temporal);
 *   - nadie puede meter SINERGIA en un marco ajeno (frame-ancestors 'none').
 * Las respuestas de archivos (documentos y fotos) ponen despues su propia CSP
 * todavia mas estricta. HSTS y "upgrade-insecure-requests" solo con HTTPS: en
 * desarrollo (HTTP en localhost) romperian la carga.
 */
function opcionesDeCabeceras(conHttps: boolean): Parameters<typeof helmet>[0] {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: conHttps ? [] : null,
      },
    },
    strictTransportSecurity: conHttps ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  };
}

/**
 * Certificado para HTTPS (rutas a archivos .pem en el .env). Si no hay, la
 * aplicacion escucha por HTTP (desarrollo). Si solo esta uno de los dos, se
 * detiene: es un error de configuracion, no se arranca sin cifrar a medias.
 */
function opcionesHttps(): { cert: Buffer; key: Buffer } | undefined {
  const certificado = process.env.CERTIFICADO_HTTPS?.trim();
  const llave = process.env.LLAVE_HTTPS?.trim();
  if (!certificado && !llave) return undefined;
  if (!certificado || !llave) {
    throw new Error('Para HTTPS hacen falta CERTIFICADO_HTTPS y LLAVE_HTTPS en el .env (las dos).');
  }
  return { cert: readFileSync(certificado), key: readFileSync(llave) };
}

/**
 * Sirve la interfaz compilada (npm run build del frontend) si RUTA_FRONTEND
 * esta configurada: los archivos tal cual y, para cualquier otra ruta que no
 * sea /api, index.html (las rutas de pantalla las maneja React). Devuelve la
 * carpeta usada, o null si no se sirve.
 */
function servirInterfaz(app: NestExpressApplication): string | null {
  const ruta = process.env.RUTA_FRONTEND?.trim();
  if (!ruta) return null;
  const carpeta = resolve(ruta);
  const inicio = join(carpeta, 'index.html');
  if (!existsSync(inicio)) {
    throw new Error(`RUTA_FRONTEND no tiene index.html (${carpeta}). Compile el frontend con "npm run build".`);
  }
  app.useStaticAssets(carpeta, { index: false });
  app.use((peticion: Request, respuesta: Response, siguiente: NextFunction) => {
    if (peticion.method !== 'GET' || peticion.path.startsWith('/api')) return siguiente();
    respuesta.sendFile(inicio);
  });
  return carpeta;
}

void arrancar();
