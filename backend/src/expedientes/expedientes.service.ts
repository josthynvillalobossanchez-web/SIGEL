import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { armarPagina, type PaginacionDto, type PaginaDeResultados } from '../comun/dto/paginacion.dto.js';
import { ETIQUETAS, FuncionariosService, type DetalleDeFuncionario } from '../funcionarios/funcionarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Permiso para abrir el expediente de OTRA persona (solo Recursos Humanos). */
export const PERMISO_EXPEDIENTES_AJENOS = 'expediente.verTodos';

/** Lo que devuelve abrir un expediente. */
export interface Expediente {
  funcionario: DetalleDeFuncionario;
  /** Es el expediente de quien lo abre (solo lectura: sus datos se cambian en Mi cuenta). */
  esPropio: boolean;
}

/** Una entrada del historial laboral (linea de tiempo). */
export interface MovimientoDelHistorial {
  id: string;
  /** Cuando se registro en el sistema (ISO). */
  fechaHora: string;
  tipo: 'ingreso' | 'cambio' | 'salida' | 'reingreso';
  titulo: string;
  /** Fecha en que ocurrio de verdad (ingreso, salida, reingreso), "AAAA-MM-DD". */
  fechaEfectiva: string | null;
  /** Texto extra, p. ej. el motivo de la salida. */
  detalle: string | null;
  /** Que cambio, de que valor a cual (en texto legible). */
  cambios: { campo: string; antes: string | null; despues: string | null }[];
  /** Quien lo hizo (nombre, o el correo si es la cuenta tecnica). */
  quien: string;
}

/**
 * Datos LABORALES que se muestran en el historial. Los cambios de datos
 * personales (telefono, direccion...) quedan en la bitacora pero no son
 * historial laboral (CONTEXTO: "Historial laboral (Ficha 17)").
 */
const CAMPOS_LABORALES = ['puesto', 'departamento', 'jefatura', 'tipoNombramiento', 'regimenVacaciones', 'fechaIngreso', 'numeroEmpleado'];

/** Tope de movimientos que se revisan por funcionario (sobra para una vida laboral). */
const TOPE_DE_MOVIMIENTOS = 2000;

type Fila = {
  id: string;
  accion: string;
  fechaHora: Date;
  datosAnteriores: unknown;
  datosNuevos: unknown;
  usuario: { correo: string; funcionario: { nombre: string; primerApellido: string; segundoApellido: string | null } | null } | null;
};

/**
 * Expediente laboral. Reglas (decision de Josthyn, 28/09):
 *   - Cada persona abre SU expediente (expediente.ver), solo para ver.
 *   - El de otra persona, solo Recursos Humanos (expediente.verTodos);
 *     si no, EXPEDIENTE_AJENO. La jefatura (Aprobador) y Consulta no.
 *   - Abrirlo queda en la bitacora (T-4), tambien el propio.
 *   - El historial laboral sale de la bitacora filtrada por el funcionario
 *     (sin tabla aparte): ingreso, cambios laborales, salida y reingreso.
 *     Cuando exista la gestion documental se agregan los documentos
 *     agregados y dados de baja (entidad "documento").
 */
