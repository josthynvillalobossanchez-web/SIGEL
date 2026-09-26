/*
 * Llamadas del expediente laboral (/api/expedientes).
 * Tipos de backend/src/expedientes/expedientes.service.ts.
 *
 * Abrir un expediente queda en la bitacora (T-4): se pide UNA vez al entrar
 * a la pagina. El historial se pide aparte (no se vuelve a anotar).
 */
import { pedirAlServidor } from './cliente';
import type { DetalleDeFuncionario } from './funcionarios';
import type { Pagina } from './usuarios';

export interface Expediente {
  funcionario: DetalleDeFuncionario;
  /** Es el expediente de quien lo abre (solo lectura). */
  esPropio: boolean;
}

export interface MovimientoDelHistorial {
  id: string;
  /** Cuando se registro en SIGEL (ISO). */
  fechaHora: string;
  tipo: 'ingreso' | 'cambio' | 'salida' | 'reingreso';
  titulo: string;
  /** Fecha en que ocurrio (ingreso, salida, reingreso), "AAAA-MM-DD". */
  fechaEfectiva: string | null;
  detalle: string | null;
  cambios: { campo: string; antes: string | null; despues: string | null }[];
  quien: string;
}

/** GET /expedientes/:id (o /expedientes/propio si no se indica id). */
export function abrirExpediente(funcionarioId?: string) {
  return pedirAlServidor<Expediente>('GET', `/expedientes/${funcionarioId ?? 'propio'}`);
}

/** GET /expedientes/:id/historial, paginado (lo mas reciente primero). */
export function consultarHistorial(funcionarioId: string, pagina: number, tamano = 20) {
  return pedirAlServidor<Pagina<MovimientoDelHistorial>>('GET', `/expedientes/${funcionarioId}/historial?pagina=${pagina}&tamano=${tamano}`);
}
