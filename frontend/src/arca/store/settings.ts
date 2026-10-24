import { create } from 'zustand';
import { settingsApi } from '../api/endpoints';
import type { PrintFormat, Settings } from '../api/types';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (s: Settings) => Promise<void>;
}

/** Valores mientras no se ha leído la configuración: tiquete de 80 mm e impresión automática. */
export const defaultSettings: Settings = {
  municipalLegalId: '',
  municipalPhone: '',
  municipalAddress: '',
  printFormat: 'TERMICO',
  autoPrint: true,
};

export const useSettings = create<SettingsState>((set) => ({
  settings: defaultSettings,
  loaded: false,
  async load() {
    set({ settings: await settingsApi.get(), loaded: true });
  },
  async save(s) {
    set({ settings: await settingsApi.update(s), loaded: true });
  },
}));

export const receiptFormatOf = (f: PrintFormat) => (f === 'CARTA' ? ('carta' as const) : ('termico' as const));
