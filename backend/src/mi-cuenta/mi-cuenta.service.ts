import { aFechaSola } from '../comun/fechas.js';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActualizarDatosPersonalesDto } from './dto/actualizar-datos-personales.dto.js';

/** Campos de contacto que la persona puede cambiar de si misma. */
const CAMPOS_EDITABLES = [
  'telefonoPersonal',
  'correoPersonal',
  'correoInstitucional',
  'profesionId',
  'direccion',
] as const;

@Injectable()
export class MiCuentaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Perfil completo para la pantalla "Mi cuenta". */
  async consultar(usuario: UsuarioAutenticado): Promise<unknown> {
    const cuenta = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: {
        id: true,
        correo: true,
        estado: true,
        ultimoAcceso: true,
        fechaCreacion: true,
        funcionario: {
          select: {
            cedula: true,
            nombre: true,
            primerApellido: true,
            segundoApellido: true,
            telefonoPersonal: true,
            correoPersonal: true,
            correoInstitucional: true,
            direccion: true,
            fotoRuta: true,
            fechaIngreso: true,
            fechaNacimiento: true,
            numeroEmpleado: true,
            tipoNombramiento: true,
            estado: true,
            profesion: { select: { id: true, nombre: true } },
            puesto: { select: { nombre: true } },
            departamento: { select: { nombre: true } },
            jefatura: { select: { nombre: true, primerApellido: true, segundoApellido: true } },
            regimenVacaciones: { select: { nombre: true, descripcion: true } },
          },
        },
      },
    });

    if (!cuenta) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', message: 'No se encontró su cuenta.' });

    const profesiones = await this.prisma.profesion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });

    const f = cuenta.funcionario;
    return {
      cuenta: {
        id: cuenta.id,
        correo: cuenta.correo,
        estado: cuenta.estado,
        ultimoAcceso: cuenta.ultimoAcceso,
        fechaCreacion: cuenta.fechaCreacion,
        roles: usuario.roles,
      },
      funcionario: f
        ? {
            cedula: f.cedula,
            nombre: f.nombre,
            primerApellido: f.primerApellido,
            segundoApellido: f.segundoApellido,
            telefonoPersonal: f.telefonoPersonal,
            correoPersonal: f.correoPersonal,
            correoInstitucional: f.correoInstitucional,
            direccion: f.direccion,
            // Columna DATE: se devuelve "AAAA-MM-DD" (ver comun/fechas.ts).
            fechaIngreso: aFechaSola(f.fechaIngreso),
            profesion: f.profesion,
            puesto: f.puesto?.nombre ?? null,
            departamento: f.departamento?.nombre ?? null,
            // Datos laborales: la persona los VE en "Mi cuenta" pero no los cambia.
            fechaNacimiento: aFechaSola(f.fechaNacimiento),
            numeroEmpleado: f.numeroEmpleado,
            tipoNombramiento: f.tipoNombramiento,
            estado: f.estado,
            jefatura: f.jefatura ? [f.jefatura.nombre, f.jefatura.primerApellido, f.jefatura.segundoApellido].filter(Boolean).join(' ') : null,
            regimenVacaciones: f.regimenVacaciones,
            // La ruta del archivo no sale del backend; la foto se servira por
            // un endpoint propio cuando exista la carga de archivos (epica 3).
            tieneFoto: Boolean(f.fotoRuta),
          }
        : null,
      profesiones,
      puedeEditarDatos: usuario.permisos.includes('perfilPropio.editar'),
    };
  }

  /**
   * La persona cambia sus datos de contacto.
   *   - Solo si su cuenta esta ligada a un funcionario.
   *   - Correo institucional: no puede ser el de otra persona.
   *   - Profesion: debe existir y estar activa.
   *   - Si no cambia nada: SIN_CAMBIOS.
   *   - Queda en la bitacora con lo anterior y lo nuevo (solo lo que cambio).
   */
  async actualizarDatosPersonales(
    usuario: UsuarioAutenticado,
    datos: ActualizarDatosPersonalesDto,
    direccionIp?: string,
  ): Promise<unknown> {
    if (!usuario.funcionarioId) {
      throw new BadRequestException({
        codigo: 'CUENTA_SIN_FUNCIONARIO',
        message: 'Esta cuenta no está ligada a un funcionario: no tiene datos personales que actualizar.',
      });
    }
    if (datos.correoPersonal === null) {
      throw new BadRequestException({
        codigo: 'DATOS_INVALIDOS',
        message: 'El correo personal es obligatorio: es el canal de respaldo de las notificaciones.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.funcionario.findUniqueOrThrow({
        where: { id: usuario.funcionarioId! },
        select: { id: true, telefonoPersonal: true, correoPersonal: true, correoInstitucional: true, profesionId: true, direccion: true },
      });

      // Solo lo que viene y es distinto de lo guardado.
      const cambios: Record<string, string | null> = {};
      const anteriores: Record<string, string | null> = {};
      for (const campo of CAMPOS_EDITABLES) {
        const nuevo = datos[campo];
        if (nuevo === undefined) continue;
        const valor = campo.startsWith('correo') && typeof nuevo === 'string' ? nuevo.toLowerCase() : nuevo;
        if (valor !== actual[campo]) {
          cambios[campo] = valor;
          anteriores[campo] = actual[campo];
        }
      }

      if (Object.keys(cambios).length === 0) {
        throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay cambios que guardar.' });
      }

      if (cambios.correoInstitucional) {
        const ocupado = await tx.funcionario.findFirst({
          where: { correoInstitucional: cambios.correoInstitucional, NOT: { id: actual.id } },
          select: { id: true },
        });
        if (ocupado) {
          throw new ConflictException({
            codigo: 'CORREO_INSTITUCIONAL_EN_USO',
            message: 'Ese correo institucional ya pertenece a otra persona.',
          });
        }
      }

      if (cambios.profesionId) {
        const profesion = await tx.profesion.findUnique({ where: { id: cambios.profesionId }, select: { activo: true } });
        if (!profesion || !profesion.activo) {
          throw new BadRequestException({ codigo: 'PROFESION_NO_VALIDA', message: 'La profesión elegida no existe o ya no está activa.' });
        }
      }

      await tx.funcionario.update({ where: { id: actual.id }, data: cambios });

      await this.bitacora.registrar(
        {
          usuarioId: usuario.id,
          entidad: 'funcionario',
          registroAfectadoId: actual.id,
          accion: 'modificar',
          funcionarioAfectadoId: actual.id,
          direccionIp,
          datosAnteriores: anteriores,
          datosNuevos: cambios,
          descripcion: `Actualizó sus propios datos personales (${Object.keys(cambios).join(', ')}).`,
        },
        tx,
      );
    });

    return this.consultar(usuario);
  }
}
