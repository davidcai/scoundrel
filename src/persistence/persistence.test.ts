import { beforeEach, describe, expect, it } from 'vitest';
import { makeConfig, makeState } from '../test/fixtures';
import { slotsFor } from '../test/fixtures';
import {
  defaultSettings,
  loadSettings,
  normalizeConfig,
  saveSettings,
  SETTINGS_VERSION,
} from './settings';
import {
  emptyStats,
  loadStats,
  recordRun,
  RUN_HISTORY_CAP,
  saveStats,
  type RunRecord,
} from './stats';
import { loadRun, saveRun, clearRunRecord } from './run';
import { STORAGE_KEYS } from './storage';

function readRawEnvelope(key: string): { version: number; data: Record<string, unknown> } {
  const raw = localStorage.getItem(key);
  if (raw === null) throw new Error(`expected a stored envelope at ${key}`);
  return JSON.parse(raw) as { version: number; data: Record<string, unknown> };
}

beforeEach(() => {
  localStorage.clear();
});

describe('settings shard', () => {
  it('returns canonical defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual({
      runAwayMode: 'once',
      potionsPerRoom: 1,
      weaponDegradation: true,
    });
  });

  it('persists toggles across loads (round-trip)', () => {
    const config = makeConfig({
      runAwayMode: 'unlimited',
      potionsPerRoom: Number.POSITIVE_INFINITY,
      weaponDegradation: false,
    });
    saveSettings(config);
    expect(loadSettings()).toEqual(config);
  });

  it('serializes potionsPerRoom=Infinity without losing it', () => {
    saveSettings(makeConfig({ potionsPerRoom: Number.POSITIVE_INFINITY }));
    const raw = readRawEnvelope(STORAGE_KEYS.settings);
    expect(raw.data.potionsPerRoom).toBeNull(); // JSON has no Infinity
    expect(loadSettings().potionsPerRoom).toBe(Number.POSITIVE_INFINITY);
  });

  it('migrates a version-0 envelope into the current schema', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 0,
        data: { unlimitedRunAway: true, unlimitedPotions: true, weaponDegradation: false },
      }),
    );
    expect(loadSettings()).toEqual({
      runAwayMode: 'unlimited',
      potionsPerRoom: Number.POSITIVE_INFINITY,
      weaponDegradation: false,
    });
    // Migration is sticky: envelope rewritten at the current version.
    expect(readRawEnvelope(STORAGE_KEYS.settings).version).toBe(SETTINGS_VERSION);
  });

  it('falls back to defaults on corrupt data', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '{not json');
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it('normalizeConfig clamps unknown values to canonical', () => {
    expect(
      normalizeConfig({ runAwayMode: 'bogus', potionsPerRoom: 3, weaponDegradation: 0 }),
    ).toEqual({
      runAwayMode: 'once',
      potionsPerRoom: Number.POSITIVE_INFINITY,
      weaponDegradation: false,
    });
  });
});

describe('stats shard', () => {
  const rec = (overrides: Partial<RunRecord>): RunRecord => ({
    seed: 'abc123',
    config: makeConfig(),
    outcome: 'won',
    score: 14,
    date: 1_700_000_000_000,
    roomsCleared: 13,
    ...overrides,
  });

  it('records a win: aggregates move correctly', () => {
    const next = recordRun(emptyStats(), rec({}));
    expect(next).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      bestScore: 14,
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it('streak resets on a loss and best streak persists', () => {
    let stats = emptyStats();
    stats = recordRun(stats, rec({ outcome: 'won', score: 10 }));
    stats = recordRun(stats, rec({ outcome: 'won', score: 12 }));
    stats = recordRun(stats, rec({ outcome: 'lost', score: -4 }));
    stats = recordRun(stats, rec({ outcome: 'won', score: 8 }));
    expect(stats.gamesPlayed).toBe(4);
    expect(stats.bestScore).toBe(12);
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(2);
    expect(stats.wins).toBe(3);
    expect(stats.losses).toBe(1);
  });

  it('caps run history at 50, newest first', () => {
    let stats = emptyStats();
    for (let i = 0; i < 60; i++) {
      stats = recordRun(stats, rec({ seed: `seed${i}`, date: i }));
    }
    expect(stats.runs).toHaveLength(RUN_HISTORY_CAP);
    expect(stats.runs[0].seed).toBe('seed59');
    expect(stats.runs[49].seed).toBe('seed10');
  });

  it('restores Infinity configs inside stored run history', () => {
    const stats = recordRun(
      emptyStats(),
      rec({ config: makeConfig({ potionsPerRoom: Number.POSITIVE_INFINITY }) }),
    );
    saveStats(stats);
    expect(loadStats().runs[0].config.potionsPerRoom).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('run shard', () => {
  it('save → load round-trips the full persisted run', () => {
    const run = {
      state: makeState({ roomSnapshot: makeState({ hp: 18 }) }),
      slots: slotsFor(['club-8', 'diamond-5', 'heart-7', 'spade-2'], ['club-8']),
      slotsSnapshot: slotsFor(['club-8', 'diamond-5', 'heart-7', 'spade-2']),
      carriedCardId: 'club-8' as const,
      statsWritten: false,
      outcome: null,
    };
    saveRun(run);
    const loaded = loadRun();
    expect(loaded).not.toBeNull();
    if (loaded === null) throw new Error('expected a saved run');
    expect(loaded.state).toEqual(run.state);
    expect(loaded.slots).toEqual(run.slots);
    expect(loaded.slotsSnapshot).toEqual(run.slotsSnapshot);
    expect(loaded.carriedCardId).toBe('club-8');
    expect(loaded.statsWritten).toBe(false);
    expect(loaded.outcome).toBeNull();
    expect(typeof loaded.savedAt).toBe('number');
    expect(loaded.savedAt).toBeGreaterThan(0);
  });

  it('survives a terminal outcome inline (scorecard survives reload)', () => {
    saveRun({
      state: makeState({ phase: 'lost', hp: -3 }),
      slots: slotsFor(['club-8', 'diamond-5', 'heart-7', 'spade-2'], ['club-8']),
      slotsSnapshot: null,
      carriedCardId: null,
      statsWritten: true,
      outcome: { phase: 'lost', score: -9 },
    });
    const loaded = loadRun();
    if (loaded === null) throw new Error('expected a saved run');
    expect(loaded.outcome).toEqual({ phase: 'lost', score: -9 });
    expect(loaded.state.phase).toBe('lost');
    expect(loaded.statsWritten).toBe(true);
  });

  it('restores Infinity potions config inside the saved GameState', () => {
    saveRun({
      state: makeState({ config: makeConfig({ potionsPerRoom: Number.POSITIVE_INFINITY }) }),
      slots: slotsFor(['club-8']),
      slotsSnapshot: null,
      carriedCardId: null,
      statsWritten: false,
      outcome: null,
    });
    const loaded = loadRun();
    if (loaded === null) throw new Error('expected a saved run');
    expect(loaded.state.config.potionsPerRoom).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns null when nothing is stored, and clearRunRecord removes it', () => {
    expect(loadRun()).toBeNull();
    saveRun({
      state: makeState(),
      slots: slotsFor(['club-8']),
      slotsSnapshot: null,
      carriedCardId: null,
      statsWritten: false,
      outcome: null,
    });
    clearRunRecord();
    expect(loadRun()).toBeNull();
  });
});