@Injectable()
export class ExpedientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly funcionarios: FuncionariosService,
  ) {}

  /** Id del funcionario de la sesion; la cuenta tecnica no tiene expediente. */
  idPropio(quienActua: UsuarioAutenticado): string {
    if (!quienActua.funcionarioId) {
      throw new BadRequestException({
        codigo: 'CUENTA_SIN_FUNCIONARIO',
        message: 'Esta cuenta no está ligada a un funcionario: no tiene expediente.',
      });
    }
    return quienActua.funcionarioId;
  }

  async abrir(funcionarioId: string, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<Expediente> {
    this.revisarAcceso(funcionarioId, quienActua);
    const funcionario = await this.funcionarios.consultarUno(funcionarioId, quienActua);
    const esPropio = funcionarioId === quienActua.funcionarioId;
    const nombre = [funcionario.nombre, funcionario.primerApellido, funcionario.segundoApellido].filter(Boolean).join(' ');

    await this.bitacora.registrar({
      usuarioId: quienActua.id,
      entidad: 'expediente',
      registroAfectadoId: funcionarioId,
      funcionarioAfectadoId: funcionarioId,
      accion: 'consultar',
      direccionIp,
      descripcion: esPropio ? 'Abrió su propio expediente.' : `Abrió el expediente de ${nombre}.`,
    });

    return { funcionario, esPropio };
  }

  async historial(
    funcionarioId: string,
    paginacion: PaginacionDto,
    quienActua: UsuarioAutenticado,
  ): Promise<PaginaDeResultados<MovimientoDelHistorial>> {
    this.revisarAcceso(funcionarioId, quienActua);
    const { pagina, tamano } = paginacion;

    const filas = await this.prisma.bitacoraCambio.findMany({
      where: { funcionarioAfectadoId: funcionarioId, entidad: 'funcionario', accion: { in: ['crear', 'modificar'] } },
      orderBy: { fechaHora: 'desc' },
      take: TOPE_DE_MOVIMIENTOS,
      select: {
        id: true,
        accion: true,
        fechaHora: true,
        datosAnteriores: true,
        datosNuevos: true,
        usuario: { select: { correo: true, funcionario: { select: { nombre: true, primerApellido: true, segundoApellido: true } } } },
      },
    });

    // Se filtra aqui (no en SQL) porque hay que mirar DENTRO del JSON si el
    // cambio toco algun dato laboral. Por funcionario son pocos movimientos.
    const movimientos = filas.map((fila) => this.aMovimiento(fila)).filter((m): m is MovimientoDelHistorial => m !== null);
    return armarPagina(movimientos.slice((pagina - 1) * tamano, pagina * tamano), movimientos.length, pagina, tamano);
  }

  /* ---------------------------------------------------------------- */

  /** El propio siempre; el de otra persona, solo con expediente.verTodos. */
  private revisarAcceso(funcionarioId: string, quienActua: UsuarioAutenticado): void {
    if (funcionarioId === quienActua.funcionarioId) return;
    if (quienActua.permisos.includes(PERMISO_EXPEDIENTES_AJENOS)) return;
    throw new ForbiddenException({
      codigo: 'EXPEDIENTE_AJENO',
      message: 'Solo Recursos Humanos puede abrir el expediente de otra persona. Usted puede ver el suyo en «Mi expediente».',
    });
  }

  /** Convierte una fila de la bitacora en una entrada del historial (o null si no es laboral). */
  private aMovimiento(fila: Fila): MovimientoDelHistorial | null {
    const antes = (fila.datosAnteriores ?? {}) as Record<string, unknown>;
    const despues = (fila.datosNuevos ?? {}) as Record<string, unknown>;
    const quien = fila.usuario
      ? fila.usuario.funcionario
        ? [fila.usuario.funcionario.nombre, fila.usuario.funcionario.primerApellido, fila.usuario.funcionario.segundoApellido].filter(Boolean).join(' ')
        : fila.usuario.correo
      : 'Sistema';
    const base = { id: fila.id, fechaHora: fila.fechaHora.toISOString(), quien, detalle: null, fechaEfectiva: null, cambios: [] };

    if (fila.accion === 'crear') {
      return {
        ...base,
        tipo: 'ingreso',
        titulo: 'Registro e ingreso a la Municipalidad',
        fechaEfectiva: texto(despues.fechaIngreso),
        cambios: ['puesto', 'departamento', 'jefatura', 'tipoNombramiento', 'regimenVacaciones']
          .filter((campo) => despues[campo] !== undefined)
          .map((campo) => ({ campo: etiqueta(campo), antes: null, despues: valor(campo, despues[campo]) })),
      };
    }
    if (despues.estado === 'inactivo') {
      return { ...base, tipo: 'salida', titulo: 'Salida de la Municipalidad', fechaEfectiva: texto(despues.fechaSalida), detalle: texto(despues.motivoSalida) };
    }
    if (despues.estado === 'activo' && antes.estado === 'inactivo') {
      return {
        ...base,
        tipo: 'reingreso',
        titulo: 'Reingreso a la Municipalidad',
        fechaEfectiva: texto(despues.fechaIngreso),
        detalle: antes.fechaSalida ? `Había salido el ${formatear(String(antes.fechaSalida))}.` : null,
      };
    }

    const campos = CAMPOS_LABORALES.filter((campo) => campo in despues);
    if (campos.length === 0) return null; // solo datos personales: no es historial laboral
    return {
      ...base,
      tipo: 'cambio',
      titulo: campos.length === 1 ? `Cambio de ${etiqueta(campos[0]).toLowerCase()}` : 'Cambio de datos laborales',
      cambios: campos.map((campo) => ({ campo: etiqueta(campo), antes: valor(campo, antes[campo]), despues: valor(campo, despues[campo]) })),
    };
  }
}

/** Etiqueta con mayuscula inicial ("puesto" -> "Puesto"). */
function etiqueta(campo: string): string {
  const texto = ETIQUETAS[campo] ?? campo;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Valor legible para la pantalla: fechas dd/mm/aaaa y regimen con mayuscula. */
function valor(campo: string, crudo: unknown): string | null {
  const t = texto(crudo);
  if (t === null) return null;
  if (campo === 'fechaIngreso') return formatear(t);
  if (campo === 'regimenVacaciones') return t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

function texto(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v);
}

/** "2026-10-31" -> "31/10/2026"; otro texto queda igual. */
function formatear(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : fecha;
}
