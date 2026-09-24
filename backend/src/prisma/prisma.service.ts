import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { configuracionDeConexion } from './configuracion-conexion.js';

/**
 * Conexion unica a MySQL para toda la aplicacion.
 *
 * Desde Prisma 7 el cliente se conecta mediante un "driver adapter":
 * para MySQL se usa @prisma/adapter-mariadb, que habla el mismo protocolo.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static readonly registro = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('Falta DATABASE_URL en backend/.env (copie .env.example y complete los valores).');
    }
    super({ adapter: new PrismaMariaDb(configuracionDeConexion(url)) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    PrismaService.registro.log('Conexion establecida con MySQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Comprobacion sencilla para el endpoint de salud. */
  async estaViva(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
