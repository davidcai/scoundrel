import { describe, expect, it } from 'vitest';
import type { RuleConfig } from '../engine';
import {
  HISTORY_LIMIT,
  addHistoryEntry,
  isHistory,
  isHistoryEntry,
  type HistoryEntry,
} from './history';

const FINISHED_AT = '2026-10-31T12:00:00.000Z';

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    runId: 'run-1',
    seed: 'plain-257',
    config: 0,
    outcome: 'won',
    abandoned: false,
    score: 12,
    health: 5,
    roomsExplored: 3,
    roomsCleared: 3,
    monstersDefeated: 6,
    potionsWasted: 1,
    finishedAt: FINISHED_AT,
    ...overrides,
  };
}

function fill(count: number): HistoryEntry[] {
  return Array.from({ length: count }, (_value, index) =>
    makeEntry({
      runId: `run-${index + 1}`,
      finishedAt: `2026-10-31T12:00:${String(index).padStart(2, '0')}.000Z`,
    }),
  );
}

describe('isHistoryEntry', () => {
  it('accepts a complete entry', () => {
    expect(isHistoryEntry(makeEntry())).toBe(true);
    expect(
      isHistoryEntry(makeEntry({ outcome: 'lost', abandoned: true, score: -38, health: 20 })),
    ).toBe(true);
  });

  it.each([
    ['a non-object', []],
    ['a missing run id', makeEntry({ runId: '' })],
    ['an unnormalized seed', makeEntry({ seed: ' Plain-257 ' })],
    ['an empty seed', makeEntry({ seed: '' })],
    ['an invalid config', makeEntry({ config: 8 as RuleConfig })],
    ['an unknown outcome', makeEntry({ outcome: 'draw' as HistoryEntry['outcome'] })],
    ['a non-boolean abandoned flag', makeEntry({ abandoned: 1 as unknown as boolean })],
    ['a non-finite score', makeEntry({ score: Number.NaN })],
    ['a negative room count', makeEntry({ roomsExplored: -1 })],
    ['a non-integer count', makeEntry({ potionsWasted: 1.5 })],
    ['a non-canonical timestamp', makeEntry({ finishedAt: '2026-10-31T12:00:00+01:00' })],
    ['a missing timestamp', makeEntry({ finishedAt: '' })],
  ])('rejects %s', (_label, value) => {
    expect(isHistoryEntry(value)).toBe(false);
  });
});

describe('isHistory', () => {
  it('accepts newest-first entries with unique run ids', () => {
    expect(isHistory(fill(3))).toBe(true);
    expect(isHistory([])).toBe(true);
  });

  it('rejects non-arrays, invalid entries, and duplicate run ids', () => {
    expect(isHistory(null)).toBe(false);
    expect(isHistory([makeEntry(), makeEntry({ runId: 'run-2' }), makeEntry({ seed: '!!' })])).toBe(
      false,
    );
    expect(isHistory([makeEntry(), makeEntry()])).toBe(false);
  });
});

describe('addHistoryEntry', () => {
  it('prepends the newest entry', () => {
    const first = makeEntry({ runId: 'run-1' });
    const second = makeEntry({ runId: 'run-2' });
    expect(addHistoryEntry([first], second).map((entry) => entry.runId)).toEqual([
      'run-2',
      'run-1',
    ]);
  });

  it('keeps entries newest first while trimming to the limit', () => {
    const history = fill(HISTORY_LIMIT);
    const newest = makeEntry({
      runId: 'run-newest',
      finishedAt: '2026-11-01T00:00:00.000Z',
    });
    const next = addHistoryEntry(history, newest);
    expect(next).toHaveLength(HISTORY_LIMIT);
    expect(next[0]?.runId).toBe('run-newest');
    expect(next.some((entry) => entry.runId === `run-${HISTORY_LIMIT}`)).toBe(false);
    expect(next.at(-1)?.runId).toBe(`run-${HISTORY_LIMIT - 1}`);
  });

  it('moves a replaced run id to the front without duplicating it', () => {
    const history = fill(3);
    const updated = makeEntry({ runId: 'run-2', score: 99 });
    const next = addHistoryEntry(history, updated);
    expect(next).toHaveLength(3);
    expect(next.map((entry) => entry.runId)).toEqual(['run-2', 'run-1', 'run-3']);
    expect(next[0]?.score).toBe(99);
  });
});
