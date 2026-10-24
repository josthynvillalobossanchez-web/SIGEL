import type { Prisma } from '../../generated/prisma/client.js';

/** Cliente de Prisma dentro de una transaccion (antes vivia en el prisma.service de ARCA). */
export type Tx = Prisma.TransactionClient;
