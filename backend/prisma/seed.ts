/**
 * Semilla inicial de SIGEL.
 *
 * Carga lo minimo que el sistema necesita para arrancar:
 *   - el catalogo de permisos por clave "modulo.accion",
 *   - los cinco roles de sistema con sus permisos,
 *   - los regimenes de vacaciones,
 *   - los tipos de documento base,
 *   - la cuenta del Super Administrador, con contrasena temporal.
 *
 * Los departamentos, puestos, funcionarios y expedientes NO se siembran:
 * esa carga inicial la hace la Municipalidad desde el sistema.
 *
 * Se puede ejecutar varias veces sin duplicar nada (usa upsert).
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { configuracionDeConexion } from '../src/prisma/configuracion-conexion.js';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL en backend/.env');
}
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(configuracionDeConexion(url)) });

// ---------------------------------------------------------------------
// Catalogo de permisos del Sprint 1
// ---------------------------------------------------------------------
const PERMISOS: { clave: string; modulo: string; descripcion: string }[] = [
  { clave: 'funcionarios.ver', modulo: 'funcionarios', descripcion: 'Consultar funcionarios y su ficha resumida' },
  { clave: 'funcionarios.crear', modulo: 'funcionarios', descripcion: 'Registrar un funcionario nuevo' },
  { clave: 'funcionarios.editar', modulo: 'funcionarios', descripcion: 'Modificar la informacion de un funcionario' },
  { clave: 'expediente.ver', modulo: 'expediente', descripcion: 'Abrir el expediente laboral' },
  { clave: 'documentos.crear', modulo: 'documentos', descripcion: 'Subir documentos al expediente' },
  { clave: 'documentos.descargar', modulo: 'documentos', descripcion: 'Ver y descargar documentos' },
  { clave: 'documentos.darDeBaja', modulo: 'documentos', descripcion: 'Dar de baja cualquier documento, sin eliminarlo' },
  {
    clave: 'documentos.darDeBajaPropio',
    modulo: 'documentos',
    descripcion: 'Dar de baja unicamente los documentos que subio la propia persona',
  },
  { clave: 'documentos.restaurar', modulo: 'documentos', descripcion: 'Restaurar un documento dado de baja' },
  { clave: 'tiposDocumento.editar', modulo: 'tiposDocumento', descripcion: 'Administrar el catalogo de tipos de documento' },
  { clave: 'usuarios.ver', modulo: 'usuarios', descripcion: 'Consultar las cuentas de usuario' },
  { clave: 'usuarios.crear', modulo: 'usuarios', descripcion: 'Crear cuentas de usuario' },
  { clave: 'usuarios.editar', modulo: 'usuarios', descripcion: 'Modificar cuentas de usuario' },
  { clave: 'usuarios.cambiarEstado', modulo: 'usuarios', descripcion: 'Activar, inactivar o bloquear una cuenta' },
  { clave: 'roles.editar', modulo: 'roles', descripcion: 'Administrar los roles y sus permisos' },
  { clave: 'permisos.editar', modulo: 'permisos', descripcion: 'Administrar el catalogo de permisos' },
  { clave: 'catalogos.editar', modulo: 'catalogos', descripcion: 'Administrar departamentos, puestos y profesiones' },
  { clave: 'bitacora.ver', modulo: 'bitacora', descripcion: 'Consultar la bitacora de auditoria' },
  { clave: 'perfilPropio.editar', modulo: 'perfilPropio', descripcion: 'Editar los datos personales y de contacto propios' },
];

// ---------------------------------------------------------------------
// Roles de sistema
// El alcance (propio expediente o cualquiera) es logica del backend, no
// una clave distinta de permiso.
// ---------------------------------------------------------------------
const AUTOSERVICIO = [
  'perfilPropio.editar',
  'expediente.ver',
  'documentos.crear',
  'documentos.descargar',
  'documentos.darDeBajaPropio',
];

const ROLES: { nombre: string; descripcion: string; permisos: string[] | 'todos' }[] = [
  {
    nombre: 'Super Administrador',
    descripcion: 'Control total del sistema. Unico rol que consulta la bitacora de auditoria.',
    permisos: 'todos',
  },
  {
    nombre: 'Administrador',
    descripcion: 'Gestion completa de funcionarios, expedientes, usuarios y catalogos. Lo usa Recursos Humanos.',
    permisos: [
      'funcionarios.ver',
      'funcionarios.crear',
      'funcionarios.editar',
      'expediente.ver',
      'documentos.crear',
      'documentos.descargar',
      'documentos.darDeBaja',
      'documentos.darDeBajaPropio',
      'documentos.restaurar',
      'tiposDocumento.editar',
      'usuarios.ver',
      'usuarios.crear',
      'usuarios.editar',
      'usuarios.cambiarEstado',
      'roles.editar',
      'catalogos.editar',
      'perfilPropio.editar',
    ],
  },
  {
    nombre: 'Aprobador',
    descripcion: 'Aprueba las solicitudes del personal a su cargo. Lo usan las jefaturas.',
    permisos: [...AUTOSERVICIO, 'funcionarios.ver'],
  },
  {
    nombre: 'Solicitante',
    descripcion: 'Autoservicio sobre su propio expediente. Lo usa cualquier funcionario.',
    permisos: AUTOSERVICIO,
  },
  {
    nombre: 'Consulta',
    descripcion: 'Solo lectura de funcionarios y expedientes, sin ningun permiso de escritura. Auditoria Interna.',
    permisos: ['funcionarios.ver', 'expediente.ver', 'documentos.descargar', 'usuarios.ver'],
  },
];

const REGIMENES = [
  {
    nombre: 'general',
    descripcion: '15 dias habiles los primeros 6 anios de servicio y 20 dias despues.',
    periodosMaximosAcumulables: 2,
    diasAvisoAntesDeVencer: 60,
  },
  {
    nombre: 'anterior',
    descripcion: '30 dias para los funcionarios amparados al regimen anterior.',
    periodosMaximosAcumulables: 2,
    diasAvisoAntesDeVencer: 60,
  },
];

const TIPOS_DOCUMENTO = [
  { nombre: 'Cedula de identidad', descripcion: 'Copia del documento de identidad', generadoPorSistema: false },
  { nombre: 'Titulo universitario', descripcion: 'Grado academico del funcionario', generadoPorSistema: false },
  { nombre: 'Accion de personal', descripcion: 'Nombramientos y cambios de puesto', generadoPorSistema: false },
  { nombre: 'Hoja de delincuencia', descripcion: 'Documento emitido por el Registro Judicial', generadoPorSistema: false },
  { nombre: 'Curriculum', descripcion: 'Se copia desde el Talent Pool al contratar', generadoPorSistema: true },
  {
    nombre: 'Constancia de vacaciones',
    descripcion: 'La genera SIGEL al aprobarse una solicitud de vacaciones',
    generadoPorSistema: true,
  },
];

async function main(): Promise<void> {
  console.log('Sembrando datos base de SIGEL...');

  // --- Permisos ---
  for (const permiso of PERMISOS) {
    await prisma.permiso.upsert({
      where: { clave: permiso.clave },
      update: { modulo: permiso.modulo, descripcion: permiso.descripcion, activo: true },
      create: permiso,
    });
  }
  console.log(`  Permisos: ${PERMISOS.length}`);

  // --- Roles de sistema y sus permisos ---
  const todosLosPermisos = await prisma.permiso.findMany();
  const idPorClave = new Map(todosLosPermisos.map((p: { clave: string; id: string }) => [p.clave, p.id] as const));

  for (const rol of ROLES) {
    const registro = await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion, esSistema: true, activo: true },
      create: { nombre: rol.nombre, descripcion: rol.descripcion, esSistema: true },
    });

    const claves = rol.permisos === 'todos' ? PERMISOS.map((p) => p.clave) : rol.permisos;
    for (const clave of claves) {
      const permisoId = idPorClave.get(clave);
      if (!permisoId) continue;
      const yaExiste = await prisma.rolPermiso.findFirst({ where: { rolId: registro.id, permisoId } });
      if (!yaExiste) {
        await prisma.rolPermiso.create({ data: { rolId: registro.id, permisoId } });
      }
    }
    console.log(`  Rol: ${rol.nombre} (${claves.length} permisos)`);
  }

  // --- Regimenes de vacaciones ---
  for (const regimen of REGIMENES) {
    await prisma.regimenVacaciones.upsert({
      where: { nombre: regimen.nombre },
      update: regimen,
      create: regimen,
    });
  }
  console.log(`  Regimenes de vacaciones: ${REGIMENES.length}`);

  // --- Tipos de documento ---
  for (const tipo of TIPOS_DOCUMENTO) {
    await prisma.tipoDocumento.upsert({
      where: { nombre: tipo.nombre },
      update: { descripcion: tipo.descripcion, generadoPorSistema: tipo.generadoPorSistema },
      create: tipo,
    });
  }
  console.log(`  Tipos de documento: ${TIPOS_DOCUMENTO.length}`);

  // --- Cuenta del Super Administrador ---
  const correo = process.env.SEED_ADMIN_CORREO ?? 'informatica@munipalmares.go.cr';
  const existente = await prisma.usuario.findUnique({ where: { correo } });

  if (existente) {
    console.log(`  Super Administrador: ya existe (${correo}), no se toca su contrasena.`);
  } else {
    const generada = !process.env.SEED_ADMIN_CONTRASENA;
    const contrasena = process.env.SEED_ADMIN_CONTRASENA ?? randomBytes(9).toString('base64url');
    const usuario = await prisma.usuario.create({
      data: {
        correo,
        contrasenaHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
        debeCambiarContrasena: true,
      },
    });

    const rolSuper = await prisma.rol.findUnique({ where: { nombre: 'Super Administrador' } });
    if (rolSuper) {
      await prisma.usuarioRol.create({ data: { usuarioId: usuario.id, rolId: rolSuper.id } });
    }

    console.log('  Super Administrador creado:');
    console.log(`    correo:     ${correo}`);
    console.log(`    contrasena: ${contrasena}${generada ? '   <-- generada al azar, anotela ahora' : ''}`);
    console.log('    El sistema le exigira cambiarla en el primer ingreso.');
  }

  console.log('Listo.');
}

main()
  .catch((error) => {
    console.error('El seed fallo:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
