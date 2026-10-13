import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { BitacoraService } from '../bitacora/bitacora.service.js';
import { hoyEnCostaRica } from '../comun/fechas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GuardarRegimenDto, TramoDto } from './dto/reglas-de-vacaciones.dto.js';

export interface TramoDeVacaciones {
  aniosMinimos: number;
  /** null = en adelante. */
  aniosMaximos: number | null;
  diasPorPeriodo: number;
}

export interface RegimenDeVacaciones {
  id: string;
  nombre: string;
  descripcion: string | null;
  periodosMaximosAcumulables: number;
  diasAvisoAntesDeVencer: number;
  /** "avisar" (por omision): se acumula igual y se avisa; "vencer": lo que pase del tope se pierde. */
  alSuperarElTope: 'avisar' | 'vencer';
  activo: boolean;
  /** Funcionarios activos con este regimen. */
  funcionariosActivos: number;
  tramos: TramoDeVacaciones[];
}

/** "0 a 5 años: 15 días; 6 años en adelante: 20 días" (para la bitacora). */
function describir(tramos: TramoDeVacaciones[]): string {
  return tramos
    .map((t) => `${t.aniosMaximos === null ? `${t.aniosMinimos} años en adelante` : `${t.aniosMinimos} a ${t.aniosMaximos} años`}: ${t.diasPorPeriodo} días`)
    .join('; ');
}

/**
 * Reglas de vacaciones (HU 27 CA04: "parametrizable sin modificar el codigo").
 * RRHH edita, por regimen, los tramos (cuantos dias por periodo segun los
 * anios de servicio cumplidos), el tope de periodos acumulables y con cuantos
 * dias de anticipacion se avisa que se llegara al tope, y que pasa al
 * superarlo (13/10): por omision solo se avisa y el saldo sigue creciendo;
 * RRHH puede cambiar a "vencer" (y volver) en cualquier momento. El cambio
 * rige desde el proximo aniversario de cada persona: no devuelve ni quita
 * dias que ya se movieron.
 *
 * Los tramos deben cubrir de 0 anios en adelante, seguidos y sin huecos, y el
 * ultimo queda abierto ("en adelante"). Solo dias completos.
 *
 * Los cambios rigen para los PROXIMOS aniversarios: lo que ya se gano esta en
 * movimientos y no se recalcula. Cada cambio queda en la bitacora con el antes
 * y el despues.
 */
