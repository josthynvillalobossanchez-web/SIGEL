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
  { clave: 'funcionarios.editar', modulo: 'funcionarios', descripcion: 'Modificar la información de un funcionario' },
  { clave: 'expediente.ver', modulo: 'expediente', descripcion: 'Abrir el expediente laboral' },
  { clave: 'documentos.crear', modulo: 'documentos', descripcion: 'Subir documentos al expediente' },
  { clave: 'documentos.descargar', modulo: 'documentos', descripcion: 'Ver y descargar documentos' },
  { clave: 'documentos.darDeBaja', modulo: 'documentos', descripcion: 'Dar de baja cualquier documento, sin eliminarlo' },
  {
    clave: 'documentos.darDeBajaPropio',
    modulo: 'documentos',
    descripcion: 'Dar de baja únicamente los documentos que subió la propia persona',
  },
  { clave: 'documentos.restaurar', modulo: 'documentos', descripcion: 'Restaurar un documento dado de baja' },
  { clave: 'tiposDocumento.editar', modulo: 'tiposDocumento', descripcion: 'Administrar el catálogo de tipos de documento' },
  { clave: 'usuarios.ver', modulo: 'usuarios', descripcion: 'Consultar las cuentas de usuario' },
  { clave: 'usuarios.crear', modulo: 'usuarios', descripcion: 'Crear cuentas de usuario' },
  { clave: 'usuarios.editar', modulo: 'usuarios', descripcion: 'Modificar cuentas de usuario' },
  { clave: 'usuarios.cambiarEstado', modulo: 'usuarios', descripcion: 'Activar, inactivar o bloquear una cuenta' },
  { clave: 'roles.editar', modulo: 'roles', descripcion: 'Administrar los roles y sus permisos' },
  { clave: 'permisos.editar', modulo: 'permisos', descripcion: 'Administrar el catálogo de permisos' },
  { clave: 'catalogos.editar', modulo: 'catalogos', descripcion: 'Administrar departamentos, puestos y profesiones' },
  { clave: 'bitacora.ver', modulo: 'bitacora', descripcion: 'Consultar la bitácora de auditoría' },
  { clave: 'perfilPropio.editar', modulo: 'perfilPropio', descripcion: 'Editar los datos personales y de contacto propios' },
  // Solicitudes (Sprint 2: vacaciones, permisos, incapacidades con
  // comprobante, capacitaciones que chocan con el horario). Se siembran desde
  // ya porque deciden cosas de este sprint (decision de Josthyn, 27/09):
  //   - solicitudes.crear: lo mas basico; lo tiene TODA cuenta (va en el
  //     autoservicio del Solicitante, y por eso en Aprobador y Administrador).
  //   - solicitudes.aprobar: aprobar o rechazar solicitudes. Lo tienen las
  //     jefaturas (rol Aprobador) y Recursos Humanos (Administrador), que
  //     lo necesita para poder asignar el rol Aprobador ("solo se da lo que
  //     se tiene"). Se puede conceder suelto a alguien como caso especial.
  //     OJO: JEFATURA INMEDIATA no se decide por este permiso sino por el
  //     ROL Aprobador permanente (ver ROL_DE_JEFATURA en funcionarios).
  { clave: 'solicitudes.crear', modulo: 'solicitudes', descripcion: 'Hacer solicitudes propias: vacaciones, permisos, incapacidades y capacitaciones' },
  {
    clave: 'solicitudes.aprobar',
    modulo: 'solicitudes',
    descripcion: 'Aprobar o rechazar las solicitudes del personal a cargo (puede ser jefatura inmediata)',
  },
];

// ---------------------------------------------------------------------
// Roles de sistema
// El alcance (propio expediente o cualquiera) es logica del backend, no
// una clave distinta de permiso.
// ---------------------------------------------------------------------
const AUTOSERVICIO = [
  'solicitudes.crear',
  'perfilPropio.editar',
  'expediente.ver',
  'documentos.crear',
  'documentos.descargar',
  'documentos.darDeBajaPropio',
];

const ROLES: { nombre: string; descripcion: string; permisos: string[] | 'todos' }[] = [
  {
    nombre: 'Super Administrador',
    descripcion: 'Control total del sistema. Único rol que consulta la bitácora de auditoría.',
    permisos: 'todos',
  },
  {
    nombre: 'Administrador',
    descripcion: 'Gestión completa de funcionarios, expedientes, usuarios y catálogos. Lo usa Recursos Humanos.',
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
      'solicitudes.crear',
      'solicitudes.aprobar',
    ],
  },
  {
    nombre: 'Aprobador',
    descripcion: 'Aprueba las solicitudes del personal a su cargo. Lo usan las jefaturas.',
    // Incluye todo lo del Solicitante (AUTOSERVICIO): una jefatura tambien
    // hace sus propias solicitudes.
    permisos: [...AUTOSERVICIO, 'funcionarios.ver', 'solicitudes.aprobar'],
  },
  {
    nombre: 'Solicitante',
    descripcion: 'Autoservicio sobre su propio expediente. Lo usa cualquier funcionario.',
    permisos: AUTOSERVICIO,
  },
  {
    nombre: 'Consulta',
    descripcion: 'Solo lectura de funcionarios y expedientes, sin ningún permiso de escritura. Auditoría Interna.',
    permisos: ['funcionarios.ver', 'expediente.ver', 'documentos.descargar', 'usuarios.ver'],
  },
];

const REGIMENES = [
  {
    nombre: 'general',
    descripcion: '15 días hábiles los primeros 6 años de servicio y 20 días después.',
    periodosMaximosAcumulables: 2,
    diasAvisoAntesDeVencer: 60,
  },
  {
    nombre: 'anterior',
    descripcion: '30 días para los funcionarios amparados al régimen anterior.',
    periodosMaximosAcumulables: 2,
    diasAvisoAntesDeVencer: 60,
  },
];

const TIPOS_DOCUMENTO = [
  { nombre: 'Cédula de identidad', descripcion: 'Copia del documento de identidad', generadoPorSistema: false },
  { nombre: 'Título universitario', descripcion: 'Grado académico del funcionario', generadoPorSistema: false },
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
    console.log(`  Super Administrador: ya existe (${correo}), no se toca su contraseña.`);
  } else {
    const generada = !process.env.SEED_ADMIN_CONTRASENA;
    const contrasena = process.env.SEED_ADMIN_CONTRASENA ?? randomBytes(9).toString('base64url');
    // Cuenta y rol en una sola operacion: si el seed se interrumpe, no queda
    // una cuenta de Super Administrador sin rol (que ademas el seed ya no
    // repararia, porque al volver a correr ve que la cuenta "ya existe").
    const rolSuper = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'Super Administrador' } });
    await prisma.usuario.create({
      data: {
        correo,
        contrasenaHash: await argon2.hash(contrasena, { type: argon2.argon2id }),
        debeCambiarContrasena: true,
        roles: { create: { rolId: rolSuper.id } },
      },
    });

    console.log('  Super Administrador creado:');
    console.log(`    correo:     ${correo}`);
    console.log(`    contraseña: ${contrasena}${generada ? '   <-- generada al azar, anotela ahora' : ''}`);
    console.log('    El sistema le exigirá cambiarla en el primer ingreso.');
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
