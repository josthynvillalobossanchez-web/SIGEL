import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // El frontend de desarrollo (Vite) corre en otro puerto.
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

  const puerto = Number(process.env.PUERTO ?? 3000);
  await app.listen(puerto);
  new Logger('SIGEL').log(`API escuchando en http://localhost:${puerto}/api`);
}

void arrancar();
