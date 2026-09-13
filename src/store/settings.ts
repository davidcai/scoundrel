import { DEFAULT_CONFIG, type GameConfig } from '../engine';
import { STORAGE_KEYS, load, migrateVersion, save } from './persistence';

export type Language = 'en' | 'zh';

export const LANGUAGES: readonly Language[] = ['en', 'zh'] as const;

/** Fallback when browser language detection is unavailable (non-browser env). */
export const DEFAULT_LANGUAGE: Language = 'zh';

/**
 * First-visit default: browsers configured for any Chinese locale start in
 * Chinese; everything else starts in English. The choice is persisted on
 * first switch, after which detection never runs again.
 */
export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const candidates = navigator.languages ?? [navigator.language];
  return candidates.some((tag) => /^zh\b/i.test(tag ?? '')) ? 'zh' : 'en';
}

export interface SettingsData {
  config: GameConfig;
  language: Language;
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

function isValidLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

function read(raw: unknown): SettingsData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (!isValidConfig(v.config)) return null;
  return {
    config: v.config,
    language: isValidLanguage(v.language) ? v.language : detectLanguage(),
  };
}

export function loadSettings(): SettingsData {
  return (
    load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read)) ?? {
      config: { ...DEFAULT_CONFIG },
      language: detectLanguage(),
    }
  );
}

export function saveSettings(config: GameConfig, language?: Language): void {
  const stored = load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read));
  save<SettingsData>(STORAGE_KEYS.settings, {
    config,
    language: language ?? stored?.language ?? detectLanguage(),
  });
}

export function saveLanguage(language: Language): void {
  const stored = load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read));
  save<SettingsData>(STORAGE_KEYS.settings, {
    config: stored?.config ?? { ...DEFAULT_CONFIG },
    language,
  });
}

export function loadLanguage(): Language {
  return loadSettings().language;
}
