/**
 * Settings shard (`scoundrel:settings`): persists the player's GameConfig so
 * house-rule toggles survive sessions (Q54). Defaults enforce the canonical
 * rules from docs/rules.md (Q53).
 *
 * Note: `potionsPerRoom` may be Infinity, which JSON cannot represent — it is
 * serialized as null and normalized back on read.
 */
import type { GameConfig } from '../engine';
import { readVersioned, removeKey, STORAGE_KEYS, writeEnvelope } from './storage';

export const SETTINGS_VERSION = 1;

/** Canonical-rules default config (docs/rules.md). */
export function defaultSettings(): GameConfig {
  return { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true };
}

/** Shape stored at version 0 (pre-release boolean flags). */
interface SettingsV0 {
  unlimitedRunAway?: unknown;
  unlimitedPotions?: unknown;
  weaponDegradation?: unknown;
}

function migrateSettings(version: number, data: unknown): GameConfig | null {
  if (version === 0 && typeof data === 'object' && data !== null) {
    const v0 = data as SettingsV0;
    return {
      runAwayMode: v0.unlimitedRunAway === true ? 'unlimited' : 'once',
      potionsPerRoom: v0.unlimitedPotions === true ? Number.POSITIVE_INFINITY : 1,
      weaponDegradation: v0.weaponDegradation !== false,
    };
  }
  return null;
}

/**
 * Normalizes a raw parsed config — mostly to restore Infinity after JSON and
 * to clamp unknown enum values back to canonical defaults.
 */
export function normalizeConfig(raw: unknown): GameConfig {
  const d = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    runAwayMode: d.runAwayMode === 'unlimited' ? 'unlimited' : 'once',
    potionsPerRoom:
      d.potionsPerRoom === null || d.potionsPerRoom === 'Infinity'
        ? Number.POSITIVE_INFINITY
        : typeof d.potionsPerRoom === 'number' && d.potionsPerRoom >= 2
          ? Number.POSITIVE_INFINITY
          : 1,
    weaponDegradation: Boolean(d.weaponDegradation ?? true),
  };
}

export function loadSettings(): GameConfig {
  const stored = readVersioned<GameConfig>(
    STORAGE_KEYS.settings,
    SETTINGS_VERSION,
    migrateSettings,
    defaultSettings(),
  );
  return normalizeConfig(stored);
}

export function saveSettings(config: GameConfig): void {
  writeEnvelope(STORAGE_KEYS.settings, SETTINGS_VERSION, config);
}

export function clearSettings(): void {
  removeKey(STORAGE_KEYS.settings);
}
