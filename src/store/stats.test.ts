import { describe, expect, it } from 'vitest';
import type { RuleConfig } from '../engine';
import type { HistoryEntry } from './history';
import {
  EMPTY_STATISTICS,
  EMPTY_STATS,
  RECORDED_RUN_ID_LIMIT,
  applyOutcome,
  isStatistics,
  isStoredStats,
  recordOutcome,
  winRatePercent,
  type Statistics,
  type StoredStats,
} from './stats';

const FINISHED_AT = '2026-10-31T12:00:00.000Z';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    runId: 'run-1',
    seed: 'plain-257',
    config: 0 as RuleConfig,
    outcome: 'won',
    abandoned: false,
    score: 10,
    health: 8,
    roomsExplored: 2,
    roomsCleared: 2,
    monstersDefeated: 3,
    potionsWasted: 0,
    finishedAt: FINISHED_AT,
    ...overrides,
  };
}

function recordAll(
  entries: readonly HistoryEntry[],
  start: StoredStats = EMPTY_STATS,
): StoredStats {
  return entries.reduce((stats, entry) => recordOutcome(stats, entry).next, start);
}

function makeStatistics(overrides: Partial<Statistics> = {}): Statistics {
  return {
    gamesPlayed: 3,
    wins: 2,
    losses: 1,
    bestScore: 12,
    currentStreak: 1,
    bestStreak: 2,
    ...overrides,
  };
}

