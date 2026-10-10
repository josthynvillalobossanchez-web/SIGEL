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
  /** Tiene fotografia de perfil. */
  tieneFoto: boolean;
}

export interface MovimientoDelHistorial {
  id: string;
  /** Cuando se registro en SINERGIA (ISO). */
  fechaHora: string;
  tipo: 'ingreso' | 'cambio' | 'salida' | 'reingreso' | 'documentoAgregado' | 'documentoBaja' | 'documentoRestaurado';
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

export type TipoDeFiltroDeHistorial = '' | 'ingreso' | 'cambio' | 'salida' | 'reingreso' | 'documentos';

export interface FiltrosDeHistorial {
  tipo?: TipoDeFiltroDeHistorial;
  desde?: string;
  hasta?: string;
  busqueda?: string;
}

/** GET /expedientes/:id/historial, paginado (lo mas reciente primero), con filtros opcionales. */
export function consultarHistorial(funcionarioId: string, pagina: number, filtros: FiltrosDeHistorial = {}, tamano = 20) {
  return pedirAlServidor<Pagina<MovimientoDelHistorial>>('GET', `/expedientes/${encodeURIComponent(funcionarioId)}/historial`, {
    parametros: { pagina, tamano, tipo: filtros.tipo, desde: filtros.desde, hasta: filtros.hasta, busqueda: filtros.busqueda },
  });
}