@Injectable()
export class ReglasDeVacacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async consultar(): Promise<RegimenDeVacaciones[]> {
    const filas = await this.prisma.regimenVacaciones.findMany({
      orderBy: { nombre: 'desc' }, // "general" antes que "anterior"
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        periodosMaximosAcumulables: true,
        diasAvisoAntesDeVencer: true,
        alSuperarElTope: true,
        activo: true,
        reglas: { where: { activo: true }, orderBy: { aniosMinimos: 'asc' }, select: { aniosMinimos: true, aniosMaximos: true, diasPorPeriodo: true } },
        _count: { select: { funcionarios: { where: { estado: 'activo' } } } },
      },
    });
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      periodosMaximosAcumulables: f.periodosMaximosAcumulables,
      diasAvisoAntesDeVencer: f.diasAvisoAntesDeVencer,
      alSuperarElTope: f.alSuperarElTope,
      activo: f.activo,
      funcionariosActivos: f._count.funcionarios,
      tramos: f.reglas.map((r) => ({ aniosMinimos: r.aniosMinimos, aniosMaximos: r.aniosMaximos, diasPorPeriodo: Number(r.diasPorPeriodo) })),
    }));
  }

  async guardar(regimenId: string, datos: GuardarRegimenDto, quienActua: UsuarioAutenticado, direccionIp?: string): Promise<RegimenDeVacaciones> {
    const antes = (await this.consultar()).find((r) => r.id === regimenId);
    if (!antes) throw new NotFoundException({ codigo: 'REGIMEN_NO_ENCONTRADO', message: 'No se encontró el régimen de vacaciones indicado.' });
    const tramos = validarTramos(datos.tramos);
    const descripcion = datos.descripcion === undefined ? antes.descripcion : datos.descripcion || null;
    const alSuperarElTope = datos.alSuperarElTope ?? antes.alSuperarElTope;

    const mismos =
      descripcion === antes.descripcion &&
      datos.periodosMaximosAcumulables === antes.periodosMaximosAcumulables &&
      datos.diasAvisoAntesDeVencer === antes.diasAvisoAntesDeVencer &&
      alSuperarElTope === antes.alSuperarElTope &&
      describir(tramos) === describir(antes.tramos);
    if (mismos) throw new BadRequestException({ codigo: 'SIN_CAMBIOS', message: 'No hay nada que cambiar: las reglas son las mismas.' });

    await this.prisma.$transaction(async (tx) => {
      await tx.regimenVacaciones.update({
        where: { id: regimenId },
        data: { descripcion, periodosMaximosAcumulables: datos.periodosMaximosAcumulables, diasAvisoAntesDeVencer: datos.diasAvisoAntesDeVencer, alSuperarElTope },
      });
      // Los tramos se reemplazan completos (el antes queda en la bitacora).
      await tx.reglaVacaciones.deleteMany({ where: { regimenVacacionesId: regimenId } });
      await tx.reglaVacaciones.createMany({
        data: tramos.map((t) => ({ regimenVacacionesId: regimenId, aniosMinimos: t.aniosMinimos, aniosMaximos: t.aniosMaximos, diasPorPeriodo: t.diasPorPeriodo, vigenteDesde: hoyEnCostaRica() })),
      });
      await this.bitacora.registrar(
        {
          usuarioId: quienActua.id,
          entidad: 'regimenVacaciones',
          registroAfectadoId: regimenId,
          accion: 'modificar',
          direccionIp,
          datosAnteriores: { periodosMaximos: antes.periodosMaximosAcumulables, diasAviso: antes.diasAvisoAntesDeVencer, alSuperarElTope: antes.alSuperarElTope, tramos: antes.tramos, descripcion: antes.descripcion },
          datosNuevos: { periodosMaximos: datos.periodosMaximosAcumulables, diasAviso: datos.diasAvisoAntesDeVencer, alSuperarElTope, tramos, descripcion },
          descripcion: `Cambió las reglas del régimen «${antes.nombre}»: ${describir(tramos)}; tope de ${datos.periodosMaximosAcumulables} periodo(s); al superarlo, ${alSuperarElTope === 'vencer' ? 'vencen los días' : 'solo se avisa'}.`,
        },
        tx,
      );
    });
    return (await this.consultar()).find((r) => r.id === regimenId)!;
  }
}

/** Revisa que los tramos cubran de 0 en adelante, seguidos y sin huecos. Devuelve la lista ordenada. */
export function validarTramos(entrada: TramoDto[]): TramoDeVacaciones[] {
  const tramos = [...entrada]
    .map((t) => ({ aniosMinimos: t.aniosMinimos, aniosMaximos: t.aniosMaximos ?? null, diasPorPeriodo: t.diasPorPeriodo }))
    .sort((a, b) => a.aniosMinimos - b.aniosMinimos);
  const error = (message: string) => new BadRequestException({ codigo: 'REGLA_NO_VALIDA', message });
  if (tramos[0].aniosMinimos !== 0) throw error('El primer tramo debe empezar en 0 años (desde que la persona entra).');
  tramos.forEach((t, i) => {
    const ultimo = i === tramos.length - 1;
    if (ultimo && t.aniosMaximos !== null) throw error('El último tramo debe quedar abierto ("en adelante").');
    if (!ultimo && t.aniosMaximos === null) throw error('Solo el último tramo puede quedar abierto ("en adelante").');
    if (t.aniosMaximos !== null && t.aniosMaximos < t.aniosMinimos) throw error(`El tramo que empieza en ${t.aniosMinimos} años termina antes de empezar.`);
    if (!ultimo && tramos[i + 1].aniosMinimos !== (t.aniosMaximos as number) + 1) {
      throw error(`Los tramos deben ir seguidos: después de ${t.aniosMaximos} años, el siguiente empieza en ${(t.aniosMaximos as number) + 1}.`);
    }
  });
  return tramos;
}
