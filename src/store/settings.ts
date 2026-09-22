import { DEFAULT_CONFIG, type GameConfig } from '../engine';
import { STORAGE_KEYS, load, migrateVersion, save } from './persistence';

export type Language = 'en' | 'zh';

/** Stored preference: a concrete language, or 'auto' (follow the browser). */
export type LanguageSetting = Language | 'auto';

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

/** Resolves a stored preference to the language actually rendered. */
export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === 'auto' ? detectLanguage() : setting;
}

export interface SettingsData {
  config: GameConfig;
  language: LanguageSetting;
  /** Prefer minimal animations (dealing, flips, resolution FX). */
  reducedMotion: boolean;
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

function isValidLanguage(value: unknown): value is LanguageSetting {
  return (
    typeof value === 'string' &&
    (value === 'auto' || (LANGUAGES as readonly string[]).includes(value))
  );
}

function read(raw: unknown): SettingsData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (!isValidConfig(v.config)) return null;
  return {
    config: v.config,
    language: isValidLanguage(v.language) ? v.language : 'auto',
    reducedMotion: v.reducedMotion === true,
  };
}

export function loadSettings(): SettingsData {
  return (
    load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read)) ?? {
      config: { ...DEFAULT_CONFIG },
      language: 'auto',
      reducedMotion: false,
    }
  );
}

export function saveSettings(
  config: GameConfig,
  language?: LanguageSetting,
  reducedMotion?: boolean,
): void {
  const stored = load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read));
  save<SettingsData>(STORAGE_KEYS.settings, {
    config,
    language: language ?? stored?.language ?? 'auto',
    // Explicit value wins; otherwise keep what was stored (missing → false).
    reducedMotion: reducedMotion ?? stored?.reducedMotion ?? false,
  });
}

export function saveLanguage(language: LanguageSetting): void {
  const stored = load<SettingsData>(STORAGE_KEYS.settings, migrateVersion(1, read));
  save<SettingsData>(STORAGE_KEYS.settings, {
    config: stored?.config ?? { ...DEFAULT_CONFIG },
    language,
    reducedMotion: stored?.reducedMotion ?? false,
  });
}

export function loadLanguageSetting(): LanguageSetting {
  return loadSettings().language;
}

export function loadLanguage(): Language {
  return resolveLanguage(loadLanguageSetting());
}
