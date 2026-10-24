import type { Client, Concept } from '../../api/types';
import type { DraftLine, DraftPayments } from '../../lib/calc';

/** Borrador del recibo: cliente (o "sin identificar"), líneas y pagos. Reducer puro. */
export interface Draft {
  client: Client | null;
  anonymous: boolean;
  lines: DraftLine[];
  pay: DraftPayments;
}

export const emptyPayments: DraftPayments = { card: 0, sinpe: 0, transfer: 0, cashReceived: 0 };

export const emptyDraft = (): Draft => ({ client: null, anonymous: false, lines: [], pay: { ...emptyPayments } });

export type DraftAction =
  | { type: 'client'; client: Client }
  | { type: 'anonymous' }
  | { type: 'clearClient' }
  | { type: 'addConcept'; concept: Concept }
  | { type: 'line'; index: number; patch: Partial<Pick<DraftLine, 'qty' | 'monto' | 'desc' | 'rec'>> }
  | { type: 'removeLine'; index: number }
  | { type: 'pay'; patch: Partial<DraftPayments> }
  | { type: 'reset' };

export function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'client':
      return { ...state, client: action.client, anonymous: false };
    case 'anonymous':
      return { ...state, client: null, anonymous: true };
    case 'clearClient':
      return { ...state, client: null, anonymous: false };
    case 'addConcept':
      // La línea nace con la tarifa del catálogo; el cajero puede ajustar monto, descuento y recargo.
      return {
        ...state,
        lines: [
          ...state.lines,
          { conceptId: action.concept.id, name: action.concept.name, qty: 1, monto: action.concept.price, desc: 0, rec: 0 },
        ],
      };
    case 'line':
      return { ...state, lines: state.lines.map((l, i) => (i === action.index ? { ...l, ...action.patch } : l)) };
    case 'removeLine':
      return { ...state, lines: state.lines.filter((_, i) => i !== action.index) };
    case 'pay':
      return { ...state, pay: { ...state.pay, ...action.patch } };
    case 'reset':
      return emptyDraft();
  }
}
