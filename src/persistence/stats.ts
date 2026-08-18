/**
 * Stats shard (`scoundrel:stats`): aggregates + bounded run history (Q50a).
 *
 * `recordRun` is a pure function so aggregate math and the 50-entry cap are
 * unit-testable without storage. The idempotency guard ("write exactly once
 * per run") lives in the store via the stats-written flag on the run record.
 */
import type { GameConfig } from '../engine';
import { normalizeConfig } from './settings';
import { readVersioned, removeKey, STORAGE_KEYS, writeEnvelope } from './storage';

export const STATS_VERSION = 1;
export const RUN_HISTORY_CAP = 50;

export interface RunRecord {
  seed: string;
  config: GameConfig;
  outcome: 'won' | 'lost';
  score: number;
  /** Unix ms when the run ended. */
  date: number;
  roomsCleared: number;
}

export interface StatsData {
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** Best score across all runs; null before the first completed run. */
  bestScore: number | null;
  /** Consecutive wins counting back from the most recent run. */
  currentStreak: number;
  bestStreak: number;
  /** Newest first, capped at RUN_HISTORY_CAP. */
  runs: RunRecord[];
}

export function emptyStats(): StatsData {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bestScore: null,
    currentStreak: 0,
    bestStreak: 0,
    runs: [],
  };
}

/** Pure aggregate update: prepend run, recompute aggregates, cap history. */
export function recordRun(stats: StatsData, record: RunRecord): StatsData {
  const won = record.outcome === 'won';
  const currentStreak = won ? stats.currentStreak + 1 : 0;
  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
    bestScore: stats.bestScore === null ? record.score : Math.max(stats.bestScore, record.score),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    runs: [record, ...stats.runs].slice(0, RUN_HISTORY_CAP),
  };
}

/** Validates/normalizes the runs list read back from storage. */
function normalizeStats(raw: StatsData): StatsData {
  return {
    ...emptyStats(),
    ...raw,
    runs: Array.isArray(raw.runs)
      ? raw.runs
          .slice(0, RUN_HISTORY_CAP)
          // Restore Infinity, which cannot JSON-round-trip inside configs.
          .map((run) => ({ ...run, config: normalizeConfig(run.config) }))
      : [],
  };
}

// No prior stats schema ever shipped; unknown versions fall back to empty.
function migrateStats(): StatsData | null {
  return null;
}

export function loadStats(): StatsData {
  const stored = readVersioned<StatsData>(
    STORAGE_KEYS.stats,
    STATS_VERSION,
    migrateStats,
    emptyStats(),
  );
  return normalizeStats(stored);
}

export function saveStats(stats: StatsData): void {
  writeEnvelope(STORAGE_KEYS.stats, STATS_VERSION, stats);
}

/** load → recordRun → save in one call; returns the updated aggregates. */
export function recordRunPersisted(record: RunRecord): StatsData {
  const next = recordRun(loadStats(), record);
  saveStats(next);
  return next;
}

export function clearStats(): void {
  removeKey(STORAGE_KEYS.stats);
}
