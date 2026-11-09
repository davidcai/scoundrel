import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  calculateLossScore,
  createInitialState,
  isMonster,
  sumMonsterValues,
  type CardId,
  type GameState,
  type RuleConfig,
} from '../engine';
import { SCHEMA_VERSION, STORAGE_KEYS } from './persistence';
import { DEFAULT_SETTINGS, type StoredSettings } from './settings';
import {
  createScoundrelStore,
  type ScoundrelStore,
  type StartRunResult,
  type StartedRun,
} from './scoundrelStore';
import { createPersistedRun } from './activeRun';
import {
  createMemoryStorage,
  createUnavailableStorage,
  type MemoryStorage,
  type StoreStorage,
  type StorageListener,
} from './storage';
import {
  abandonmentState,
  findLostState,
  noMonsterDungeonState,
  stateWithUndo,
  winningState,
} from '../../tests/helpers/storeRuns';

const START_MS = Date.parse('2026-10-31T12:00:00.000Z');

interface HarnessOptions {
  readonly storage?: MemoryStorage;
  /** Override the storage instance (used for the unavailable-storage cases). */
  readonly storeStorage?: StoreStorage;
  readonly idPrefix?: string;
  readonly seedPrefix?: string;
  readonly newSeed?: () => string;
  readonly now?: () => Date;
}

interface Harness {
  readonly store: ScoundrelStore;
  readonly storage: MemoryStorage;
}

function createHarness(options: HarnessOptions = {}): Harness {
  const storage = options.storage ?? createMemoryStorage();
  const instanceStorage = options.storeStorage ?? storage;
  let runs = 0;
  let seeds = 0;
  let tick = 0;
  const store = createScoundrelStore({
    storage: instanceStorage,
    now: options.now ?? (() => new Date(START_MS + tick++ * 1000)),
    newRunId: () => `${options.idPrefix ?? 'run'}-${String(++runs)}`,
    newSeed: options.newSeed ?? (() => `${options.seedPrefix ?? 'auto-seed'}-${String(++seeds)}`),
  });
  return { store, storage };
}

function expectStarted(result: StartRunResult): StartedRun {
  if (!result.ok) throw new Error(`Expected a started run, got ${result.reason}`);
  return result.run;
}

function playSeed(seed = 'plain-257', config: RuleConfig = DEFAULT_RULE_CONFIG): GameState {
  return createInitialState(seed, config);
}

/** Finish the saved run with a win and return its recorded score. */
function winRun(store: ScoundrelStore, seed = 'plain-257'): number {
  const run = expectStarted(store.startRunWithSeed(seed, DEFAULT_RULE_CONFIG));
  const result = store.completeRun(run.runId, winningState());
  if (!result.ok) throw new Error(`Expected a completed win, got ${result.reason}`);
  return result.result.score;
}

/** Finish the saved run with a loss and return its recorded score. */
function loseRun(store: ScoundrelStore): number {
  const state = findLostState();
  const run = expectStarted(store.startRunWithSeed(state.seed, state.config));
  const result = store.completeRun(run.runId, state);
  if (!result.ok) throw new Error(`Expected a completed loss, got ${result.reason}`);
  return result.result.score;
}

interface ControllableStorageControls {
  readonly storage: StoreStorage;
  setWriteFailure(failing: boolean): void;
  /** Fail writes only for these keys; pass an empty list to clear. */
  failWritesFor(keys: readonly string[]): void;
  setRemoveFailure(failing: boolean): void;
}

/** A read-able storage whose writes/removals can be failed on demand. */
function createControllableStorage(inner: MemoryStorage): ControllableStorageControls {
  let writeFails = false;
  let removeFails = false;
  let failingWriteKeys: ReadonlySet<string> | null = null;
  const listeners = new Set<StorageListener>();
  const storage: StoreStorage = {
    available: true,
    read: (key) => inner.read(key),
    write: (key, value) =>
      writeFails || failingWriteKeys?.has(key) === true
        ? { status: 'unavailable' }
        : inner.write(key, value),
    remove: (key) => (removeFails ? { status: 'unavailable' } : inner.remove(key)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    storage,
    setWriteFailure(failing) {
      writeFails = failing;
    },
    failWritesFor(keys) {
      failingWriteKeys = new Set(keys);
    },
    setRemoveFailure(failing) {
      removeFails = failing;
    },
  };
}

interface ScriptedStorageOptions {
  /** How many run-shard writes succeed before writes start failing. */
  readonly runWritesBeforeFailure: number;
  readonly failStatsWrites: boolean;
  readonly failRemoves: boolean;
}

/** Storage that fails stats writes and then run writes after a scripted count. */
function createScriptedStorage(
  inner: MemoryStorage,
  options: ScriptedStorageOptions,
): StoreStorage {
  let runWrites = 0;
  return {
    available: true,
    read: (key) => inner.read(key),
    write: (key, value) => {
      if (key === STORAGE_KEYS.stats && options.failStatsWrites) {
        return { status: 'unavailable' };
      }
      if (key === STORAGE_KEYS.run) {
        runWrites += 1;
        if (runWrites > options.runWritesBeforeFailure) {
          return { status: 'unavailable' };
        }
      }
      return inner.write(key, value);
    },
    remove: (key) => (options.failRemoves ? { status: 'unavailable' } : inner.remove(key)),
    subscribe: () => () => undefined,
  };
}

interface EventedStorage {
  readonly storage: StoreStorage;
  emit(key: string | null): void;
  listenerCount(): number;
}

/** A storage double that can broadcast the browser's cross-tab event manually. */
function createEventedStorage(): EventedStorage {
  const memory = createMemoryStorage();
  const listeners = new Set<StorageListener>();
  return {
    storage: {
      available: true,
      read: (key) => memory.read(key),
      write: (key, value) => memory.write(key, value),
      remove: (key) => memory.remove(key),
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    emit(key) {
      for (const listener of [...listeners]) listener(key);
    },
    listenerCount: () => listeners.size,
  };
}

describe('empty store', () => {
  it('starts with no saved run, no statistics, and default settings', () => {
    const { store } = createHarness();
    const snapshot = store.getSnapshot();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.completedResult).toBeNull();
    expect(snapshot.statistics).toEqual({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      bestScore: null,
      currentStreak: 0,
      bestStreak: 0,
    });
    expect(snapshot.winRatePercent).toBeNull();
    expect(snapshot.history).toEqual([]);
    expect(snapshot.settings).toEqual(DEFAULT_SETTINGS);
    expect(snapshot.title).toEqual({
      canContinue: false,
      canDiscard: false,
      hasCompletedResult: false,
    });
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.recovery).toEqual([]);
    expect(snapshot.storageAvailable).toBe(true);
  });

  it('keeps a stable snapshot object until something changes', () => {
    const { store } = createHarness();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    const before = store.getSnapshot();
    expectStarted(store.startNewRun(0));
    expect(store.getSnapshot()).not.toBe(before);
  });

  it('notifies subscribers and stops after unsubscribe or close', () => {
    const { store } = createHarness();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    expectStarted(store.startNewRun(0));
    expect(calls).toBeGreaterThan(0);
    const afterStart = calls;
    unsubscribe();
    store.startNewRun(0);
    expect(calls).toBe(afterStart);
    store.close();
  });
});

