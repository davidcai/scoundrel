/**
 * Pure stats helpers (docs/spec.md Q50a, Q47).
 *
 * All functions are side-effect free: `updateStats` never mutates its input
 * and never touches storage or the clock. Idempotency across reloads is the
 * caller's job via `RunData.statsWritten`; `updateStats` itself is a pure
 * fold of (stats, record) → stats — calling it twice with the same record
 * legitimately counts two games.
 */

import type { GameConfig } from '../../engine/types'
import type { RunRecord, StatsData } from './types'

/** Maximum number of runs kept in the stats history (Q48: "capped at ~50"). */
export const DEFAULT_RUNS_CAP = 50

/** Fresh zeroed stats (new player, corrupt shard fallback). */
export function defaultStats(): StatsData {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bestScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    runs: [],
  }
}

export interface MakeRunRecordInput {
  seed: string
  config: GameConfig
  outcome: 'won' | 'lost'
  score: number
  roomsCleared: number
  /** Epoch ms; defaults to Date.now() (pass explicitly in tests). */
  date?: number
}

/** Build a RunRecord for a finished run (Q50a). */
export function makeRunRecord(input: MakeRunRecordInput): RunRecord {
  return {
    seed: input.seed,
    config: { ...input.config },
    outcome: input.outcome,
    score: input.score,
    date: input.date ?? Date.now(),
    roomsCleared: input.roomsCleared,
  }
}

/**
 * Fold one finished run into the stats aggregates.
 *
 * Semantics (Q47):
 * - gamesPlayed always increments; wins/losses split on the record's outcome.
 * - bestScore is the max score over all runs (a first-run negative score is
 *   honored, so a losing debut isn't hidden by a zeroed default).
 * - A win increments currentStreak; a loss resets it to 0. bestStreak tracks
 *   the all-time max.
 * - The record is prepended to runs (newest first), capped at DEFAULT_RUNS_CAP.
 */
export function updateStats(stats: StatsData, record: RunRecord): StatsData {
  const gamesPlayed = stats.gamesPlayed + 1
  const wins = stats.wins + (record.outcome === 'won' ? 1 : 0)
  const losses = stats.losses + (record.outcome === 'lost' ? 1 : 0)
  const bestScore = stats.gamesPlayed === 0 ? record.score : Math.max(stats.bestScore, record.score)
  const currentStreak = record.outcome === 'won' ? stats.currentStreak + 1 : 0
  const bestStreak = Math.max(stats.bestStreak, currentStreak)
  const runs = [record, ...stats.runs].slice(0, DEFAULT_RUNS_CAP)
  return { gamesPlayed, wins, losses, bestScore, currentStreak, bestStreak, runs }
}
