import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { FiltroDeExcepciones } from './comun/filtros/excepciones.filter.js';

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // Necesario para leer la cookie donde viaja la sesion.
  app.use(cookieParser());

  // En el servidor, si SIGEL queda detras de un proxy inverso (nginx, IIS),
  // hay que habilitar "trust proxy" para que el limite por IP vea la
  // direccion real del visitante y no la del proxy.
  // app.set('trust proxy', 1);

  // El frontend de desarrollo (Vite) corre en otro puerto.
  // credentials en true es lo que permite que el navegador mande la cookie
  // de sesion desde el frontend.
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

  const puerto = Number(process.env.PUERTO ?? 3000);
  await app.listen(puerto);
  new Logger('SIGEL').log(`API escuchando en http://localhost:${puerto}/api`);
}

void arrancar();