describe('starting runs', () => {
  it('rejects an invalid rule config without saving anything', () => {
    const { store } = createHarness();
    expect(store.startNewRun(8 as RuleConfig)).toEqual({ ok: false, reason: 'invalid-config' });
    expect(store.getSnapshot().activeRun).toBeNull();
  });

  it('starts a new run with a generated seed and persists it', () => {
    const { store, storage } = createHarness();
    const result = store.startNewRun(0);
    const run = expectStarted(result);
    expect(run.seed).toBe('auto-seed-1');
    expect(run.config).toBe(DEFAULT_RULE_CONFIG);
    expect(run.persisted).toBe(true);
    expect(result.ok && result.replacedRunId).toBeNull();
    expect(result.ok && result.abandonedLossRecorded).toBe(false);

    const snapshot = store.getSnapshot();
    expect(snapshot.activeRun?.runId).toBe(run.runId);
    expect(snapshot.activeRun?.state).toEqual(createInitialState(run.seed, 0));
    expect(snapshot.title).toEqual({
      canContinue: true,
      canDiscard: true,
      hasCompletedResult: false,
    });

    const raw = storage.snapshot()[STORAGE_KEYS.run];
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ schemaVersion: SCHEMA_VERSION });
  });

  it('starts from an explicit seed and applies the supplied options', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('  Chosen-Seed ', 5));
    expect(run.seed).toBe('Chosen-Seed');
    expect(run.config).toBe(5);
    expect(store.getSnapshot().activeRun?.state).toEqual(createInitialState('Chosen-Seed', 5));
  });

  it('starts from a valid share link and respects its options', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startFromSharedLink('#/play?seed=linked-seed&config=3', 0));
    expect(run.seed).toBe('linked-seed');
    expect(run.config).toBe(3);
    expect(run.state).toEqual(createInitialState('linked-seed', 3));
  });

  it('uses the selected options for a seed-only link (REQ-014)', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startFromSharedLink('#/play?seed=linked-seed', 6));
    expect(run.config).toBe(6);
    expect(run.state).toEqual(createInitialState('linked-seed', 6));
  });

  it('reports a seed generator failure without changing the saved run', () => {
    const { store } = createHarness({
      newSeed: () => {
        throw new Error('no crypto');
      },
    });
    expect(store.startNewRun(0)).toEqual({ ok: false, reason: 'seed-unavailable' });
    expect(store.getSnapshot().activeRun).toBeNull();
  });
});

describe('save and resume', () => {
  it('restores progress and the undo snapshot after reload', () => {
    const first = createHarness();
    const run = expectStarted(first.store.startRunWithSeed('plain-257', 0));
    const progress = stateWithUndo();
    expect(first.store.saveRunState(run.runId, progress)).toEqual({ ok: true, persisted: true });

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    const snapshot = reloaded.store.getSnapshot();
    expect(snapshot.activeRun?.runId).toBe(run.runId);
    expect(snapshot.activeRun?.state).toEqual(progress);
    expect(snapshot.activeRun?.state.undo).not.toBeNull();
    expect(snapshot.title.canContinue).toBe(true);
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.warnings).toEqual([]);
  });

  it('does not record a loss for closing or reloading an unfinished run', () => {
    const first = createHarness();
    expectStarted(first.store.startNewRun(0));
    first.store.refresh();
    first.store.close();

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    reloaded.store.refresh();
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(reloaded.store.getSnapshot().history).toEqual([]);
    expect(reloaded.store.getSnapshot().activeRun).not.toBeNull();
  });

  it('rejects invalid states and saves for completed runs', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startNewRun(0));
    expect(store.saveRunState(run.runId, { ...playSeed(), health: 21 })).toEqual({
      ok: false,
      reason: 'invalid-state',
      persisted: false,
    });
    expect(store.saveRunState(run.runId, winningState())).toEqual({
      ok: false,
      reason: 'run-completed',
      persisted: false,
    });
  });

  it('does not let a stale tab save over a replaced run', () => {
    const { store } = createHarness();
    const first = expectStarted(store.startNewRun(0));
    const second = expectStarted(store.startNewRun(0));
    expect(store.saveRunState(first.runId, stateWithUndo())).toEqual({
      ok: false,
      reason: 'run-replaced',
      persisted: false,
    });
    expect(store.getSnapshot().activeRun?.runId).toBe(second.runId);
  });
});

describe('completing a run', () => {
  it('persists the result and records the outcome exactly once', () => {
    const { store, storage } = createHarness();
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    const finalState = winningState();
    const completed = store.completeRun(run.runId, finalState);
    if (!completed.ok) throw new Error(`Expected completion, got ${completed.reason}`);
    expect(completed).toMatchObject({ persisted: true, recorded: true, alreadyCompleted: false });
    expect(completed.result.outcome).toBe('won');

    const snapshot = store.getSnapshot();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.completedResult?.runId).toBe(run.runId);
    expect(snapshot.completedResult?.result).toEqual(completed.result);
    expect(snapshot.title).toEqual({
      canContinue: false,
      canDiscard: false,
      hasCompletedResult: true,
    });
    expect(snapshot.statistics).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      bestScore: completed.result.score,
      currentStreak: 1,
      bestStreak: 1,
    });
    expect(snapshot.winRatePercent).toBe(100);
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.history[0]).toMatchObject({
      runId: run.runId,
      seed: 'plain-257',
      config: 0,
      outcome: 'won',
      abandoned: false,
      score: completed.result.score,
      health: completed.result.health,
      roomsExplored: finalState.highlights.roomsExplored,
      roomsCleared: finalState.highlights.roomsCleared,
      monstersDefeated: finalState.highlights.monstersDefeated,
      potionsWasted: finalState.highlights.potionsWasted,
    });
    expect(snapshot.history[0]?.finishedAt.endsWith('Z')).toBe(true);
    expect(new Date(snapshot.history[0]?.finishedAt ?? '').toISOString()).toBe(
      snapshot.history[0]?.finishedAt,
    );

    const rawRun: unknown = JSON.parse(storage.snapshot()[STORAGE_KEYS.run] ?? '{}');
    expect(rawRun).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      data: { outcomeRecorded: true },
    });
  });

  it('restores the result after reload and does not record it again', () => {
    const first = createHarness();
    const run = expectStarted(first.store.startRunWithSeed('plain-257', 0));
    const completed = first.store.completeRun(run.runId, winningState());
    if (!completed.ok) throw new Error('expected completion');

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    const snapshot = reloaded.store.getSnapshot();
    expect(snapshot.completedResult?.result).toEqual(completed.result);
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.history).toHaveLength(1);

    const again = reloaded.store.completeRun(run.runId, winningState());
    expect(again).toMatchObject({ ok: true, alreadyCompleted: true, recorded: false });
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(reloaded.store.getSnapshot().history).toHaveLength(1);
  });

  it('cannot make undo available or resume a completed run', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    store.completeRun(run.runId, winningState());
    const snapshot = store.getSnapshot();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.completedResult?.state.status).toBe('won');
    expect(store.saveRunState(run.runId, stateWithUndo())).toEqual({
      ok: false,
      reason: 'run-completed',
      persisted: false,
    });
  });

  it('rejects completing an active or invalid run', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startNewRun(0));
    expect(store.completeRun(run.runId, run.state)).toEqual({ ok: false, reason: 'run-active' });
    expect(store.completeRun(run.runId, { ...winningState(), health: 99 })).toEqual({
      ok: false,
      reason: 'invalid-state',
    });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(0);
  });

  it('does not record an outcome for a run replaced by another tab', () => {
    const { store } = createHarness();
    const stale = expectStarted(store.startRunWithSeed('plain-257', 0));
    expectStarted(store.startRunWithSeed('new-run', 0));
    expect(store.completeRun(stale.runId, winningState())).toEqual({
      ok: false,
      reason: 'run-replaced',
    });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(store.getSnapshot().statistics.losses).toBe(1);
  });

  it('replaces a finished result without adding another loss', () => {
    const { store } = createHarness();
    winRun(store);
    const replacement = store.startNewRun(0);
    expect(replacement.ok && replacement.abandonedLossRecorded).toBe(false);
    const snapshot = store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.statistics.losses).toBe(0);
    expect(snapshot.completedResult).toBeNull();
    expect(snapshot.title.hasCompletedResult).toBe(false);
  });
});

