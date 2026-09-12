import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createInitialState } from '../src/engine';
import { STORAGE_KEYS, load, migrateVersion, save } from '../src/store/persistence';
import { emptyStats, loadStats, recordRun, saveStats, type RunRecord } from '../src/store/stats';
import { loadSettings, saveSettings } from '../src/store/settings';
import { decodeConfig, encodeConfig, runUrl } from '../src/store/share';
import { announce } from '../src/store/announcements';

beforeEach(() => {
  localStorage.clear();
});

describe('persistence wrappers', () => {
  it('round-trips versioned data', () => {
    save(STORAGE_KEYS.settings, { hello: 'world' });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)!);
    expect(raw).toEqual({ version: 1, data: { hello: 'world' } });
    expect(
      load<unknown>(
        STORAGE_KEYS.settings,
        migrateVersion(1, (d) => d),
      ),
    ).toEqual({
      hello: 'world',
    });
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '{not json');
    expect(
      load<unknown>(
        STORAGE_KEYS.settings,
        migrateVersion(1, (d) => d),
      ),
    ).toBeNull();
  });

  it('returns null for future versions (no downgrade path)', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ version: 99, data: {} }));
    expect(
      load<unknown>(
        STORAGE_KEYS.settings,
        migrateVersion(1, (d) => d),
      ),
    ).toBeNull();
  });

  it('keeps the three shards independent', () => {
    save(STORAGE_KEYS.settings, { config: DEFAULT_CONFIG });
    save(STORAGE_KEYS.stats, emptyStats());
    save(STORAGE_KEYS.run, { state: null, statsWritten: false });
    expect(Object.keys(localStorage).sort()).toEqual([
      'scoundrel:run',
      'scoundrel:settings',
      'scoundrel:stats',
    ]);
  });
});

describe('settings', () => {
  it('defaults to the canonical rule set', () => {
    expect(loadSettings()).toEqual({ config: DEFAULT_CONFIG });
  });

  it('persists across loads', () => {
    const custom = { ...DEFAULT_CONFIG, potionsPerRoom: 'unlimited' as const };
    saveSettings(custom);
    expect(loadSettings().config).toEqual(custom);
  });

  it('falls back to defaults on corrupt data', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ version: 1, data: 'garbage' }));
    expect(loadSettings()).toEqual({ config: DEFAULT_CONFIG });
  });
});

describe('stats', () => {
  const run = (outcome: 'won' | 'lost', score: number): RunRecord => ({
    seed: 'abc',
    config: { ...DEFAULT_CONFIG },
    outcome,
    score,
    date: 1000,
    roomsCleared: 3,
  });

  it('starts empty', () => {
    expect(loadStats()).toEqual(emptyStats());
  });

  it('folds a won run into the aggregates and streak', () => {
    const next = recordRun(emptyStats(), run('won', 14));
    expect(next.gamesPlayed).toBe(1);
    expect(next.wins).toBe(1);
    expect(next.bestScore).toBe(14);
    expect(next.currentStreak).toBe(1);
    expect(next.bestStreak).toBe(1);
    expect(next.runs[0]?.outcome).toBe('won');
  });

  it('resets the streak on a loss and keeps best streak', () => {
    let stats = recordRun(emptyStats(), run('won', 10));
    stats = recordRun(stats, run('won', 12));
    stats = recordRun(stats, run('lost', -5));
    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.bestScore).toBe(12);
  });

  it('caps run history at 50, newest first', () => {
    let stats = emptyStats();
    for (let i = 0; i < 60; i++) {
      stats = recordRun(stats, { ...run('lost', -i), date: i });
    }
    expect(stats.runs).toHaveLength(50);
    expect(stats.runs[0]?.date).toBe(59);
    expect(stats.gamesPlayed).toBe(60);
  });

  it('round-trips through localStorage', () => {
    saveStats(recordRun(emptyStats(), run('won', 18)));
    const loaded = loadStats();
    expect(loaded.gamesPlayed).toBe(1);
    expect(loaded.runs[0]?.score).toBe(18);
  });
});

describe('share URLs', () => {
  it('omits the config param for the canonical rule set', () => {
    expect(encodeConfig(DEFAULT_CONFIG)).toBe('');
    expect(runUrl('abc123', DEFAULT_CONFIG)).toBe('#/play?seed=abc123');
  });

  it('encodes non-default toggles and round-trips', () => {
    const custom = {
      runAwayMode: 'unlimited' as const,
      potionsPerRoom: 'unlimited' as const,
      weaponDegradation: false,
    };
    const url = runUrl('xyz', custom);
    // URLSearchParams encodes the comma separators; they decode transparently.
    expect(url).toBe('#/play?seed=xyz&config=free-run%2Cfree-potions%2Cno-degradation');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(decodeConfig(params.get('config'))).toEqual(custom);
  });

  it('decodes unknown tokens to defaults', () => {
    expect(decodeConfig('bogus-token')).toEqual(DEFAULT_CONFIG);
    expect(decodeConfig(null)).toEqual(DEFAULT_CONFIG);
  });
});

describe('announcements', () => {
  const state = createInitialState('abc', DEFAULT_CONFIG);

  it('maps result payloads to readable text', () => {
    expect(
      announce(
        {
          type: 'MonsterDefeated',
          cardId: 'club-8',
          damage: 3,
          usedWeaponId: 'diamond-5',
          weaponBroke: false,
        },
        state,
      ),
    ).toContain('8 of Clubs');
    expect(announce({ type: 'RunAwayBlocked', reason: 'twice-in-a-row' }, state)).toContain(
      'cannot run',
    );
  });
});
