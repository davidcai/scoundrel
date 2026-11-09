/**
 * Recent run history (REQ-013).
 *
 * History is a newest-first list capped at the newest 30 completed runs,
 * including abandoned losses. An unfinished active run never occupies an
 * entry. Trimming only removes list entries; lifetime statistics live in the
 * same stats shard and are updated from the same recorded outcome.
 */
import { isRuleConfig, parseSeed, type RuleConfig, type RunOutcome } from '../engine';
import { isIsoTimestamp, isNonEmptyString, isRecord } from './validation';

export const HISTORY_LIMIT = 30;

/** One recorded run: a completed win/loss or an abandoned unfinished run. */
export interface HistoryEntry {
  readonly runId: string;
  readonly seed: string;
  readonly config: RuleConfig;
  readonly outcome: RunOutcome;
  /** True when the run was replaced or discarded before it finished. */
  readonly abandoned: boolean;
  readonly score: number;
  /** Final health for a completed run, or health at abandonment. */
  readonly health: number;
  readonly roomsExplored: number;
  readonly roomsCleared: number;
  readonly monstersDefeated: number;
  readonly potionsWasted: number;
  /** UTC ISO 8601 timestamp; the interface renders it in local time. */
  readonly finishedAt: string;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.runId) &&
    typeof value.seed === 'string' &&
    parseSeed(value.seed) === value.seed &&
    typeof value.config === 'number' &&
    isRuleConfig(value.config) &&
    (value.outcome === 'won' || value.outcome === 'lost') &&
    typeof value.abandoned === 'boolean' &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    typeof value.health === 'number' &&
    Number.isFinite(value.health) &&
    isCount(value.roomsExplored) &&
    isCount(value.roomsCleared) &&
    isCount(value.monstersDefeated) &&
    isCount(value.potionsWasted) &&
    isIsoTimestamp(value.finishedAt)
  );
}

/** Validates a stored history array and rejects duplicate run ids. */
export function isHistory(value: unknown): value is readonly HistoryEntry[] {
  if (!Array.isArray(value)) return false;
  if (!value.every(isHistoryEntry)) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (ids.has(entry.runId)) return false;
    ids.add(entry.runId);
  }
  return true;
}

/** Newest first, trimmed to the newest `HISTORY_LIMIT` entries. */
export function addHistoryEntry(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
): readonly HistoryEntry[] {
  const filtered = history.filter((candidate) => candidate.runId !== entry.runId);
  return [entry, ...filtered].slice(0, HISTORY_LIMIT);
}