describe('abandonment', () => {
  it('records exactly one loss scored from the outgoing draw pile (-38)', () => {
    const first = createHarness();
    const run = expectStarted(first.store.startRunWithSeed('plain-257', 0));
    const away = abandonmentState(38);
    expect(calculateLossScore(away.state.dungeon)).toBe(-38);
    expect(first.store.saveRunState(run.runId, away.state)).toEqual({ ok: true, persisted: true });

    const replacement = first.store.startRunWithSeed('next-run', 0);
    if (!replacement.ok) throw new Error('expected replacement');
    expect(replacement.replacedRunId).toBe(run.runId);
    expect(replacement.abandonedLossRecorded).toBe(true);

    const snapshot = first.store.getSnapshot();
    expect(snapshot.statistics).toEqual({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      bestScore: -38,
      currentStreak: 0,
      bestStreak: 0,
    });
    expect(snapshot.winRatePercent).toBe(0);
    expect(snapshot.history[0]).toMatchObject({
      runId: run.runId,
      outcome: 'lost',
      abandoned: true,
      score: -38,
      health: away.state.health,
    });
    expect(snapshot.activeRun?.seed).toBe('next-run');

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(reloaded.store.getSnapshot().statistics.bestScore).toBe(-38);
  });

  it('scores zero but still records a loss when the draw pile has no monsters', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    expect(store.saveRunState(run.runId, noMonsterDungeonState())).toEqual({
      ok: true,
      persisted: true,
    });
    const replacement = store.startRunWithSeed('next-run', 0);
    expect(replacement.ok && replacement.abandonedLossRecorded).toBe(true);

    const snapshot = store.getSnapshot();
    expect(snapshot.history[0]?.score).toBe(0);
    expect(snapshot.statistics.losses).toBe(1);
    expect(snapshot.statistics.bestScore).toBe(0);
  });

  it('does not let the incoming run change the outgoing score', () => {
    const { store } = createHarness();
    const first = expectStarted(store.startRunWithSeed('plain-257', 0));
    expect(store.saveRunState(first.runId, abandonmentState(38).state)).toEqual({
      ok: true,
      persisted: true,
    });

    const second = expectStarted(store.startRunWithSeed('middle', 0));
    const away7 = { ...abandonmentState(7).state, seed: 'middle' };
    expect(calculateLossScore(away7.dungeon)).toBe(-7);
    expect(store.saveRunState(second.runId, away7)).toEqual({ ok: true, persisted: true });
    expectStarted(store.startRunWithSeed('third', 0));

    const snapshot = store.getSnapshot();
    expect(snapshot.history.map((entry) => entry.score)).toEqual([-7, -38]);
    expect(snapshot.statistics.gamesPlayed).toBe(2);
    expect(snapshot.statistics.bestScore).toBe(-7);
    expect(snapshot.activeRun?.seed).toBe('third');
  });

  it('explicit discard records one abandoned loss and then reports no run', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    expect(store.saveRunState(run.runId, abandonmentState(38).state)).toEqual({
      ok: true,
      persisted: true,
    });

    expect(store.discardActiveRun()).toEqual({
      ok: true,
      discardedRunId: run.runId,
      recordedAbandonment: true,
      persisted: true,
    });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(store.getSnapshot().statistics.losses).toBe(1);
    expect(store.getSnapshot().activeRun).toBeNull();
    expect(store.discardActiveRun()).toEqual({ ok: false, reason: 'no-run' });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });

  it('explicit discard preserves preferences and earlier statistics', () => {
    const first = createHarness();
    expect(first.store.updateSettings({ locale: 'zh-Hans', reducedMotion: true })).toEqual({
      ok: true,
      persisted: true,
    });
    winRun(first.store);
    const run = expectStarted(first.store.startRunWithSeed('plain-257', 0));
    first.store.discardActiveRun();

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    const snapshot = reloaded.store.getSnapshot();
    expect(snapshot.settings).toEqual({ locale: 'zh-Hans', reducedMotion: true });
    expect(snapshot.statistics.gamesPlayed).toBe(2);
    expect(snapshot.statistics.wins).toBe(1);
    expect(snapshot.statistics.losses).toBe(1);
    expect(snapshot.winRatePercent).toBe(50);
    expect(snapshot.history).toHaveLength(2);
    expect(snapshot.activeRun).toBeNull();
    expect(run.runId).toBeDefined();
  });

  it('replaces an unfinished run through every documented entry point', () => {
    const scenarios: Array<{
      readonly label: string;
      readonly replace: (store: ScoundrelStore) => StartRunResult;
    }> = [
      { label: 'new run', replace: (store) => store.startNewRun(0) },
      { label: 'seed', replace: (store) => store.startRunWithSeed('seeded', 0) },
      {
        label: 'shared link',
        replace: (store) => store.startFromSharedLink('#/play?seed=linked&config=3', 0),
      },
    ];

    for (const scenario of scenarios) {
      const harness = createHarness();
      winRun(harness.store);
      const previous = expectStarted(harness.store.startRunWithSeed('outgoing', 0));
      const replacement = scenario.replace(harness.store);
      if (!replacement.ok) throw new Error(`Expected ${scenario.label} replacement`);
      expect(replacement.replacedRunId).toBe(previous.runId);
      expect(replacement.abandonedLossRecorded).toBe(true);
      const snapshot = harness.store.getSnapshot();
      expect(snapshot.statistics).toMatchObject({ gamesPlayed: 2, wins: 1, losses: 1 });
      expect(snapshot.winRatePercent).toBe(50);
      expect(snapshot.activeRun?.runId).toBe(replacement.run.runId);

      const reloaded = createHarness({ storage: harness.storage, idPrefix: 'reload' });
      expect(reloaded.store.getSnapshot().statistics).toMatchObject({
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
      });
      // Reload restores only the replacement, never the replaced run.
      expect(reloaded.store.getSnapshot().activeRun?.runId).toBe(replacement.run.runId);
      expect(reloaded.store.getSnapshot().activeRun?.seed).toBe(replacement.run.seed);
    }
  });

  it('replays a history entry, replacing the unfinished run with one abandoned loss', () => {
    const { store } = createHarness();
    const firstRun = expectStarted(store.startRunWithSeed('plain-257', 0));
    const completed = store.completeRun(firstRun.runId, winningState());
    if (!completed.ok) throw new Error('expected completion');

    const unfinished = expectStarted(store.startNewRun(0));
    const replay = store.replayHistoryEntry(firstRun.runId);
    if (!replay.ok) throw new Error(`Expected replay, got ${replay.reason}`);
    expect(replay.replacedRunId).toBe(unfinished.runId);
    expect(replay.abandonedLossRecorded).toBe(true);
    expect(replay.run.seed).toBe('plain-257');
    expect(replay.run.config).toBe(0);
    expect(replay.run.state).toEqual(createInitialState('plain-257', 0));

    const snapshot = store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(2);
    expect(snapshot.statistics.wins).toBe(1);
    expect(snapshot.statistics.losses).toBe(1);
    expect(snapshot.history).toHaveLength(2);
  });
});

