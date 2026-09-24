/**
 * Carga datos de prueba para desarrollar y probar el sistema sin tener que
 * escribir filas a mano en Prisma Studio.
 *
 *   npm run db:datos-de-prueba
 *
 * Crea seis funcionarios ficticios, con UUID valido (Prisma Studio no lo
 * genera solo), y al final imprime sus identificadores y los de los roles,
 * listos para copiar en Postman.
 *
 * Se puede correr las veces que se quiera: si un funcionario de prueba ya
 * existe (se reconoce por la cedula), lo deja como esta.
 *
 * SEGURIDAD: se niega a correr si la base no es local. Estos datos jamas
 * deben llegar a la base de la Municipalidad.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { configuracionDeConexion } from '../src/prisma/configuracion-conexion.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL en backend/.env');
}

// Solo contra una base en esta misma maquina.
const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
  throw new Error(
    `Los datos de prueba solo se cargan en una base local, y esta apunta a "${host}". No se hizo nada.`,
  );
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(configuracionDeConexion(url)) });

/**
 * Funcionarios ficticios. Las cedulas empiezan en 9 y los correos personales
 * usan ejemplo.com, un dominio reservado que no pertenece a nadie, para que
 * nunca se confundan con datos reales.
 */
const FUNCIONARIOS = [
  { cedula: '9-0000-0001', nombre: 'Ana', segundoApellido: 'Uno', usuario: 'prueba.uno' },
  { cedula: '9-0000-0002', nombre: 'Bruno', segundoApellido: 'Dos', usuario: 'prueba.dos' },
  { cedula: '9-0000-0003', nombre: 'Carla', segundoApellido: 'Tres', usuario: 'prueba.tres' },
  { cedula: '9-0000-0004', nombre: 'Diego', segundoApellido: 'Cuatro', usuario: 'prueba.cuatro' },
  { cedula: '9-0000-0005', nombre: 'Elena', segundoApellido: 'Cinco', usuario: 'prueba.cinco' },
  { cedula: '9-0000-0006', nombre: 'Fabian', segundoApellido: 'Seis', usuario: 'prueba.seis' },
];

async function main(): Promise<void> {
  const regimen = await prisma.regimenVacaciones.findUnique({
    where: { nombre: 'general' },
    select: { id: true },
  });

  if (!regimen) {
    throw new Error('No existe el regimen "general". Corra primero: npm run db:seed');
  }

  console.log('Funcionarios de prueba:');

  for (const f of FUNCIONARIOS) {
    const funcionario = await prisma.funcionario.upsert({
      where: { cedula: f.cedula },
      update: {}, // si ya existe, no se toca
      create: {
        cedula: f.cedula,
        nombre: f.nombre,
        primerApellido: 'Prueba',
        segundoApellido: f.segundoApellido,
        correoInstitucional: `${f.usuario}@munipalmares.go.cr`,
        correoPersonal: `${f.usuario}@ejemplo.com`,
        fechaIngreso: new Date('2024-01-15'),
        regimenVacacionesId: regimen.id,
      },
      select: {
        id: true,
        nombre: true,
        primerApellido: true,
        segundoApellido: true,
        usuario: { select: { correo: true } },
      },
    });

    const cuenta = funcionario.usuario ? `ya tiene cuenta: ${funcionario.usuario.correo}` : 'sin cuenta';
    console.log(
      `  ${funcionario.id}  ${funcionario.nombre} ${funcionario.primerApellido} ${funcionario.segundoApellido}  [${cuenta}]`,
    );
  }

  const roles = await prisma.rol.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

  console.log('');
  console.log('Roles:');
  for (const rol of roles) {
    console.log(`  ${rol.id}  ${rol.nombre}`);
  }
}

main()
  .catch((error) => {
    console.error('No se pudieron cargar los datos de prueba:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
