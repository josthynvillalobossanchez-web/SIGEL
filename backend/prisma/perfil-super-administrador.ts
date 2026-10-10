/*
 * Liga la cuenta del Super Administrador a la persona que la usa (pedido de
 * Josthyn, 09/10/2026). Los datos personales NO estan en el codigo (no deben
 * llegar a GitHub): se leen de un archivo JSON que queda fuera del repositorio.
 *
 *   npm run db:perfil-super-administrador -- <ruta del archivo JSON>
 *   (por ejemplo: npm run db:perfil-super-administrador -- ..\docs\_trabajo\perfil-super-administrador.json)
 *
 * El JSON lleva:
 *   {
 *     "cedula": "1-2345-6789", "nombre": "...", "primerApellido": "...", "segundoApellido": "...",
 *     "correoInstitucional": "...@munipalmares.go.cr",
 *     "departamento": "...", "puesto": "..."
 *   }
 * (correoPersonal y telefonoPersonal son opcionales; si no viene el correo
 * personal se usa el institucional, porque la tabla lo exige.)
 *
 * Se corre UNA vez en cada base (desarrollo y servidor). Si la cuenta ya tiene
 * funcionario, no cambia nada. No va en el seed, para que las bases de prueba
 * sigan teniendo la cuenta tecnica sin funcionario.
 *
 * Lo que falta lo completa despues:
 *   - la persona, en "Mi cuenta": telefono, fecha de nacimiento, direccion y
 *     su correo personal;
 *   - Recursos Humanos, en "Editar funcionario": la FECHA DE INGRESO real (queda
 *     la del dia en que se corre) y el saldo de vacaciones. Nadie edita sus
 *     propios datos laborales, ni siquiera el Super Administrador.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { configuracionDeConexion } from '../src/prisma/configuracion-conexion.js';
import { normalizarCedula } from '../src/funcionarios/cedula.js';

interface DatosDelPerfil {
  cedula: string;
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  correoInstitucional: string;
  correoPersonal?: string;
  telefonoPersonal?: string;
  departamento: string;
  puesto: string;
}

const ruta = process.argv[2];
if (!ruta) {
  console.error('Indique el archivo con los datos. Ejemplo:\n  npm run db:perfil-super-administrador -- ..\\docs\\_trabajo\\perfil-super-administrador.json');
  process.exit(1);
}
const datos = JSON.parse(readFileSync(ruta, 'utf8')) as DatosDelPerfil;
for (const campo of ['cedula', 'nombre', 'primerApellido', 'correoInstitucional', 'departamento', 'puesto'] as const) {
  if (!datos[campo] || typeof datos[campo] !== 'string') {
    console.error(`Falta "${campo}" en ${ruta}.`);
    process.exit(1);
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL en backend/.env');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(configuracionDeConexion(url)) });
const CORREO_DE_LA_CUENTA = process.env.SEED_ADMIN_CORREO ?? 'informatica@munipalmares.go.cr';

async function main() {
  const cuenta = await prisma.usuario.findUnique({ where: { correo: CORREO_DE_LA_CUENTA }, select: { id: true, funcionarioId: true } });
  if (!cuenta) throw new Error(`No existe la cuenta ${CORREO_DE_LA_CUENTA}. Corra primero: npm run db:seed`);
  if (cuenta.funcionarioId) {
    console.log(`La cuenta ${CORREO_DE_LA_CUENTA} ya está ligada a un funcionario. No se hizo nada.`);
    return;
  }
  const cedula = normalizarCedula(datos.cedula);
  const yaExiste = await prisma.funcionario.findUnique({ where: { cedula }, select: { id: true, usuario: { select: { correo: true } } } });
  if (yaExiste?.usuario) {
    console.log(`Esa cédula ya tiene la cuenta ${yaExiste.usuario.correo}. No se hizo nada.`);
    return;
  }
  const regimen = await prisma.regimenVacaciones.findUnique({ where: { nombre: 'general' }, select: { id: true } });
  if (!regimen) throw new Error('No existe el régimen "general". Corra primero: npm run db:seed');
  const nombreCompleto = [datos.nombre, datos.primerApellido, datos.segundoApellido].filter(Boolean).join(' ');

  await prisma.$transaction(async (tx) => {
    const departamento = await tx.departamento.upsert({ where: { nombre: datos.departamento }, update: {}, create: { nombre: datos.departamento }, select: { id: true } });
    const puesto = await tx.puesto.upsert({ where: { nombre: datos.puesto }, update: {}, create: { nombre: datos.puesto }, select: { id: true } });
    const hoy = new Date();
    const funcionario =
      yaExiste ??
      (await tx.funcionario.create({
        data: {
          cedula,
          nombre: datos.nombre,
          primerApellido: datos.primerApellido,
          segundoApellido: datos.segundoApellido || null,
          correoInstitucional: datos.correoInstitucional,
          correoPersonal: datos.correoPersonal || datos.correoInstitucional,
          telefonoPersonal: datos.telefonoPersonal || null,
          departamentoId: departamento.id,
          puestoId: puesto.id,
          regimenVacacionesId: regimen.id,
          // Provisional: Recursos Humanos pone la real en "Editar funcionario".
          fechaIngreso: new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())),
        },
        select: { id: true },
      }));
    await tx.usuario.update({ where: { id: cuenta.id }, data: { funcionarioId: funcionario.id } });
    await tx.bitacoraCambio.create({
      data: {
        usuarioId: cuenta.id,
        funcionarioAfectadoId: funcionario.id,
        entidad: 'funcionario',
        registroAfectadoId: funcionario.id,
        accion: 'crear',
        descripcion: `Se ligó la cuenta ${CORREO_DE_LA_CUENTA} (Super Administrador) a ${nombreCompleto} (perfil-super-administrador).`,
      },
    });
  });

  console.log(`Listo: la cuenta ${CORREO_DE_LA_CUENTA} quedó ligada a ${nombreCompleto}.`);
  console.log('Pendiente: RRHH pone la fecha de ingreso real en "Editar funcionario"; la persona completa sus datos en "Mi cuenta".');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
