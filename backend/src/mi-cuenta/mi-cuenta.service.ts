import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import {
  CAMPOS_LABORALES,
  CAMPOS_PERSONALES_PROPIOS,
  FuncionariosService,
  type DetalleDeFuncionario,
  type OpcionesDeFormulario,
} from '../funcionarios/funcionarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActualizarDatosLaboralesDto, ActualizarDatosPersonalesDto } from './dto/actualizar-datos-personales.dto.js';

/** Lo que devuelve GET /mi-cuenta. */
export interface PerfilPropio {
  cuenta: {
    id: string;
    correo: string;
    estado: string;
    ultimoAcceso: Date | null;
    fechaCreacion: Date;
    roles: string[];
  };
  /** Ficha completa (la misma de Funcionarios), mas si tiene foto. Null en la cuenta tecnica. */
  funcionario: (DetalleDeFuncionario & { tieneFoto: boolean }) | null;
  /** Profesiones activas, para el formulario de datos personales. */
  profesiones: { id: string; nombre: string }[];
  /** Puede cambiar sus datos personales (perfilPropio.editar). */
  puedeEditarDatos: boolean;
  /** Puede cambiar sus datos laborales (funcionarios.editar: Recursos Humanos). */
  puedeEditarLaborales: boolean;
  /** Listas del formulario laboral; solo si puedeEditarLaborales. Sin la propia persona en jefaturas. */
  opcionesLaborales: OpcionesDeFormulario | null;
}

/**
 * "Mi cuenta": todo sobre la propia persona. Los datos se leen y guardan
 * con FuncionariosService (modo.propio), asi las reglas (nombres, telefono,
 * fechas, unicos, jefatura) son las mismas que en "Editar funcionario".
 *
 *   - Datos personales: cada quien los cambia (perfilPropio.editar), todo
 *     menos la cedula, que identifica a la persona y la corrige RRHH.
 *   - Datos laborales: todos los VEN; solo quien tiene funcionarios.editar
 *     (Recursos Humanos) los cambia, tambien los suyos (decision de Josthyn,
 *     28/09: no tiene sentido pedirle a otra persona de RRHH que lo haga).
 */
@Injectable()
export class MiCuentaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly funcionarios: FuncionariosService,
  ) {}

  /** Perfil completo para la pantalla "Mi cuenta". */
  async consultar(usuario: UsuarioAutenticado): Promise<PerfilPropio> {
    const cuenta = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: {
        id: true,
        correo: true,
        estado: true,
        ultimoAcceso: true,
        fechaCreacion: true,
        funcionario: { select: { id: true, fotoRuta: true } },
      },
    });
    if (!cuenta) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', message: 'No se encontró su cuenta.' });

    const profesiones = await this.prisma.profesion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });

    const ficha = cuenta.funcionario ? await this.funcionarios.consultarUno(cuenta.funcionario.id, usuario) : null;
    const puedeEditarLaborales = Boolean(ficha) && usuario.permisos.includes('funcionarios.editar');
    let opcionesLaborales: OpcionesDeFormulario | null = null;
    if (puedeEditarLaborales) {
      const opciones = await this.funcionarios.opcionesDeFormulario();
      // Nadie es su propia jefatura.
      opcionesLaborales = { ...opciones, jefaturas: opciones.jefaturas.filter((j) => j.id !== ficha!.id) };
    }

    return {
      cuenta: {
        id: cuenta.id,
        correo: cuenta.correo,
        estado: cuenta.estado,
        ultimoAcceso: cuenta.ultimoAcceso,
        fechaCreacion: cuenta.fechaCreacion,
        roles: usuario.roles,
      },
      // La ruta del archivo no sale del backend; la foto se servira por un
      // endpoint propio cuando exista la carga de archivos (epica 3).
      funcionario: ficha ? { ...ficha, tieneFoto: Boolean(cuenta.funcionario!.fotoRuta) } : null,
      profesiones,
      puedeEditarDatos: usuario.permisos.includes('perfilPropio.editar'),
      puedeEditarLaborales,
      opcionesLaborales,
    };
  }

  /** La persona cambia sus datos personales (todo menos la cedula). */
  async actualizarDatosPersonales(usuario: UsuarioAutenticado, datos: ActualizarDatosPersonalesDto, direccionIp?: string): Promise<PerfilPropio> {
    await this.funcionarios.editar(this.funcionarioPropio(usuario), datos, usuario, direccionIp, {
      propio: true,
      campos: CAMPOS_PERSONALES_PROPIOS,
    });
    return this.consultar(usuario);
  }

  /** Recursos Humanos cambia sus propios datos laborales. */
  async actualizarDatosLaborales(usuario: UsuarioAutenticado, datos: ActualizarDatosLaboralesDto, direccionIp?: string): Promise<PerfilPropio> {
    await this.funcionarios.editar(this.funcionarioPropio(usuario), datos, usuario, direccionIp, {
      propio: true,
      campos: CAMPOS_LABORALES,
    });
    return this.consultar(usuario);
  }

  /** Id del funcionario de la sesion; la cuenta tecnica no tiene. */
  private funcionarioPropio(usuario: UsuarioAutenticado): string {
    if (!usuario.funcionarioId) {
      throw new BadRequestException({
        codigo: 'CUENTA_SIN_FUNCIONARIO',
        message: 'Esta cuenta no está ligada a un funcionario: no tiene datos personales ni laborales que actualizar.',
      });
    }
    return usuario.funcionarioId;
  }
}
