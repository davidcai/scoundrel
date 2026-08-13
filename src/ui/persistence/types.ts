/**
 * Persistence layer types + guards (docs/spec.md Q11b/Q22b, Q37b, Q50a).
 *
 * Three sharded localStorage keys, each holding a versioned wrapper
 * `{version, data}` (see storage.ts / migrate.ts). Everything here is plain
 * JSON-serializable data — no React, no DOM access.
 *
 * The `is*` guards are runtime shape checks for data coming back out of
 * storage (or a replay URL): they trust nothing, tolerate unknown extra
 * fields, and let callers fall back to defaults on any mismatch.
 */

import type { GameConfig, GameState } from '../../engine/types'
import { DEFAULT_CONFIG } from '../../engine/types'

/** The three sharded localStorage keys (docs/spec.md Q11b). */
export const STORAGE_KEYS = {
  settings: 'scoundrel:settings',
  stats: 'scoundrel:stats',
  run: 'scoundrel:run',
} as const

export type StorageShard = keyof typeof STORAGE_KEYS

/** A full localStorage key string, e.g. 'scoundrel:stats'. */
export type PersistedKey = (typeof STORAGE_KEYS)[StorageShard]

/**
 * Settings shard payload — exactly the engine's GameConfig (Q19a), persisted
 * so settings survive sessions without disturbing the active run.
 */
export type SettingsData = GameConfig

/** Canonical-rules default settings (docs/rules.md faithful). */
export const DEFAULT_SETTINGS: SettingsData = { ...DEFAULT_CONFIG }

/** One finished run in the stats history; doubles as "Replay this run" source (Q50a). */
export interface RunRecord {
  seed: string
  config: GameConfig
  outcome: 'won' | 'lost'
  score: number
  /** Epoch ms when the record was written. */
  date: number
  roomsCleared: number
}

/**
 * Stats shard payload (Q50a): aggregates plus a bounded run history.
 * gamesPlayed/wins are the win-rate inputs; win-rate itself is derived by
 * consumers (wins / gamesPlayed) rather than stored.
 */
export interface StatsData {
  gamesPlayed: number
  wins: number
  losses: number
  bestScore: number
  currentStreak: number
  bestStreak: number
  /** Newest first, capped at DEFAULT_RUNS_CAP (see stats.ts). */
  runs: RunRecord[]
}

/**
 * Run shard payload (Q37b): the active (or just-finished) run.
 *
 * - `state` is the full engine GameState (its `roomSnapshot` is the per-room
 *   undo seam) so a run resumes exactly where it left off.
 * - `outcome` holds the terminal result inline once the run completes, so the
 *   win/lose screen survives reload until the player returns to title.
 * - `statsWritten` guards the idempotent stats write (Q42): callers set it
 *   after folding this run into the stats shard, so reloads never double-count.
 */
export interface RunData {
  state: GameState
  seed: string
  config: GameConfig
  startedAt: number
  outcome: { type: 'won' | 'lost'; score: number } | null
  statsWritten: boolean
}

/** Narrow unknown payloads to a plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Narrow unknown payloads to a finite number (rejects NaN/±Infinity, which JSON can't losslessly hold). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Shape check for a persisted (or URL-decoded) GameConfig. */
export function isGameConfig(value: unknown): value is GameConfig {
  if (!isRecord(value)) return false
  return (
    (value.runAwayMode === 'once' || value.runAwayMode === 'unlimited') &&
    (value.potionsPerRoom === 1 || value.potionsPerRoom === 'unlimited') &&
    typeof value.weaponDegradation === 'boolean'
  )
}

/** Shape check for one run-history entry. */
export function isRunRecord(value: unknown): value is RunRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.seed === 'string' &&
    isGameConfig(value.config) &&
    (value.outcome === 'won' || value.outcome === 'lost') &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.date) &&
    isFiniteNumber(value.roomsCleared)
  )
}

/** Shape check for a persisted terminal outcome. */
export function isRunOutcome(value: unknown): value is { type: 'won' | 'lost'; score: number } {
  if (!isRecord(value)) return false
  return (value.type === 'won' || value.type === 'lost') && isFiniteNumber(value.score)
}

/**
 * Lightweight sanity check on a persisted engine GameState. Deliberately not a
 * deep validation — the engine owns its invariants; we only verify the payload
 * is roughly game-shaped so a garbage shard can't crash the app on load.
 */
export function isGameStateLike(value: unknown): value is GameState {
  if (!isRecord(value)) return false
  return (
    (value.phase === 'playing' || value.phase === 'won' || value.phase === 'lost') &&
    isGameConfig(value.config) &&
    isFiniteNumber(value.hp) &&
    isFiniteNumber(value.maxHp) &&
    Array.isArray(value.dungeon) &&
    Array.isArray(value.room) &&
    Array.isArray(value.killStack)
  )
}