describe('invalid input leaves the saved run untouched', () => {
  it('rejects invalid seeds, links, configs, and missing history entries', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    store.saveRunState(run.runId, stateWithUndo());
    const before = store.getSnapshot();

    expect(store.startRunWithSeed('', 0)).toEqual({ ok: false, reason: 'invalid-seed' });
    expect(store.startRunWithSeed('x'.repeat(65), 0)).toEqual({
      ok: false,
      reason: 'invalid-seed',
    });
    expect(store.startFromSharedLink('#/play?seed=', 0)).toEqual({
      ok: false,
      reason: 'invalid-seed',
    });
    expect(store.startFromSharedLink('#/title', 0)).toEqual({ ok: false, reason: 'invalid-link' });
    expect(store.startFromSharedLink('#/play?seed=plain-257&config=9', 0)).toEqual({
      ok: false,
      reason: 'invalid-config',
    });
    expect(store.startFromSharedLink('#/play?seed=plain-257', 9 as RuleConfig)).toEqual({
      ok: false,
      reason: 'invalid-config',
    });
    expect(store.replayHistoryEntry('missing-run')).toEqual({
      ok: false,
      reason: 'history-run-missing',
    });

    const after = store.getSnapshot();
    expect(after.activeRun?.runId).toBe(before.activeRun?.runId);
    expect(after.activeRun?.state).toEqual(before.activeRun?.state);
    expect(after.statistics).toEqual(before.statistics);
    expect(after.history).toEqual(before.history);
  });
});

describe('statistics, streaks, and history', () => {
  it('tracks streaks across wins, losses, and replays', () => {
    const { store } = createHarness();
    winRun(store);
    winRun(store);
    loseRun(store);
    winRun(store);
    expect(store.getSnapshot().statistics).toMatchObject({
      gamesPlayed: 4,
      wins: 3,
      losses: 1,
      currentStreak: 1,
      bestStreak: 2,
    });
    expect(store.getSnapshot().winRatePercent).toBe(75);
  });

  it('resets the current streak on abandonment and keeps the best streak', () => {
    const { store } = createHarness();
    winRun(store);
    winRun(store);
    expectStarted(store.startNewRun(0));
    store.discardActiveRun();
    expect(store.getSnapshot().statistics).toMatchObject({
      currentStreak: 0,
      bestStreak: 2,
      gamesPlayed: 3,
      losses: 1,
    });
  });

  it('does not change statistics while a run is unfinished', () => {
    const { store } = createHarness();
    winRun(store);
    expectStarted(store.startRunWithSeed('unfinished', 0));
    const snapshot = store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.statistics.wins).toBe(1);
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.title.canContinue).toBe(true);
  });

  it('keeps history newest first', () => {
    const { store } = createHarness();
    winRun(store);
    loseRun(store);
    const newestRunId = store.getSnapshot().history[0]?.runId;
    winRun(store);
    expect(store.getSnapshot().history[0]?.runId).not.toBe(newestRunId);
    expect(store.getSnapshot().history[0]?.outcome).toBe('won');
    expect(store.getSnapshot().history[1]?.outcome).toBe('lost');
  });

  it('counts a replayed run once it is completed', () => {
    const { store } = createHarness();
    const firstRun = expectStarted(store.startRunWithSeed('plain-257', 0));
    store.completeRun(firstRun.runId, winningState());
    const entryRunId = firstRun.runId;
    const replay = store.replayHistoryEntry(entryRunId);
    if (!replay.ok) throw new Error('expected replay');
    const completed = store.completeRun(replay.run.runId, winningState());
    if (!completed.ok) throw new Error('expected replay completion');
    expect(store.getSnapshot().statistics).toMatchObject({
      gamesPlayed: 2,
      wins: 2,
      currentStreak: 2,
      bestStreak: 2,
    });
  });

  it('trims history to the newest 30 while lifetime statistics keep 31 games', () => {
    const first = createHarness();
    const completedRunIds: string[] = [];
    for (let index = 0; index < 31; index += 1) {
      const run = expectStarted(first.store.startRunWithSeed('plain-257', 0));
      completedRunIds.push(run.runId);
      const result = first.store.completeRun(run.runId, winningState());
      if (!result.ok) throw new Error(`Expected win ${String(index)}`);
    }

    const snapshot = first.store.getSnapshot();
    expect(snapshot.history).toHaveLength(30);
    expect(snapshot.statistics.gamesPlayed).toBe(31);
    expect(snapshot.statistics.wins).toBe(31);
    expect(snapshot.statistics.currentStreak).toBe(31);
    expect(snapshot.statistics.bestStreak).toBe(31);
    expect(snapshot.history[0]?.runId).toBe(completedRunIds.at(-1));
    expect(snapshot.history.some((entry) => entry.runId === completedRunIds[0])).toBe(false);

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().history).toHaveLength(30);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(31);
    expect(reloaded.store.getSnapshot().history[0]?.runId).toBe(completedRunIds.at(-1));
  });
});

describe('preferences', () => {
  it('persists settings and restores them after reload', () => {
    const first = createHarness();
    expect(first.store.updateSettings({ locale: 'zh-Hans' })).toEqual({
      ok: true,
      persisted: true,
    });
    expect(first.store.updateSettings({ reducedMotion: false })).toEqual({
      ok: true,
      persisted: true,
    });
    expect(first.store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: false });

    const raw: unknown = JSON.parse(first.storage.snapshot()[STORAGE_KEYS.settings] ?? '{}');
    expect(raw).toMatchObject({
      schemaVersion: SCHEMA_VERSION,
      data: { locale: 'zh-Hans', reducedMotion: false },
    });

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().settings).toEqual({
      locale: 'zh-Hans',
      reducedMotion: false,
    });
  });

  it('rejects malformed settings without changing the saved value', () => {
    const { store } = createHarness();
    store.updateSettings({ locale: 'zh-Hans' });
    const invalid = { locale: 'fr', reducedMotion: null } as unknown as StoredSettings;
    expect(store.saveSettings(invalid)).toEqual({ ok: false, reason: 'invalid-settings' });
    expect(store.getSnapshot().settings.locale).toBe('zh-Hans');
  });

  it('keeps preferences while runs are replaced or discarded', () => {
    const { store } = createHarness();
    store.updateSettings({ locale: 'zh-Hans', reducedMotion: true });
    winRun(store);
    expectStarted(store.startNewRun(0));
    store.discardActiveRun();
    expect(store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: true });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(2);
  });
});

describe('share link helpers', () => {
  it('builds replay hashes and absolute URLs from the store', () => {
    const { store } = createHarness();
    expect(store.buildReplayLink('plain-257', 5)).toBe('#/play?seed=plain-257&config=5');
    expect(store.buildReplayLink('  Plain-257 ', 2)).toBe('#/play?seed=Plain-257&config=2');
    expect(store.buildReplayUrl('plain-257', 0, 'https://example.com/game/')).toBe(
      'https://example.com/game#/play?seed=plain-257&config=0',
    );
    expect(() => store.buildReplayLink('', 0)).toThrow(RangeError);
    expect(() => store.buildReplayLink('plain-257', 9 as RuleConfig)).toThrow(RangeError);
  });
});

