/**
 * Lifetime statistics and the recorded-outcome ledger (REQ-013).
 *
 * The stats shard stores three things that must change together: lifetime
 * statistics, the newest-first history list, and the run ids that have already
 * been recorded. The ledger is what makes outcome recording once-only across
 * reloads and multiple tabs: recording an id that is already present is a
 * no-op, even when the caller's in-memory view is stale.
 *
 * The ledger is bounded. A completed-run payload only exists until the next
 * run replaces it, so ids older than the bound can no longer be presented for
 * recording by a live tab.
 */
import type { RunOutcome } from '../engine';
import { addHistoryEntry, isHistory, type HistoryEntry } from './history';
import { isNonEmptyString, isRecord } from './validation';

/** How many recently recorded run ids are kept for duplicate protection. */
export const RECORDED_RUN_ID_LIMIT = 200;

export interface Statistics {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  /** Highest score among recorded runs, including abandoned losses. */
  readonly bestScore: number | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export const EMPTY_STATISTICS: Statistics = Object.freeze({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  bestScore: null,
  currentStreak: 0,
  bestStreak: 0,
});

/** Everything persisted in the stats shard. */
export interface StoredStats {
  readonly statistics: Statistics;
  readonly history: readonly HistoryEntry[];
  /** Newest first; ids whose outcome has already been applied. */
  readonly recordedRunIds: readonly string[];
}

export const EMPTY_STATS: StoredStats = Object.freeze({
  statistics: EMPTY_STATISTICS,
  history: Object.freeze([]),
  recordedRunIds: Object.freeze([]),
});

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isStatistics(value: unknown): value is Statistics {
  if (!isRecord(value)) return false;
  const { gamesPlayed, wins, losses, bestScore, currentStreak, bestStreak } = value;
  if (!isCount(gamesPlayed) || !isCount(wins) || !isCount(losses)) return false;
  if (!isCount(currentStreak) || !isCount(bestStreak)) return false;
  if (gamesPlayed !== wins + losses) return false;
  if (currentStreak > bestStreak) return false;
  if (gamesPlayed === 0) return bestScore === null;
  return typeof bestScore === 'number' && Number.isFinite(bestScore);
}

export function isStoredStats(value: unknown): value is StoredStats {
  if (!isRecord(value)) return false;
  if (!isStatistics(value.statistics) || !isHistory(value.history)) return false;
  const ids = value.recordedRunIds;
  if (!Array.isArray(ids) || ids.length > RECORDED_RUN_ID_LIMIT) return false;
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isNonEmptyString(id) || seen.has(id)) return false;
    seen.add(id);
  }
  // Every history entry is still inside the dedupe window (history is much
  // shorter than the ledger), so a missing id means the shard is inconsistent.
  for (const entry of value.history) {
    if (!seen.has(entry.runId)) return false;
  }
  return true;
}

export interface RecordOutcomeResult {
  readonly next: StoredStats;
  /** False when this run id was already in the ledger; `next === stats` then. */
  readonly recorded: boolean;
}

/**
 * Apply one recorded run to the statistics shard exactly once.
 *
 * `entry.runId` identifies the run; repeated calls with the same id (reload,
 * second tab, stale in-memory view) return `recorded: false` and change
 * nothing.
 */
export function recordOutcome(stats: StoredStats, entry: HistoryEntry): RecordOutcomeResult {
  if (stats.recordedRunIds.includes(entry.runId)) {
    return { next: stats, recorded: false };
  }
  return {
    next: {
      statistics: applyOutcome(stats.statistics, entry.outcome, entry.score),
      history: addHistoryEntry(stats.history, entry),
      recordedRunIds: [
        entry.runId,
        ...stats.recordedRunIds.filter((id) => id !== entry.runId),
      ].slice(0, RECORDED_RUN_ID_LIMIT),
    },
    recorded: true,
  };
}

/** Whole-number percentage rounded to nearest; `null` before any run is recorded. */
export function winRatePercent(statistics: Statistics): number | null {
  if (statistics.gamesPlayed === 0) return null;
  return Math.round((statistics.wins / statistics.gamesPlayed) * 100);
}

/** Convenience for callers that only have an outcome and score. */
export function applyOutcome(
  statistics: Statistics,
  outcome: RunOutcome,
  score: number,
): Statistics {
  const isWin = outcome === 'won';
  const currentStreak = isWin ? statistics.currentStreak + 1 : 0;
  return {
    gamesPlayed: statistics.gamesPlayed + 1,
    wins: statistics.wins + (isWin ? 1 : 0),
    losses: statistics.losses + (isWin ? 0 : 1),
    bestScore: statistics.bestScore === null ? score : Math.max(statistics.bestScore, score),
    currentStreak,
    bestStreak: Math.max(statistics.bestStreak, currentStreak),
  };
}
