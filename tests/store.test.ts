import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createInitialState } from '../src/engine';
import { SCHEMA_VERSION, STORAGE_KEYS, load, migrateVersion, save } from '../src/store/persistence';
import { loadRunSave, useGameStore } from '../src/store/game-store';
import { emptyStats, loadStats, recordRun, saveStats, type RunRecord } from '../src/store/stats';
import {
  loadLanguage,
  loadLanguageSetting,
  loadSettings,
  saveLanguage,
  saveSettings,
} from '../src/store/settings';
import { decodeConfig, encodeConfig, runUrl } from '../src/store/share';
import { announce } from '../src/store/announcements';
import { useLanguage } from '../src/i18n';

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
  it('defaults to the canonical rule set with auto language', () => {
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'auto',
      tableRenderer: 'dom',
    });
  });

  it('resolves auto through browser detection', () => {
    localStorage.clear();
    expect(loadLanguageSetting()).toBe('auto');
    // jsdom reports en-US, so auto resolves to English here.
    expect(loadLanguage()).toBe('en');
  });

  it('detects Chinese for zh-configured browsers', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
    Object.defineProperty(navigator, 'languages', {
      value: ['zh-CN', 'en-US'],
      configurable: true,
    });
    try {
      localStorage.clear();
      // Fresh visits stay stored as 'auto'; resolution applies the browser locale.
      expect(loadLanguageSetting()).toBe('auto');
      expect(loadLanguage()).toBe('zh');
    } finally {
      localStorage.clear();
      if (original) Object.defineProperty(navigator, 'language', original);
      else delete (navigator as { language?: unknown }).language;
      delete (navigator as { languages?: unknown }).languages;
    }
  });

  it('persists across loads', () => {
    const custom = { ...DEFAULT_CONFIG, potionsPerRoom: 'unlimited' as const };
    saveSettings(custom);
    expect(loadSettings().config).toEqual(custom);
  });

  it('falls back to defaults on corrupt data', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ version: 1, data: 'garbage' }));
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'auto',
      tableRenderer: 'dom',
    });
  });

  it('persists the language independently of the rule config', () => {
    saveLanguage('zh');
    expect(loadLanguageSetting()).toBe('zh');
    const custom = { ...DEFAULT_CONFIG, weaponDegradation: false };
    saveSettings(custom);
    expect(loadSettings()).toEqual({ config: custom, language: 'zh', tableRenderer: 'dom' });
    saveLanguage('auto');
    expect(loadLanguageSetting()).toBe('auto');
    expect(loadLanguage()).toBe('en');
  });

  it('accepts legacy settings shards without a language field', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ version: 1, data: { config: DEFAULT_CONFIG } }),
    );
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'auto',
      tableRenderer: 'dom',
    });
  });
});

describe('tableRenderer setting (Phaser integration)', () => {
  it('round-trips the renderer preference', () => {
    saveSettings(DEFAULT_CONFIG, 'en', 'phaser');
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'en',
      tableRenderer: 'phaser',
    });
  });

  it('defaults to dom when never set', () => {
    saveSettings(DEFAULT_CONFIG);
    expect(loadSettings().tableRenderer).toBe('dom');
  });

  it('is preserved by saveLanguage', () => {
    saveSettings(DEFAULT_CONFIG, 'en', 'phaser');
    saveLanguage('zh');
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'zh',
      tableRenderer: 'phaser',
    });
  });

  it('migrates v1 settings shards (no tableRenderer field) to the dom default', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ version: 1, data: { config: DEFAULT_CONFIG, language: 'zh' } }),
    );
    expect(loadSettings()).toEqual({
      config: DEFAULT_CONFIG,
      language: 'zh',
      tableRenderer: 'dom',
    });
  });

  it('falls back to dom on an invalid renderer value', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        version: 1,
        data: { config: DEFAULT_CONFIG, language: 'auto', tableRenderer: 'canvas2d' },
      }),
    );
    expect(loadSettings().tableRenderer).toBe('dom');
  });
});

describe('run shard survives the settings-version bump', () => {
  it('a run saved after the settings bump still loads (loadRunSave is not null)', () => {
    // Post-bump settings shard on disk, with the new field set.
    saveSettings(DEFAULT_CONFIG, 'en', 'phaser');
    useGameStore.getState().startRun('bump-regression', DEFAULT_CONFIG);
    const saved = loadRunSave();
    expect(saved).not.toBeNull();
    expect(saved!.state.room).toHaveLength(4);
    // The run shard must still be stamped with the global SCHEMA_VERSION (1):
    // bumping only the settings call-site must never re-stamp run/stats shards.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.run)!).version).toBe(SCHEMA_VERSION);
  });

  it('a run saved with tableRenderer settings present hydrates into the store', () => {
    saveSettings(DEFAULT_CONFIG, 'en', 'phaser');
    useGameStore.getState().startRun('hydrate-bump', DEFAULT_CONFIG);
    useGameStore.getState().reset();
    useGameStore.getState().hydrate();
    expect(useGameStore.getState().game?.seed).toBe('hydrate-bump');
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

  beforeEach(() => {
    // These assertions use the English message table.
    useLanguage.setState({ lang: 'en' });
  });

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