describe('recovery', () => {
  it('preserves an unreadable run while readable settings and statistics load', () => {
    const storage = createMemoryStorage();
    const first = createHarness({ storage });
    first.store.updateSettings({ locale: 'zh-Hans' });
    winRun(first.store);
    storage.write(STORAGE_KEYS.run, '{broken run');

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    let snapshot = reloaded.store.getSnapshot();
    expect(snapshot.storageAvailable).toBe(true);
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.completedResult).toBeNull();
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.settings.locale).toBe('zh-Hans');
    expect(snapshot.recovery).toEqual([{ shard: 'run', status: 'corrupt' }]);
    expect(snapshot.warnings).toContainEqual({
      kind: 'unreadable-data',
      issue: { shard: 'run', status: 'corrupt' },
    });

    const started = reloaded.store.startRunWithSeed('plain-257', 0);
    if (!started.ok) throw new Error('expected a session run');
    expect(started.run.persisted).toBe(false);
    // The unreadable saved run cannot be replaced durably, so no abandonment is
    // recorded (storage still holds the old payload until recovery).
    expect(started.abandonedLossRecorded).toBe(false);
    expect(storage.snapshot()[STORAGE_KEYS.run]).toBe('{broken run');
    expect(reloaded.store.saveRunState(started.run.runId, stateWithUndo())).toEqual({
      ok: true,
      persisted: false,
    });
    expect(reloaded.store.discardActiveRun()).toEqual({ ok: false, reason: 'unreadable-run' });

    expect(reloaded.store.discardUnreadableRun()).toBe(true);
    expect(storage.snapshot()[STORAGE_KEYS.run]).toBeUndefined();
    snapshot = reloaded.store.getSnapshot();
    expect(snapshot.recovery).toEqual([]);
    expect(snapshot.warnings).toEqual([]);

    const replacement = reloaded.store.startRunWithSeed('plain-257', 0);
    if (!replacement.ok) throw new Error('expected a persisted run');
    expect(replacement.run.persisted).toBe(true);
  });

  it('reports an unsupported run schema version without overwriting it', () => {
    const storage = createMemoryStorage();
    const first = createHarness({ storage });
    first.store.updateSettings({ locale: 'zh-Hans' });
    const raw = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, data: { future: true } });
    storage.write(STORAGE_KEYS.run, raw);

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    const snapshot = reloaded.store.getSnapshot();
    expect(snapshot.recovery).toEqual([
      { shard: 'run', status: 'unsupported-version', version: SCHEMA_VERSION + 1 },
    ]);
    expect(storage.snapshot()[STORAGE_KEYS.run]).toBe(raw);
    expect(snapshot.settings.locale).toBe('zh-Hans');
    expect(reloaded.store.discardUnreadableRun()).toBe(true);
    expect(storage.snapshot()[STORAGE_KEYS.run]).toBeUndefined();
  });

  it('keeps session outcomes alive while statistics are unreadable, then heals after reset', () => {
    const storage = createMemoryStorage();
    const first = createHarness({ storage });
    winRun(first.store);
    storage.write(STORAGE_KEYS.stats, '{broken stats');

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    let snapshot = reloaded.store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.recovery).toEqual([{ shard: 'stats', status: 'corrupt' }]);
    expect(snapshot.completedResult?.result.outcome).toBe('won');

    const score = winRun(reloaded.store);
    expect(score).toBeGreaterThan(0);
    snapshot = reloaded.store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.statistics.wins).toBe(1);
    expect(storage.snapshot()[STORAGE_KEYS.stats]).toBe('{broken stats');

    expect(reloaded.store.resetUnreadableStats()).toBe(true);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(reloaded.store.getSnapshot().recovery).toEqual([]);

    const healed = createHarness({ storage, idPrefix: 'healed' });
    expect(healed.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(healed.store.getSnapshot().statistics.wins).toBe(1);
    expect(healed.store.getSnapshot().recovery).toEqual([]);
  });

  it('loads default preferences while settings are unreadable and resets them separately', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.settings]: '{broken settings' });
    const { store } = createHarness({ storage });
    expect(store.getSnapshot().settings).toEqual(DEFAULT_SETTINGS);
    expect(store.getSnapshot().recovery).toEqual([{ shard: 'settings', status: 'corrupt' }]);

    expect(store.updateSettings({ locale: 'zh-Hans' })).toEqual({ ok: true, persisted: false });
    expect(store.getSnapshot().settings.locale).toBe('zh-Hans');
    expect(storage.snapshot()[STORAGE_KEYS.settings]).toBe('{broken settings');

    expect(store.resetUnreadableSettings()).toBe(true);
    expect(store.getSnapshot().settings).toEqual(DEFAULT_SETTINGS);
    expect(store.updateSettings({ locale: 'zh-Hans' })).toEqual({ ok: true, persisted: true });

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().settings.locale).toBe('zh-Hans');
    expect(reloaded.store.getSnapshot().recovery).toEqual([]);
  });

  it('stays playable when browser storage is unavailable', () => {
    let runs = 0;
    let seeds = 0;
    const store = createScoundrelStore({
      storage: createUnavailableStorage(),
      now: () => new Date(START_MS),
      newRunId: () => `run-${String(++runs)}`,
      newSeed: () => `seed-${String(++seeds)}`,
    });
    expect(store.getSnapshot().storageAvailable).toBe(false);
    expect(store.getSnapshot().warnings).toContainEqual({ kind: 'storage-unavailable' });

    const startResult = store.startRunWithSeed('plain-257', 0);
    const run = expectStarted(startResult);
    expect(run.persisted).toBe(false);
    expect(startResult.ok && startResult.abandonedLossRecorded).toBe(false);
    expect(store.saveRunState(run.runId, stateWithUndo())).toEqual({ ok: true, persisted: false });
    const completed = store.completeRun(run.runId, winningState());
    if (!completed.ok) throw new Error('expected session completion');
    expect(completed.persisted).toBe(false);
    expect(completed.recorded).toBe(true);
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(store.getSnapshot().warnings).toContainEqual({ kind: 'storage-unavailable' });

    const reloaded = createScoundrelStore({
      storage: createUnavailableStorage(),
      now: () => new Date(START_MS),
      newRunId: () => 'run-again',
      newSeed: () => 'seed-again',
    });
    expect(reloaded.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(reloaded.getSnapshot().warnings).toContainEqual({ kind: 'storage-unavailable' });
  });

  it('aborts a new run when the run shard cannot be written', () => {
    const memory = createMemoryStorage();
    const failing: StoreStorage = {
      available: true,
      read: (key) => memory.read(key),
      write: () => ({ status: 'unavailable' }),
      remove: (key) => memory.remove(key),
      subscribe: () => () => undefined,
    };
    const store = createScoundrelStore({
      storage: failing,
      now: () => new Date(START_MS),
      newRunId: () => 'run-1',
      newSeed: () => 'seed-1',
    });
    expect(store.startNewRun(0)).toEqual({ ok: false, reason: 'write-failed' });
    expect(store.getSnapshot().activeRun).toBeNull();
    expect(store.getSnapshot().warnings).toContainEqual({ kind: 'write-failed', shard: 'run' });
    expect(store.getSnapshot().storageAvailable).toBe(true);
  });
});