describe('applyOutcome', () => {
  it('starts from a zeroed statistics record', () => {
    expect(EMPTY_STATISTICS).toEqual({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      bestScore: null,
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  it('tracks games, best score, and streaks (win, win, loss, win)', () => {
    let stats = EMPTY_STATISTICS;
    stats = applyOutcome(stats, 'won', 10);
    stats = applyOutcome(stats, 'won', -4);
    stats = applyOutcome(stats, 'lost', 3);
    stats = applyOutcome(stats, 'won', 20);

    expect(stats).toEqual({
      gamesPlayed: 4,
      wins: 3,
      losses: 1,
      bestScore: 20,
      currentStreak: 1,
      bestStreak: 2,
    });
  });

  it('keeps a negative best score for an all-loss record', () => {
    const stats = applyOutcome(EMPTY_STATISTICS, 'lost', -38);
    expect(stats.bestScore).toBe(-38);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(0);
  });

  it('resets the current streak on a loss but keeps the best streak', () => {
    let stats = applyOutcome(EMPTY_STATISTICS, 'won', 1);
    stats = applyOutcome(stats, 'won', 2);
    stats = applyOutcome(stats, 'won', 3);
    stats = applyOutcome(stats, 'lost', -2);
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(3);
  });
});

describe('winRatePercent', () => {
  it('is null before any recorded game', () => {
    expect(winRatePercent(EMPTY_STATISTICS)).toBeNull();
    expect(
      winRatePercent(makeStatistics({ gamesPlayed: 0, wins: 0, losses: 0, bestScore: null })),
    ).toBeNull();
  });

  it('rounds the win rate to a whole percentage', () => {
    expect(winRatePercent(makeStatistics({ gamesPlayed: 2, wins: 1, losses: 1 }))).toBe(50);
    expect(winRatePercent(makeStatistics({ gamesPlayed: 3, wins: 1, losses: 2 }))).toBe(33);
    expect(winRatePercent(makeStatistics({ gamesPlayed: 3, wins: 2, losses: 1 }))).toBe(67);
    expect(winRatePercent(makeStatistics({ gamesPlayed: 3, wins: 3, losses: 0 }))).toBe(100);
    expect(winRatePercent(makeStatistics({ gamesPlayed: 3, wins: 0, losses: 3 }))).toBe(0);
    expect(winRatePercent(makeStatistics({ gamesPlayed: 6, wins: 1, losses: 5 }))).toBe(17);
  });
});

describe('recordOutcome', () => {
  it('records a win once and updates every aggregate', () => {
    const result = recordOutcome(EMPTY_STATS, makeEntry({ score: 7 }));
    expect(result.recorded).toBe(true);
    expect(result.next.statistics).toEqual({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      bestScore: 7,
      currentStreak: 1,
      bestStreak: 1,
    });
    expect(result.next.history).toHaveLength(1);
    expect(result.next.history[0]).toEqual(makeEntry({ score: 7 }));
    expect(result.next.recordedRunIds).toEqual(['run-1']);
  });

  it('deduplicates by run id and returns the unchanged stats object', () => {
    const first = recordOutcome(EMPTY_STATS, makeEntry());
    const second = recordOutcome(first.next, makeEntry({ score: 999 }));
    expect(second.recorded).toBe(false);
    expect(second.next).toBe(first.next);
    expect(second.next.statistics.gamesPlayed).toBe(1);
    expect(second.next.history[0]?.score).toBe(10);
  });

  it('records an abandoned loss with its negative score', () => {
    const won = recordOutcome(EMPTY_STATS, makeEntry({ runId: 'run-win', score: 10 }));
    const abandoned = recordOutcome(
      won.next,
      makeEntry({
        runId: 'run-abandoned',
        outcome: 'lost',
        abandoned: true,
        score: -38,
        health: 20,
      }),
    );
    expect(abandoned.recorded).toBe(true);
    expect(abandoned.next.statistics).toEqual({
      gamesPlayed: 2,
      wins: 1,
      losses: 1,
      bestScore: 10,
      currentStreak: 0,
      bestStreak: 1,
    });
    expect(abandoned.next.history[0]?.abandoned).toBe(true);
    expect(abandoned.next.history[0]?.score).toBe(-38);
  });

  it('keeps lifetime stats while trimming history to the newest 30', () => {
    const entries = Array.from({ length: 31 }, (_value, index) =>
      makeEntry({
        runId: `run-${index + 1}`,
        outcome: index === 30 ? 'lost' : 'won',
        score: index,
        finishedAt: `2026-10-31T12:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
      }),
    );
    const stats = recordAll(entries);

    expect(stats.statistics.gamesPlayed).toBe(31);
    expect(stats.statistics.wins).toBe(30);
    expect(stats.statistics.losses).toBe(1);
    expect(stats.statistics.bestScore).toBe(30);
    expect(stats.history).toHaveLength(30);
    expect(stats.history[0]?.runId).toBe('run-31');
    expect(stats.history.some((entry) => entry.runId === 'run-1')).toBe(false);
    expect(stats.recordedRunIds).toHaveLength(31);
  });

  it('caps the recorded-run ledger while keeping the newest ids', () => {
    const entries = Array.from({ length: RECORDED_RUN_ID_LIMIT + 1 }, (_value, index) =>
      makeEntry({ runId: `run-${index}`, score: index }),
    );
    const stats = recordAll(entries);
    expect(stats.recordedRunIds).toHaveLength(RECORDED_RUN_ID_LIMIT);
    expect(stats.recordedRunIds[0]).toBe(`run-${RECORDED_RUN_ID_LIMIT}`);
    expect(stats.recordedRunIds).not.toContain('run-0');
  });
});

describe('isStatistics', () => {
  it('accepts valid zeroed and populated statistics', () => {
    expect(isStatistics(EMPTY_STATISTICS)).toBe(true);
    expect(isStatistics(makeStatistics())).toBe(true);
  });

  it.each([
    ['games not matching wins plus losses', makeStatistics({ gamesPlayed: 4 })],
    ['wins above games', makeStatistics({ gamesPlayed: 1, wins: 2, losses: 0 })],
    ['a negative count', makeStatistics({ losses: -1 })],
    ['a fractional count', makeStatistics({ gamesPlayed: 1.5 })],
    [
      'a best score with no games',
      makeStatistics({ gamesPlayed: 0, wins: 0, losses: 0, bestScore: 5 }),
    ],
    ['a missing best score with games', makeStatistics({ bestScore: null })],
    ['current streak above best streak', makeStatistics({ currentStreak: 3, bestStreak: 2 })],
    ['a non-finite best score', makeStatistics({ bestScore: Number.POSITIVE_INFINITY })],
  ])('rejects %s', (_label, value) => {
    expect(isStatistics(value)).toBe(false);
  });
});

describe('isStoredStats', () => {
  it('accepts the empty shard and a recorded shard', () => {
    expect(isStoredStats(EMPTY_STATS)).toBe(true);
    expect(isStoredStats(recordOutcome(EMPTY_STATS, makeEntry()).next)).toBe(true);
  });

  it('accepts a trimmed history whose entries are all in the ledger', () => {
    const stats = recordAll(
      Array.from({ length: 31 }, (_value, index) => makeEntry({ runId: `run-${index}` })),
    );
    expect(isStoredStats(stats)).toBe(true);
  });

  it('rejects history entries missing from the ledger', () => {
    const valid = recordOutcome(EMPTY_STATS, makeEntry()).next;
    expect(isStoredStats({ ...valid, recordedRunIds: [] })).toBe(false);
  });

  it('rejects duplicate or empty ledger ids and oversized ledgers', () => {
    const valid = recordOutcome(EMPTY_STATS, makeEntry()).next;
    expect(isStoredStats({ ...valid, recordedRunIds: ['run-1', 'run-1'] })).toBe(false);
    expect(isStoredStats({ ...valid, recordedRunIds: [''] })).toBe(false);
    expect(
      isStoredStats({
        statistics: EMPTY_STATISTICS,
        history: [],
        recordedRunIds: Array.from(
          { length: RECORDED_RUN_ID_LIMIT + 1 },
          (_value, index) => `id-${index}`,
        ),
      }),
    ).toBe(false);
  });

  it('rejects invalid statistics or invalid history arrays', () => {
    expect(isStoredStats({ statistics: { gamesPlayed: 2 }, history: [], recordedRunIds: [] })).toBe(
      false,
    );
    expect(isStoredStats({ ...EMPTY_STATS, history: [makeEntry({ runId: 'ghost' })] })).toBe(false);
  });
});
