import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Configuracion del CLI de Prisma (Prisma 7).
// La URL de la base de datos ya no va en schema.prisma: se define aqui,
// leyendola de backend/.env
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