describe('multi-tab and reload safety', () => {
  it('does not double-count a completed outcome when a second tab finishes the same run', () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, idPrefix: 'tab-a' });
    const run = expectStarted(tabA.store.startRunWithSeed('plain-257', 0));
    const tabB = createHarness({ storage, idPrefix: 'tab-b' });
    expect(tabB.store.getSnapshot().activeRun?.runId).toBe(run.runId);

    const completed = tabA.store.completeRun(run.runId, winningState());
    if (!completed.ok) throw new Error('expected completion');
    const duplicate = tabB.store.completeRun(run.runId, winningState());
    expect(duplicate).toMatchObject({ ok: true, alreadyCompleted: true, recorded: false });
    expect(tabB.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(tabB.store.getSnapshot().history).toHaveLength(1);

    const tabC = createHarness({ storage, idPrefix: 'tab-c' });
    expect(tabC.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });

  it('discards an abandoned loss once even when another tab tries to discard again', () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, idPrefix: 'tab-a' });
    expectStarted(tabA.store.startRunWithSeed('plain-257', 0));
    const tabB = createHarness({ storage, idPrefix: 'tab-b' });

    expect(tabA.store.discardActiveRun()).toMatchObject({ ok: true, recordedAbandonment: true });
    expect(tabB.store.discardActiveRun()).toEqual({ ok: false, reason: 'no-run' });
    expect(tabA.store.getSnapshot().statistics.gamesPlayed).toBe(1);

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(reloaded.store.getSnapshot().activeRun).toBeNull();
  });

  it('sees a replacement made by another tab after refresh with one abandoned loss', () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, idPrefix: 'tab-a' });
    const first = expectStarted(tabA.store.startRunWithSeed('plain-257', 0));
    const tabB = createHarness({ storage, idPrefix: 'tab-b' });
    expect(tabB.store.getSnapshot().activeRun?.runId).toBe(first.runId);

    expectStarted(tabA.store.startRunWithSeed('second', 0));
    tabB.store.refresh();
    expect(tabB.store.getSnapshot().activeRun?.seed).toBe('second');
    expect(tabB.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(tabB.store.getSnapshot().statistics.losses).toBe(1);

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });
});

describe('outcome details', () => {
  it('restores a completed loss after reload without counting it again', () => {
    const first = createHarness();
    const lossState = findLostState();
    const run = expectStarted(first.store.startRunWithSeed(lossState.seed, lossState.config));
    const completed = first.store.completeRun(run.runId, lossState);
    if (!completed.ok) throw new Error('expected loss completion');

    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().completedResult?.result.outcome).toBe('lost');
    expect(reloaded.store.getSnapshot().statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(reloaded.store.getSnapshot().history[0]?.outcome).toBe('lost');

    const again = reloaded.store.completeRun(run.runId, lossState);
    expect(again).toMatchObject({ ok: true, alreadyCompleted: true, recorded: false });
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(reloaded.store.getSnapshot().history).toHaveLength(1);
  });

  it('maps room and highlight counts to history for a loss', () => {
    const { store } = createHarness();
    const lossState = findLostState();
    const run = expectStarted(store.startRunWithSeed(lossState.seed, lossState.config));
    store.completeRun(run.runId, lossState);

    const entry = store.getSnapshot().history[0];
    expect(entry).toMatchObject({
      outcome: 'lost',
      roomsExplored: lossState.highlights.roomsExplored,
      roomsCleared: lossState.highlights.roomsCleared,
      monstersDefeated: lossState.highlights.monstersDefeated,
      potionsWasted: lossState.highlights.potionsWasted,
      health: lossState.result?.health,
    });
  });

  it('scores only draw-pile monsters, ignoring positive health and room monsters', () => {
    let state = createInitialState('plain-257', DEFAULT_RULE_CONFIG);
    const roomMonsterCards = (candidate: GameState): readonly CardId[] =>
      candidate.room.cards.map((roomCard) => roomCard.card).filter((card) => isMonster(card));
    for (let index = 0; roomMonsterCards(state).length === 0 && index < 50; index += 1) {
      state = createInitialState(`room-monsters-${String(index)}`, DEFAULT_RULE_CONFIG);
    }
    expect(roomMonsterCards(state).length).toBeGreaterThan(0);

    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed(state.seed, state.config));
    expect(store.saveRunState(run.runId, state)).toEqual({ ok: true, persisted: true });
    expect(calculateLossScore(state.dungeon)).toBe(-sumMonsterValues(state.dungeon));

    expect(store.discardActiveRun()).toMatchObject({ ok: true, recordedAbandonment: true });
    const entry = store.getSnapshot().history[0];
    expect(entry?.score).toBe(calculateLossScore(state.dungeon));
    expect(entry?.health).toBe(state.health);
    expect(entry?.health).toBeGreaterThan(0);
    // Room monsters are not in the outgoing draw pile and do not change the score.
    expect(entry?.score).not.toBe(
      calculateLossScore([...state.dungeon, ...roomMonsterCards(state)]),
    );
  });

  it('includes abandonment scores in the best score alongside wins', () => {
    const { store } = createHarness();
    const winScore = winRun(store);
    const run = expectStarted(store.startRunWithSeed('plain-257', 0));
    store.saveRunState(run.runId, createInitialState('plain-257', DEFAULT_RULE_CONFIG));
    store.discardActiveRun();
    const snapshot = store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(2);
    expect(snapshot.statistics.losses).toBe(1);
    expect(snapshot.statistics.bestScore).toBe(winScore);
    expect(snapshot.history[0]?.abandoned).toBe(true);
  });
});

describe('stale-tab protection', () => {
  it('does not resurrect a run discarded by another tab', () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, idPrefix: 'tab-a' });
    const run = expectStarted(tabA.store.startRunWithSeed('plain-257', 0));
    const tabB = createHarness({ storage, idPrefix: 'tab-b' });
    expect(tabB.store.discardActiveRun()).toMatchObject({ ok: true, recordedAbandonment: true });

    expect(tabA.store.saveRunState(run.runId, stateWithUndo())).toEqual({
      ok: false,
      reason: 'run-replaced',
      persisted: false,
    });
    expect(tabA.store.getSnapshot().activeRun).toBeNull();

    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun).toBeNull();
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });
});

