/**
 * Restablece la contrasena de una cuenta desde la terminal.
 *
 * Existe para cuando alguien pierde su contrasena y todavia no hay un
 * administrador que pueda ayudarle, o para el dia que se pierda la del
 * Super Administrador. Es lo que hay que usar en ese caso: NUNCA comentar
 * validaciones del codigo para entrar.
 *
 * Uso:
 *   npm run contrasena:restablecer -- informatica@munipalmares.go.cr
 *   npm run contrasena:restablecer -- informatica@munipalmares.go.cr "MiClave26!"
 *
 * Si no se indica contrasena, genera una al azar y la imprime una sola vez.
 * En ambos casos la cuenta queda obligada a cambiarla en el primer ingreso,
 * se le limpian los intentos fallidos y se le levanta el bloqueo.
 *
 * Para correrlo hay que tener acceso al servidor y a las credenciales de la
 * base de datos, que es exactamente el nivel de acceso que ya permitiria
 * hacer cualquier cosa con el sistema.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { generarContrasenaTemporal } from '../src/autenticacion/contrasena-temporal.js';
import { configuracionDeConexion } from '../src/prisma/configuracion-conexion.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL en backend/.env');
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(configuracionDeConexion(url)) });

async function main(): Promise<void> {
  const correo = process.argv[2]?.trim().toLowerCase();
  const indicada = process.argv[3];

  if (!correo) {
    console.error('Falta el correo de la cuenta.');
    console.error('  npm run contrasena:restablecer -- usuario@munipalmares.go.cr');
    process.exitCode = 1;
    return;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { correo },
    select: { id: true, correo: true, estado: true },
  });

  if (!usuario) {
    console.error(`No existe ninguna cuenta con el correo ${correo}.`);
    process.exitCode = 1;
    return;
  }

  const contrasena = indicada ?? generarContrasenaTemporal(16);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      contrasenaHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
      debeCambiarContrasena: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  });

  console.log('Contrasena restablecida.');
  console.log(`  cuenta:     ${usuario.correo}`);
  console.log(`  contrasena: ${contrasena}`);
  console.log('  El sistema le exigira cambiarla en el primer ingreso.');

  if (usuario.estado !== 'activo') {
    console.log(`  Ojo: la cuenta esta en estado "${usuario.estado}" y no podra entrar hasta activarla.`);
  }
}

main()
  .catch((error) => {
    console.error('No se pudo restablecer la contrasena:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
