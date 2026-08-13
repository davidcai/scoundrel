/**
 * Sharded localStorage adapters (docs/spec.md Q11b/Q22b, Q45).
 *
 * Settings, stats, and the active run live in three independent keys so
 * changing settings never disturbs an active run and clearing a run never
 * wipes lifetime stats. Every value is a single versioned wrapper
 * `{version, data}` written at CURRENT_VERSION and upgraded on read via the
 * migrate() chain (Q46).
 *
 * Everything in this module is crash-safe by contract: corrupt JSON, a
 * missing key, a wrong-shaped payload, a foreign schema version, or
 * unavailable storage (SSR, private mode, quota errors) never throw — reads
 * return sensible defaults and writes return false.
 */

import { CURRENT_VERSION, migrate, type VersionedWrapper } from './migrate'
import { defaultStats } from './stats'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  isFiniteNumber,
  isGameConfig,
  isGameStateLike,
  isRecord,
  isRunOutcome,
  isRunRecord,
  type PersistedKey,
  type RunData,
  type SettingsData,
  type StatsData,
} from './types'

/**
 * Access localStorage defensively. Browsers can throw just by *reading* the
 * property (sandboxed iframes, some private modes), and `window` may not exist
 * at all under SSR — any failure means "no storage", never an exception.
 */
function resolveStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isVersionedWrapper(value: unknown): value is VersionedWrapper {
  return isRecord(value) && Number.isInteger(value.version) && 'data' in value
}

function validateSettingsData(value: unknown): SettingsData | null {
  return isGameConfig(value) ? { ...value } : null
}

function validateStatsData(value: unknown): StatsData | null {
  if (!isRecord(value)) return null
  const { gamesPlayed, wins, losses, bestScore, currentStreak, bestStreak, runs } = value
  if (
    !isFiniteNumber(gamesPlayed) ||
    !isFiniteNumber(wins) ||
    !isFiniteNumber(losses) ||
    !isFiniteNumber(bestScore) ||
    !isFiniteNumber(currentStreak) ||
    !isFiniteNumber(bestStreak)
  ) {
    return null
  }
  if (!Array.isArray(runs)) return null
  // Salvage valid entries rather than discarding a whole shard over one bad run.
  return {
    gamesPlayed,
    wins,
    losses,
    bestScore,
    currentStreak,
    bestStreak,
    runs: runs.filter(isRunRecord),
  }
}

function validateRunData(value: unknown): RunData | null {
  if (!isRecord(value)) return null
  const { state, seed, config, startedAt, outcome, statsWritten } = value
  if (!isGameStateLike(state)) return null
  if (typeof seed !== 'string') return null
  if (!isGameConfig(config)) return null
  if (!isFiniteNumber(startedAt)) return null
  if (typeof statsWritten !== 'boolean') return null
  if (outcome !== null && !isRunOutcome(outcome)) return null
  return { state, seed, config, startedAt, outcome, statsWritten }
}

/**
 * Read + validate one shard. `fallback` is a thunk so mutable defaults (the
 * stats arrays, settings object) are never shared between callers.
 *
 * A successfully migrated older-version shard is written back at the current
 * version (best-effort); an unmigratable one (future version, broken chain)
 * is left untouched on disk but reported as the fallback.
 */
function loadData<T>(
  key: PersistedKey,
  fallback: () => T,
  validate: (value: unknown) => T | null,
): T {
  const storage = resolveStorage()
  if (!storage) return fallback()
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return fallback()
  }
  if (raw === null) return fallback()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return fallback()
  }
  if (!isVersionedWrapper(parsed)) return fallback()
  const migrated = migrate(key, parsed)
  if (migrated.version !== CURRENT_VERSION) return fallback()
  const validated = validate(migrated.data)
  if (validated === null) return fallback()
  if (migrated.version !== parsed.version) saveData(key, validated)
  return validated
}

/** Write one shard wrapped at CURRENT_VERSION. Returns false on quota/availability errors. */
function saveData(key: PersistedKey, data: unknown): boolean {
  const storage = resolveStorage()
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify({ version: CURRENT_VERSION, data }))
    return true
  } catch {
    return false
  }
}

function removeData(key: PersistedKey): boolean {
  const storage = resolveStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Persisted settings, or the canonical-rules defaults. */
export function loadSettings(): SettingsData {
  return loadData(STORAGE_KEYS.settings, () => ({ ...DEFAULT_SETTINGS }), validateSettingsData)
}

export function saveSettings(settings: SettingsData): boolean {
  return saveData(STORAGE_KEYS.settings, settings)
}

/** Persisted stats, or a fresh zeroed aggregate. */
export function loadStats(): StatsData {
  return loadData(STORAGE_KEYS.stats, defaultStats, validateStatsData)
}

export function saveStats(stats: StatsData): boolean {
  return saveData(STORAGE_KEYS.stats, stats)
}

/** The saved run (active or just-finished), or null when none exists. */
export function loadRun(): RunData | null {
  return loadData(STORAGE_KEYS.run, () => null, validateRunData)
}

export function saveRun(run: RunData): boolean {
  return saveData(STORAGE_KEYS.run, run)
}

/** Delete the saved run without touching settings or stats (Q45). */
export function clearSavedRun(): boolean {
  return removeData(STORAGE_KEYS.run)
}