describe('write ordering (REQ-001 / REQ-009)', () => {
  it('leaves the outgoing run resumable when the replacement write fails', () => {
    const memory = createMemoryStorage();
    const controls = createControllableStorage(memory);
    const first = createHarness({ storage: memory, storeStorage: controls.storage });
    const outgoing = expectStarted(first.store.startRunWithSeed('outgoing', 0));

    controls.setWriteFailure(true);
    expect(first.store.startRunWithSeed('incoming', 0)).toEqual({
      ok: false,
      reason: 'write-failed',
    });

    let snapshot = first.store.getSnapshot();
    expect(snapshot.activeRun?.runId).toBe(outgoing.runId);
    expect(snapshot.activeRun?.seed).toBe('outgoing');
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.history).toEqual([]);
    expect(snapshot.warnings).toContainEqual({ kind: 'write-failed', shard: 'run' });

    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun?.runId).toBe(outgoing.runId);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);

    controls.setWriteFailure(false);
    const retry = first.store.startRunWithSeed('incoming', 0);
    if (!retry.ok) throw new Error('expected a successful retry');
    expect(retry.replacedRunId).toBe(outgoing.runId);
    expect(retry.abandonedLossRecorded).toBe(true);
    snapshot = first.store.getSnapshot();
    expect(snapshot.statistics).toMatchObject({ gamesPlayed: 1, losses: 1, wins: 0 });
    expect(snapshot.activeRun?.seed).toBe('incoming');
    expect(first.store.completeRun(outgoing.runId, winningState())).toEqual({
      ok: false,
      reason: 'run-replaced',
    });

    const after = createHarness({ storage: memory, idPrefix: 'after' });
    expect(after.store.getSnapshot().activeRun?.seed).toBe('incoming');
    expect(after.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });

  it('does not resurrect a completed result when discarding it', () => {
    const memory = createMemoryStorage();
    const harness = createHarness({ storage: memory });
    const run = expectStarted(harness.store.startRunWithSeed('plain-257', 0));
    harness.store.completeRun(run.runId, winningState());
    expect(harness.store.discardActiveRun()).toMatchObject({ ok: true, persisted: true });
    expect(harness.store.getSnapshot().completedResult).toBeNull();

    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().completedResult).toBeNull();
    expect(reloaded.store.getSnapshot().activeRun).toBeNull();
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(memory.snapshot()[STORAGE_KEYS.run]).toBeUndefined();
  });

  it('leaves the run resumable when discard removal fails', () => {
    const memory = createMemoryStorage();
    const controls = createControllableStorage(memory);
    const harness = createHarness({ storage: memory, storeStorage: controls.storage });
    const run = expectStarted(harness.store.startRunWithSeed('plain-257', 0));

    controls.setRemoveFailure(true);
    expect(harness.store.discardActiveRun()).toEqual({ ok: false, reason: 'write-failed' });
    const snapshot = harness.store.getSnapshot();
    expect(snapshot.activeRun?.runId).toBe(run.runId);
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.warnings).toContainEqual({ kind: 'write-failed', shard: 'run' });

    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun?.runId).toBe(run.runId);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);

    controls.setRemoveFailure(false);
    expect(harness.store.discardActiveRun()).toMatchObject({ ok: true, recordedAbandonment: true });
    expect(harness.store.getSnapshot().statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(harness.store.getSnapshot().activeRun).toBeNull();

    const after = createHarness({ storage: memory, idPrefix: 'after' });
    expect(after.store.getSnapshot().activeRun).toBeNull();
    expect(after.store.getSnapshot().statistics.gamesPlayed).toBe(1);
    expect(after.store.getSnapshot().history).toHaveLength(1);
  });
});

describe('state binding', () => {
  it('rejects saving progress whose seed or options do not belong to the run', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('chosen-seed', 0));

    expect(store.saveRunState(run.runId, { ...createInitialState('plain-257', 0) })).toEqual({
      ok: false,
      reason: 'state-mismatch',
      persisted: false,
    });
    expect(store.saveRunState(run.runId, { ...createInitialState('chosen-seed', 1) })).toEqual({
      ok: false,
      reason: 'state-mismatch',
      persisted: false,
    });
    expect(store.getSnapshot().activeRun?.runId).toBe(run.runId);
    expect(store.getSnapshot().activeRun?.seed).toBe('chosen-seed');
    expect(store.getSnapshot().activeRun?.config).toBe(0);

    expect(store.saveRunState(run.runId, createInitialState('chosen-seed', 0))).toEqual({
      ok: true,
      persisted: true,
    });
  });

  it('rejects completing a state that does not belong to the run', () => {
    const { store } = createHarness();
    const run = expectStarted(store.startRunWithSeed('chosen-seed', 0));

    expect(store.completeRun(run.runId, winningState())).toEqual({
      ok: false,
      reason: 'state-mismatch',
    });
    expect(store.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(store.getSnapshot().activeRun?.runId).toBe(run.runId);
  });

  it('rejects mismatched state after reload as well', () => {
    const first = createHarness();
    const run = expectStarted(first.store.startRunWithSeed('chosen-seed', 0));
    const reloaded = createHarness({ storage: first.storage, idPrefix: 'reload' });
    expect(reloaded.store.saveRunState(run.runId, createInitialState('other-seed', 0))).toEqual({
      ok: false,
      reason: 'state-mismatch',
      persisted: false,
    });
    expect(reloaded.store.getSnapshot().activeRun?.seed).toBe('chosen-seed');
  });
});

describe('settings multi-tab merge', () => {
  it('merges a partial update over the latest shard instead of stale memory', () => {
    const storage = createMemoryStorage();
    const tabA = createHarness({ storage, idPrefix: 'tab-a' });
    const tabB = createHarness({ storage, idPrefix: 'tab-b' });

    expect(tabA.store.updateSettings({ locale: 'zh-Hans' })).toEqual({ ok: true, persisted: true });
    // tabB loaded before tabA wrote; its partial update must not drop the locale.
    expect(tabB.store.updateSettings({ reducedMotion: false })).toEqual({
      ok: true,
      persisted: true,
    });
    expect(tabB.store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: false });

    tabA.store.refresh();
    expect(tabA.store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: false });
    const reloaded = createHarness({ storage, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().settings).toEqual({
      locale: 'zh-Hans',
      reducedMotion: false,
    });
  });
});

describe('saved-data migrations', () => {
  const settingsV0 = JSON.stringify({
    schemaVersion: 0,
    data: { locale: 'zh-Hans', reducedMotion: null },
  });

  it('writes a migrated settings payload back at the current version', () => {
    const memory = createMemoryStorage({ [STORAGE_KEYS.settings]: settingsV0 });
    const store = createScoundrelStore({
      storage: memory,
      now: () => new Date(START_MS),
      migrations: { settings: { 0: (data) => data } },
    });

    expect(store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: null });
    expect(store.getSnapshot().warnings).toEqual([]);
    const raw: unknown = JSON.parse(memory.snapshot()[STORAGE_KEYS.settings] ?? '{}');
    expect(raw).toMatchObject({ schemaVersion: SCHEMA_VERSION });
  });

  it('warns when a migrated settings payload cannot be written back', () => {
    const memory = createMemoryStorage({ [STORAGE_KEYS.settings]: settingsV0 });
    const controls = createControllableStorage(memory);
    controls.setWriteFailure(true);

    const store = createScoundrelStore({
      storage: controls.storage,
      now: () => new Date(START_MS),
      migrations: { settings: { 0: (data) => data } },
    });

    expect(store.getSnapshot().settings).toEqual({ locale: 'zh-Hans', reducedMotion: null });
    expect(store.getSnapshot().warnings).toContainEqual({
      kind: 'write-failed',
      shard: 'settings',
    });
    expect(memory.snapshot()[STORAGE_KEYS.settings]).toBe(settingsV0);
  });

  it('loads a migrated run payload and warns when its rewrite fails', () => {
    const payload = createPersistedRun(
      'migrated-run',
      createInitialState('plain-257', 0),
      '2026-10-31T12:00:00.000Z',
      '2026-10-31T12:00:00.000Z',
    );
    const raw = JSON.stringify({ schemaVersion: 0, data: payload });
    const memory = createMemoryStorage({ [STORAGE_KEYS.run]: raw });
    const controls = createControllableStorage(memory);
    controls.setWriteFailure(true);

    const store = createScoundrelStore({
      storage: controls.storage,
      now: () => new Date(START_MS),
      migrations: { run: { 0: (data) => data } },
    });

    expect(store.getSnapshot().activeRun?.runId).toBe('migrated-run');
    expect(store.getSnapshot().warnings).toContainEqual({ kind: 'write-failed', shard: 'run' });
    expect(memory.snapshot()[STORAGE_KEYS.run]).toBe(raw);
  });
});

