import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VacacionesService } from './vacaciones.service.js';

/** Cada cuanto se revisa (minutos). Por omision, cada 6 horas: el aviso no se repite gracias a la "referencia". */
const MINUTOS_ENTRE_REVISIONES = Number(process.env.AVISOS_REVISION_MINUTOS ?? 360);
/** Espera despues de arrancar, para no competir con el arranque. */
const SEGUNDOS_ANTES_DE_LA_PRIMERA = Number(process.env.AVISOS_PRIMERA_REVISION_SEGUNDOS ?? 30);

/**
 * Revision periodica de avisos (Sprint 3), dentro del mismo backend, sin
 * instalar nada (decision de Josthyn, 10/10):
 *
 *  1. Tope de vacaciones: UNA vez por aniversario, cuando entra en el aviso
 *     previo de su regimen (Reglas de vacaciones, 30 dias por omision) y va
 *     a pasar el tope de periodos. A la persona, a su jefatura y a RRHH
 *     (13/10). Con "avisar" los dias no se pierden; con "vencer", si.
 *  2. "Asignar nueva jefatura": a RRHH, por si una jefatura dejo de serlo
 *     por un vencimiento (las salidas y los cambios de cuenta ya avisan al
 *     momento).
 *
 * No repite avisos: se guardan con una referencia (la fecha del aniversario
 * o la jefatura vieja) y se revisa antes de crear otro. Si el servidor se
 * reinicia, la primera revision vuelve a correr y no duplica nada.
 */
@Injectable()
export class AvisosPeriodicosService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly registro = new Logger('AvisosPeriodicos');
  private temporizador: NodeJS.Timeout | null = null;
  private intervalo: NodeJS.Timeout | null = null;
  private corriendo = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vacaciones: VacacionesService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  onApplicationBootstrap(): void {
    if (MINUTOS_ENTRE_REVISIONES <= 0) return; // 0 = apagado
    this.temporizador = setTimeout(() => void this.revisar(), SEGUNDOS_ANTES_DE_LA_PRIMERA * 1000);
    this.intervalo = setInterval(() => void this.revisar(), MINUTOS_ENTRE_REVISIONES * 60_000);
    this.temporizador.unref();
    this.intervalo.unref();
  }

  onApplicationShutdown(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.intervalo) clearInterval(this.intervalo);
  }

  /** Una pasada completa. Publica para poder probarla; nunca lanza error. */
  async revisar(): Promise<{ vacacionesPorVencer: number; jefaturas: number }> {
    if (this.corriendo) return { vacacionesPorVencer: 0, jefaturas: 0 };
    this.corriendo = true;
    try {
      const vacacionesPorVencer = await this.avisarVacacionesPorVencer();
      const jefaturas = await this.notificaciones.avisarJefaturasPorRevisar();
      if (vacacionesPorVencer || jefaturas) {
        this.registro.log(`Avisos periódicos: ${vacacionesPorVencer} de vacaciones por vencer, ${jefaturas} de jefatura por asignar.`);
      }
      return { vacacionesPorVencer, jefaturas };
    } catch (error) {
      this.registro.warn(`Falló la revisión periódica: ${error instanceof Error ? error.message : String(error)}`);
      return { vacacionesPorVencer: 0, jefaturas: 0 };
    } finally {
      this.corriendo = false;
    }
  }

  private async avisarVacacionesPorVencer(): Promise<number> {
    // Todas las personas activas: a RRHH y a la jefatura se les avisa aunque la
    // persona no tenga cuenta; a la persona, solo si tiene cuenta activa.
    const personas = await this.prisma.funcionario.findMany({
      where: { estado: 'activo' },
      select: { id: true, nombre: true, primerApellido: true, segundoApellido: true },
    });
    let avisos = 0;
    for (const p of personas) {
      try {
        const r = await this.vacaciones.resumen(p.id);
        const proximo = r.proximoPeriodo;
        if (!proximo.avisar) continue;
        const nombre = [p.nombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' ');
        const fecha = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${proximo.fecha}T00:00:00Z`));
        const dias = `${proximo.diasEnRiesgo} ${proximo.diasEnRiesgo === 1 ? 'día' : 'días'}`;
        const tope = `${r.regimen.periodosMaximos} ${r.regimen.periodosMaximos === 1 ? 'periodo' : 'periodos'}`;
        const vencen = r.regimen.alSuperarElTope === 'vencer';
        const base = { entidad: 'funcionario', registroId: p.id, referencia: proximo.fecha };

        // 1. A la persona.
        if (!(await this.notificaciones.yaSeAviso('vacacionesPorVencer', p.id, proximo.fecha))) {
          avisos += await this.notificaciones.avisarAFuncionario(p.id, {
            ...base,
            clave: 'vacacionesPorVencer',
            titulo: vencen ? 'Tiene días de vacaciones por perder' : 'Va a pasar el tope de vacaciones',
            mensaje: vencen
              ? `El ${fecha} perdería ${dias} de vacaciones porque pasaría del tope de ${tope}. Pida vacaciones antes de esa fecha para no perderlos.`
              : `El ${fecha} su saldo pasará el tope de ${tope} con ${dias} de más. No los pierde, pero conviene que programe vacaciones con su jefatura.`,
            enlace: '/mis-ausencias',
          });
        }
        // 2. A su jefatura y a RRHH, para que le programen vacaciones (13/10).
        if (!(await this.notificaciones.yaSeAviso('vacacionesSobreElTope', p.id, proximo.fecha))) {
          const aviso = {
            ...base,
            clave: 'vacacionesSobreElTope' as const,
            titulo: `Vacaciones por programar: ${nombre}`,
            mensaje: vencen
              ? `${nombre} perdería ${dias} de vacaciones el ${fecha} por pasar el tope de ${tope}. Conviene programarle vacaciones antes.`
              : `${nombre} pasará el tope de ${tope} el ${fecha} con ${dias} de más (no los pierde). Conviene programarle vacaciones.`,
          };
          avisos += await this.notificaciones.avisarAJefaturaDe(p.id, { ...aviso, enlace: '/calendario?alcance=equipo' });
          avisos += await this.notificaciones.avisarARrhh({ ...aviso, enlace: `/funcionarios?ver=${p.id}` });
        }
      } catch (error) {
        this.registro.warn(`No se pudo revisar el saldo de un funcionario: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return avisos;
  }
}
