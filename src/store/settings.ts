import { DEFAULT_CONFIG, type GameConfig } from '../engine';
import { STORAGE_KEYS, load, migrateVersion, save } from './persistence';

export interface SettingsData {
  config: GameConfig;
}

function isValidConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.runAwayMode === 'once' || v.runAwayMode === 'unlimited') &&
    (v.potionsPerRoom === 'one' || v.potionsPerRoom === 'unlimited') &&
    typeof v.weaponDegradation === 'boolean'
  );
}

function read(raw: unknown): SettingsData | null {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    isValidConfig((raw as { config: unknown }).config)
  ) {
    return raw as SettingsData;
  }
  return null;
}

export function loadSettings(): SettingsData {
  return (
    load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read)) ?? {
      config: { ...DEFAULT_CONFIG },
    }
  );
}

export function saveSettings(config: GameConfig): void {
  save<SettingsData>(STORAGE_KEYS.settings, { config });
}