describe('storage events', () => {
  it('refreshes on saved-shard events, ignores unrelated keys, and unsubscribes on close', () => {
    const evented = createEventedStorage();
    let runs = 0;
    const makeStore = (prefix: string) =>
      createScoundrelStore({
        storage: evented.storage,
        now: () => new Date(START_MS),
        newRunId: () => `${prefix}-${String(++runs)}`,
        newSeed: () => `${prefix}-seed-${String(runs)}`,
      });
    const storeA = makeStore('tab-a');
    const storeB = makeStore('tab-b');

    const startedB = expectStarted(storeB.startRunWithSeed('from-b', 0));
    expect(storeA.getSnapshot().activeRun).toBeNull();

    evented.emit(STORAGE_KEYS.run);
    expect(storeA.getSnapshot().activeRun?.runId).toBe(startedB.runId);

    const beforeUnrelated = storeA.getSnapshot();
    evented.emit('unrelated:key');
    expect(storeA.getSnapshot()).toBe(beforeUnrelated);

    evented.emit(null);
    expect(storeA.getSnapshot()).not.toBe(beforeUnrelated);

    storeA.close();
    expect(evented.listenerCount()).toBe(1);
    const afterClose = storeA.getSnapshot();
    expectStarted(storeB.startRunWithSeed('after-close', 0));
    evented.emit(STORAGE_KEYS.run);
    expect(storeA.getSnapshot()).toBe(afterClose);
  });
});

describe('shared link fallback validation', () => {
  it('ignores an invalid fallback when the link names valid options', () => {
    const { store } = createHarness();
    const run = expectStarted(
      store.startFromSharedLink('#/play?seed=linked&config=3', 9 as RuleConfig),
    );
    expect(run.seed).toBe('linked');
    expect(run.config).toBe(3);
  });

  it('rejects a seed-only link when the selected options are invalid', () => {
    const { store } = createHarness();
    expect(store.startFromSharedLink('#/play?seed=linked', 9 as RuleConfig)).toEqual({
      ok: false,
      reason: 'invalid-config',
    });
    expect(store.getSnapshot().activeRun).toBeNull();
  });
});

describe('stats-write rollback', () => {
  it('rolls a replacement back when the abandoned loss cannot be recorded', () => {
    const memory = createMemoryStorage();
    const controls = createControllableStorage(memory);
    const first = createHarness({ storage: memory, storeStorage: controls.storage });
    const outgoing = expectStarted(first.store.startRunWithSeed('outgoing', 0));

    controls.failWritesFor([STORAGE_KEYS.stats]);
    expect(first.store.startRunWithSeed('incoming', 0)).toEqual({
      ok: false,
      reason: 'write-failed',
    });

    let snapshot = first.store.getSnapshot();
    expect(snapshot.activeRun?.runId).toBe(outgoing.runId);
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.warnings).toContainEqual({ kind: 'write-failed', shard: 'stats' });

    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun?.runId).toBe(outgoing.runId);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);

    controls.failWritesFor([]);
    const retry = first.store.startRunWithSeed('incoming', 0);
    if (!retry.ok) throw new Error('expected a successful retry');
    expect(retry.abandonedLossRecorded).toBe(true);
    snapshot = first.store.getSnapshot();
    expect(snapshot.statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(snapshot.activeRun?.seed).toBe('incoming');

    const after = createHarness({ storage: memory, idPrefix: 'after' });
    expect(after.store.getSnapshot().activeRun?.seed).toBe('incoming');
    expect(after.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });

  it('restores a discarded run when its abandonment cannot be recorded', () => {
    const memory = createMemoryStorage();
    const controls = createControllableStorage(memory);
    const harness = createHarness({ storage: memory, storeStorage: controls.storage });
    const run = expectStarted(harness.store.startRunWithSeed('plain-257', 0));

    controls.failWritesFor([STORAGE_KEYS.stats]);
    expect(harness.store.discardActiveRun()).toEqual({ ok: false, reason: 'write-failed' });
    expect(harness.store.getSnapshot().activeRun?.runId).toBe(run.runId);
    expect(harness.store.getSnapshot().statistics.gamesPlayed).toBe(0);

    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun?.runId).toBe(run.runId);
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);

    controls.failWritesFor([]);
    expect(harness.store.discardActiveRun()).toMatchObject({ ok: true, recordedAbandonment: true });
    expect(harness.store.getSnapshot().statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    const after = createHarness({ storage: memory, idPrefix: 'after' });
    expect(after.store.getSnapshot().activeRun).toBeNull();
    expect(after.store.getSnapshot().statistics.gamesPlayed).toBe(1);
  });
});

describe('dual storage failure (rollback write fails too)', () => {
  it('fails a replacement and restores in-memory stats when the compensating run write fails', () => {
    const memory = createMemoryStorage();
    const scripted = createScriptedStorage(memory, {
      runWritesBeforeFailure: 2,
      failStatsWrites: true,
      failRemoves: false,
    });
    const harness = createHarness({ storage: memory, storeStorage: scripted });
    expectStarted(harness.store.startRunWithSeed('outgoing', 0));

    // Replacement run write succeeds (2nd run write), stats write fails, and the
    // compensating old-run write fails (3rd run write).
    expect(harness.store.startRunWithSeed('incoming', 0)).toEqual({
      ok: false,
      reason: 'write-failed',
    });

    const snapshot = harness.store.getSnapshot();
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.statistics.losses).toBe(0);
    expect(snapshot.activeRun?.seed).toBe('incoming');
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        { kind: 'write-failed', shard: 'stats' },
        { kind: 'write-failed', shard: 'run' },
      ]),
    );

    // Documented best-effort reload behavior: the already-persisted replacement
    // survives, but the outgoing loss could not be counted.
    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun?.seed).toBe('incoming');
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(reloaded.store.getSnapshot().statistics.losses).toBe(0);
  });

  it('fails a discard and restores in-memory stats when the compensating run write fails', () => {
    const memory = createMemoryStorage();
    const scripted = createScriptedStorage(memory, {
      runWritesBeforeFailure: 1,
      failStatsWrites: true,
      failRemoves: false,
    });
    const harness = createHarness({ storage: memory, storeStorage: scripted });
    expectStarted(harness.store.startRunWithSeed('plain-257', 0));

    // Removal succeeds, stats write fails, and the compensating run write fails.
    expect(harness.store.discardActiveRun()).toEqual({ ok: false, reason: 'write-failed' });

    const snapshot = harness.store.getSnapshot();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.statistics.gamesPlayed).toBe(0);
    expect(snapshot.statistics.losses).toBe(0);
    expect(snapshot.warnings).toEqual(
      expect.arrayContaining([
        { kind: 'write-failed', shard: 'stats' },
        { kind: 'write-failed', shard: 'run' },
      ]),
    );

    // Documented best-effort reload behavior: the run stays removed and the loss
    // was not counted, so the session only reports the failure.
    const reloaded = createHarness({ storage: memory, idPrefix: 'reload' });
    expect(reloaded.store.getSnapshot().activeRun).toBeNull();
    expect(reloaded.store.getSnapshot().statistics.gamesPlayed).toBe(0);
    expect(reloaded.store.getSnapshot().statistics.losses).toBe(0);
  });
});
