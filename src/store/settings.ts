import { DEFAULT_CONFIG, type GameConfig } from '../engine';
import { STORAGE_KEYS, load, migrateVersion, save } from './persistence';

export type Language = 'en' | 'zh';

/** Stored preference: a concrete language, or 'auto' (follow the browser). */
export type LanguageSetting = Language | 'auto';

export const LANGUAGES: readonly Language[] = ['en', 'zh'] as const;

/** Fallback when browser language detection is unavailable (non-browser env). */
export const DEFAULT_LANGUAGE: Language = 'zh';

/** Which renderer draws the play-screen game table (per-device appearance). */
export type TableRenderer = 'dom' | 'phaser';

export const TABLE_RENDERERS: readonly TableRenderer[] = ['dom', 'phaser'] as const;

export const DEFAULT_TABLE_RENDERER: TableRenderer = 'dom';

/**
 * Settings-shard schema version — bumped at THIS call site only. The global
 * `SCHEMA_VERSION` in persistence.ts stays at 1 and stamps every shard on
 * save(); bumping it globally would re-stamp newly saved run/stats shards and
 * make `loadRunSave()` silently return null (destroying "resume saved run").
 * Stored v1 settings shards fall through `migrateVersion(2, …)`'s
 * past-versions path into `read()`, which supplies the new-field defaults.
 */
const SETTINGS_SCHEMA_VERSION = 2;

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
  tableRenderer: TableRenderer;
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

function isValidTableRenderer(value: unknown): value is TableRenderer {
  return (TABLE_RENDERERS as readonly string[]).includes(value as string);
}

/**
 * Settings validator (distinct from `isValidConfig`, which validates GameConfig):
 * the rule config is mandatory — corrupt it and the shard is unrecoverable —
 * while language and renderer are preferences that fall back to defaults.
 */
function readSettings(raw: unknown): SettingsData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (!isValidConfig(v.config)) return null;
  return {
    config: v.config,
    language: isValidLanguage(v.language) ? v.language : 'auto',
    tableRenderer: isValidTableRenderer(v.tableRenderer) ? v.tableRenderer : DEFAULT_TABLE_RENDERER,
  };
}

export function loadSettings(): SettingsData {
  return (
    load<SettingsData>(
      STORAGE_KEYS.settings,
      migrateVersion(SETTINGS_SCHEMA_VERSION, readSettings),
    ) ?? {
      config: { ...DEFAULT_CONFIG },
      language: 'auto',
      tableRenderer: DEFAULT_TABLE_RENDERER,
    }
  );
}

export function saveSettings(
  config: GameConfig,
  language?: LanguageSetting,
  tableRenderer?: TableRenderer,
): void {
  const stored = load<SettingsData>(
    STORAGE_KEYS.settings,
    migrateVersion(SETTINGS_SCHEMA_VERSION, readSettings),
  );
  save<SettingsData>(STORAGE_KEYS.settings, {
    config,
    language: language ?? stored?.language ?? 'auto',
    tableRenderer: tableRenderer ?? stored?.tableRenderer ?? DEFAULT_TABLE_RENDERER,
  });
}

export function saveLanguage(language: LanguageSetting): void {
  const stored = load<SettingsData>(
    STORAGE_KEYS.settings,
    migrateVersion(SETTINGS_SCHEMA_VERSION, readSettings),
  );
  save<SettingsData>(STORAGE_KEYS.settings, {
    config: stored?.config ?? { ...DEFAULT_CONFIG },
    language,
    tableRenderer: stored?.tableRenderer ?? DEFAULT_TABLE_RENDERER,
  });
}

export function loadLanguageSetting(): LanguageSetting {
  return loadSettings().language;
}

export function loadLanguage(): Language {
  return resolveLanguage(loadLanguageSetting());
}
