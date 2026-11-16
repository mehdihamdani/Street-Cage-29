import type { PlayerKitConfig } from './types';

const STORAGE_KEY = 'street_cage_29_kit_v1';

export const DEFAULT_PLAYER_KIT: PlayerKitConfig = {
  jerseyPrimary: '#f8fafc',
  jerseyStripe: '#0f172a',
  bootColor: '#f59e0b',
  striped: true,
};

export interface JerseyPreset {
  id: string;
  label: string;
  jerseyPrimary: string;
  jerseyStripe: string;
  striped: boolean;
}

export const JERSEY_PRESETS: JerseyPreset[] = [
  {
    id: 'classic29',
    label: 'مخطط 29',
    jerseyPrimary: '#f8fafc',
    jerseyStripe: '#0f172a',
    striped: true,
  },
  {
    id: 'gold',
    label: 'ذهبي شوارع',
    jerseyPrimary: '#f59e0b',
    jerseyStripe: '#0f172a',
    striped: false,
  },
  {
    id: 'cyan',
    label: 'أزرق سماوي',
    jerseyPrimary: '#06b6d4',
    jerseyStripe: '#090d16',
    striped: false,
  },
  {
    id: 'crimson',
    label: 'أحمر ناري',
    jerseyPrimary: '#ef4444',
    jerseyStripe: '#111827',
    striped: true,
  },
  {
    id: 'emerald',
    label: 'أخضر زمردي',
    jerseyPrimary: '#10b981',
    jerseyStripe: '#090d16',
    striped: false,
  },
];

export interface BootPreset {
  id: string;
  label: string;
  color: string;
}

export const BOOT_PRESETS: BootPreset[] = [
  { id: 'amber', label: 'ذهبي', color: '#f59e0b' },
  { id: 'sky', label: 'سماوي', color: '#38bdf8' },
  { id: 'white', label: 'أبيض', color: '#f8fafc' },
  { id: 'lime', label: 'ليموني', color: '#84cc16' },
  { id: 'rose', label: 'أحمر', color: '#f43f5e' },
];

export function loadSavedKit(): PlayerKitConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER_KIT;
    const parsed = JSON.parse(raw) as Partial<PlayerKitConfig>;
    if (
      typeof parsed.jerseyPrimary === 'string' &&
      typeof parsed.jerseyStripe === 'string' &&
      typeof parsed.bootColor === 'string' &&
      typeof parsed.striped === 'boolean'
    ) {
      return {
        jerseyPrimary: parsed.jerseyPrimary,
        jerseyStripe: parsed.jerseyStripe,
        bootColor: parsed.bootColor,
        striped: parsed.striped,
      };
    }
    return DEFAULT_PLAYER_KIT;
  } catch {
    return DEFAULT_PLAYER_KIT;
  }
}

export function saveKitToStorage(kit: PlayerKitConfig): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kit));
    return true;
  } catch {
    return false;
  }
}
