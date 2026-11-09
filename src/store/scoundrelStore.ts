/**
 * Typed persisted store for Phase 4 (REQ-001, REQ-008, REQ-009, REQ-010,
 * REQ-013, REQ-014).
 *
 * The store owns saved-data boundaries and statistics. It deliberately does
 * not own React state: the interface keeps its transient session in
 * `gameSession.ts` and calls this store to persist actions, restore a run, and
 * record outcomes. `EventTarget`-style `subscribe` plus a stable
 * `getSnapshot` make the API usable with `useSyncExternalStore`.
 *
 * Invariants enforced here:
 * - one saved run at a time; a completed result stays until replaced;
 * - statistics change only through `recordOutcome`, deduplicated by run id so
 *   reloads and second tabs cannot count a run twice;
 * - replacing or discarding an unfinished run records exactly one abandoned
 *   loss scored from the remaining draw pile;
 * - invalid seeds, settings, or links never mutate the saved run or stats;
 * - unreadable shards are preserved and reported instead of overwritten.
 */
import {
  calculateLossScore,
  createInitialState,
  isRuleConfig,
  parseSeed,
  type GameState,
  type RuleConfig,
  type RunResult,
} from '../engine';
import type { LocalePreference } from '../i18n';
import { createPersistedRun, isGameState, isPersistedRun, type PersistedRun } from './activeRun';
import type { HistoryEntry } from './history';
import {
  SHARD_MIGRATIONS,
  STORAGE_KEYS,
  readStoredShard,
  removeStoredShard,
  writeStoredShard,
  type Migrations,
  type StorageShard,
} from './persistence';
import { newRunSeed } from './seed';
import { DEFAULT_SETTINGS, isStoredSettings, mergeSettings, type StoredSettings } from './settings';
import { buildReplayHash, buildReplayUrl, parseReplayLink } from './share';
import {
  EMPTY_STATS,
  isStoredStats,
  recordOutcome,
  winRatePercent,
  type Statistics,
  type StoredStats,
} from './stats';
import { createStoreStorage, type StoreStorage } from './storage';

export type ShardName = StorageShard;

export interface RecoveryIssue {
  readonly shard: ShardName;
  readonly status: 'corrupt' | 'unsupported-version';
  readonly version?: number;
}

export type StoreWarning =
  | { readonly kind: 'storage-unavailable' }
  | { readonly kind: 'unreadable-data'; readonly issue: RecoveryIssue }
  | { readonly kind: 'write-failed'; readonly shard: ShardName };

/** A resumable unfinished run. */
export interface ActiveRunView {
  readonly runId: string;
  readonly seed: string;
  readonly config: RuleConfig;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly state: GameState;
}

/** A finished run kept for reloading the result screen. */
export interface CompletedResultView {
  readonly runId: string;
  readonly seed: string;
  readonly config: RuleConfig;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string;
  readonly state: GameState;
  readonly result: RunResult;
}

export interface TitleState {
  /** Continue appears only for an unfinished saved run (REQ-001). */
  readonly canContinue: boolean;
  /** Discard Run appears only for an unfinished saved run. */
  readonly canDiscard: boolean;
  /** Reloading a finished run restores its result screen (REQ-009). */
  readonly hasCompletedResult: boolean;
}

/** The typed, read-only view the Phase 4 interface renders. */
export interface StoreSnapshot {
  readonly activeRun: ActiveRunView | null;
  readonly completedResult: CompletedResultView | null;
  readonly statistics: Statistics;
  /** Whole-number percentage, or null before any run is recorded. */
  readonly winRatePercent: number | null;
  readonly history: readonly HistoryEntry[];
  readonly settings: StoredSettings;
  readonly title: TitleState;
  readonly warnings: readonly StoreWarning[];
  readonly recovery: readonly RecoveryIssue[];
  readonly storageAvailable: boolean;
}

export interface StartedRun {
  readonly runId: string;
  readonly seed: string;
  readonly config: RuleConfig;
  readonly startedAt: string;
  readonly state: GameState;
  /** False when storage is unavailable or unreadable; the run works for this session. */
  readonly persisted: boolean;
}

export type StartRunFailureReason =
  | 'invalid-seed'
  | 'invalid-config'
  | 'invalid-link'
  | 'history-run-missing'
  | 'seed-unavailable'
  /** The run shard could not be written, so the outgoing run was left intact. */
  | 'write-failed';

export type StartRunResult =
  | {
      readonly ok: true;
      readonly run: StartedRun;
      /** Run replaced by this attempt, if any. */
      readonly replacedRunId: string | null;
      /** True when the replaced run was unfinished and recorded as abandoned. */
      readonly abandonedLossRecorded: boolean;
    }
  | { readonly ok: false; readonly reason: StartRunFailureReason };

export type SaveRunFailureReason =
  | 'invalid-state'
  | 'run-replaced'
  | 'run-completed'
  /** The state's seed or options do not belong to the saved run. */
  | 'state-mismatch';

export type SaveRunResult =
  | { readonly ok: true; readonly persisted: boolean }
  | { readonly ok: false; readonly reason: SaveRunFailureReason; readonly persisted: false };

export type CompleteRunFailureReason =
  | 'invalid-state'
  | 'run-active'
  | 'run-replaced'
  /** The state's seed or options do not belong to the saved run. */
  | 'state-mismatch';

export type CompleteRunResult =
  | {
      readonly ok: true;
      readonly persisted: boolean;
      /** False when the outcome was already in the ledger. */
      readonly recorded: boolean;
      readonly result: RunResult;
      readonly alreadyCompleted: boolean;
    }
  | { readonly ok: false; readonly reason: CompleteRunFailureReason };

export type DiscardRunFailureReason = 'no-run' | 'unreadable-run' | 'write-failed';

export type DiscardRunResult =
  | {
      readonly ok: true;
      readonly discardedRunId: string;
      readonly recordedAbandonment: boolean;
      readonly persisted: boolean;
    }
  | { readonly ok: false; readonly reason: DiscardRunFailureReason };

export type SaveSettingsResult =
  | { readonly ok: true; readonly persisted: boolean }
  | { readonly ok: false; readonly reason: 'invalid-settings' };

export interface ScoundrelStore {
  /** Stable snapshot for `useSyncExternalStore`. */
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;
  /** Re-read all shards (used on cross-tab storage events and window focus). */
  refresh(): void;
  /** Detach listeners; the store remains usable for the session. */
  close(): void;

  startNewRun(config: RuleConfig): StartRunResult;
  startRunWithSeed(seedInput: string, config: RuleConfig): StartRunResult;
  /** Parse `#/play?seed=...&config=...`; invalid links change nothing. */
  startFromSharedLink(input: string, fallbackConfig: RuleConfig): StartRunResult;
  replayHistoryEntry(runId: string): StartRunResult;

  /** Persist the current engine state after each applied action. */
  saveRunState(runId: string, state: GameState): SaveRunResult;
  /** Persist the final result and record its outcome exactly once. */
  completeRun(runId: string, state: GameState): CompleteRunResult;
  /** Explicit discard: records an abandoned loss for an unfinished run. */
  discardActiveRun(): DiscardRunResult;

  saveSettings(settings: StoredSettings): SaveSettingsResult;
  updateSettings(patch: {
    readonly locale?: LocalePreference;
    readonly reducedMotion?: boolean | null;
  }): SaveSettingsResult;

  /** Build the in-app copy link for a completed run (`#/play?...`). */
  buildReplayLink(seed: string, config: RuleConfig): string;
  /** Build an absolute replay URL from a base such as `location.origin + location.pathname`. */
  buildReplayUrl(seed: string, config: RuleConfig, baseUrl: string): string;

  /** REQ-010 recovery actions; each returns false when the raw payload cannot be removed. */
  discardUnreadableRun(): boolean;
  resetUnreadableStats(): boolean;
  resetUnreadableSettings(): boolean;
}

export interface ScoundrelStoreOptions {
  readonly storage?: StoreStorage;
  /** Injected clock for deterministic tests and payload timestamps (UTC ISO). */
  readonly now?: () => Date;
  readonly newRunId?: () => string;
  readonly newSeed?: () => string;
  /** Default preference values when no readable settings are stored. */
  readonly defaultSettings?: StoredSettings;
  /**
   * Test seam: override the migration registry per shard to exercise saved-data
   * upgrades before a production migration exists. Defaults to `SHARD_MIGRATIONS`.
   */
  readonly migrations?: Partial<Record<ShardName, Migrations>>;
}

function defaultRunId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    let id = 'run-';
    for (const byte of bytes) id += byte.toString(16).padStart(2, '0');
    return id;
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ShardLoad<T> {
  readonly data: T;
  readonly issue: RecoveryIssue | null;
}

function issueFromRead(
  shard: ShardName,
  result:
    | { readonly status: 'corrupt' }
    | { readonly status: 'unsupported-version'; readonly version: number },
): RecoveryIssue {
  if (result.status === 'unsupported-version') {
    return { shard, status: 'unsupported-version', version: result.version };
  }
  return { shard, status: 'corrupt' };
}

function completedHistoryEntry(run: PersistedRun): HistoryEntry {
  const result = run.state.result;
  if (result === null) throw new Error('Cannot record an outcome without a final result');
  return {
    runId: run.runId,
    seed: run.seed,
    config: run.config,
    outcome: result.outcome,
    abandoned: false,
    score: result.score,
    health: result.health,
    roomsExplored: run.state.highlights.roomsExplored,
    roomsCleared: run.state.highlights.roomsCleared,
    monstersDefeated: run.state.highlights.monstersDefeated,
    potionsWasted: run.state.highlights.potionsWasted,
    finishedAt: run.completedAt ?? run.updatedAt,
  };
}

function abandonedHistoryEntry(run: PersistedRun, finishedAt: string): HistoryEntry {
  return {
    runId: run.runId,
    seed: run.seed,
    config: run.config,
    outcome: 'lost',
    abandoned: true,
    score: calculateLossScore(run.state.dungeon),
    health: run.state.health,
    roomsExplored: run.state.highlights.roomsExplored,
    roomsCleared: run.state.highlights.roomsCleared,
    monstersDefeated: run.state.highlights.monstersDefeated,
    potionsWasted: run.state.highlights.potionsWasted,
    finishedAt,
  };
}

/**
 * Create the persisted store. All browser dependencies are injectable so the
 * whole saved-data policy is unit-testable without a real `localStorage`.
 */
export function createScoundrelStore(options: ScoundrelStoreOptions = {}): ScoundrelStore {
  const storage = options.storage ?? createStoreStorage();
  const now = options.now ?? (() => new Date());
  const newRunId = options.newRunId ?? defaultRunId;
  const newSeed = options.newSeed ?? newRunSeed;
  const defaultSettings = options.defaultSettings ?? DEFAULT_SETTINGS;

  const listeners = new Set<() => void>();
  let storageReadable = storage.available;
  const writeFailures = new Set<ShardName>();

  let settingsValue: StoredSettings = defaultSettings;
  let settingsIssue: RecoveryIssue | null = null;
  let settingsSessionOnly = false;

  let statsValue: StoredStats = EMPTY_STATS;
  let statsIssue: RecoveryIssue | null = null;
  let statsSessionOnly = false;

  let runValue: PersistedRun | null = null;
  let runIssue: RecoveryIssue | null = null;
  let runSessionOnly = false;

  function shardMigrations(shard: ShardName): Migrations {
    return options.migrations?.[shard] ?? SHARD_MIGRATIONS[shard];
  }

  /**
   * A migrated payload is valid in memory, but only counts as saved once it is
   * written back at the current version. Surface a failed rewrite through the
   * normal write-failure warning path.
   */
  function persistMigratedShard(shard: ShardName, data: unknown): void {
    if (writeStoredShard(storage, STORAGE_KEYS[shard], data).status === 'ok') {
      writeFailures.delete(shard);
    } else {
      writeFailures.add(shard);
    }
  }

  function loadSettingsShard(): ShardLoad<StoredSettings> {
    const result = readStoredShard(storage, STORAGE_KEYS.settings, {
      validate: isStoredSettings,
      migrations: shardMigrations('settings'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) {
          persistMigratedShard('settings', result.data);
        }
        return { data: result.data, issue: null };
      case 'missing':
        return { data: defaultSettings, issue: null };
      case 'unavailable':
        storageReadable = false;
        return { data: defaultSettings, issue: null };
      case 'corrupt':
      case 'unsupported-version':
        return { data: defaultSettings, issue: issueFromRead('settings', result) };
    }
  }

  function loadStatsShard(): ShardLoad<StoredStats> {
    const result = readStoredShard(storage, STORAGE_KEYS.stats, {
      validate: isStoredStats,
      migrations: shardMigrations('stats'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) {
          persistMigratedShard('stats', result.data);
        }
        return { data: result.data, issue: null };
      case 'missing':
        return { data: EMPTY_STATS, issue: null };
      case 'unavailable':
        storageReadable = false;
        return { data: EMPTY_STATS, issue: null };
      case 'corrupt':
      case 'unsupported-version':
        return { data: EMPTY_STATS, issue: issueFromRead('stats', result) };
    }
  }

  function loadRunShard(): ShardLoad<PersistedRun | null> {
    const result = readStoredShard(storage, STORAGE_KEYS.run, {
      validate: isPersistedRun,
      migrations: shardMigrations('run'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) {
          persistMigratedShard('run', result.data);
        }
        return { data: result.data, issue: null };
      case 'missing':
        return { data: null, issue: null };
      case 'unavailable':
        storageReadable = false;
        return { data: null, issue: null };
      case 'corrupt':
      case 'unsupported-version':
        return { data: null, issue: issueFromRead('run', result) };
    }
  }

  function persistSettings(next: StoredSettings): boolean {
    if (settingsIssue !== null) return false;
    const result = writeStoredShard(storage, STORAGE_KEYS.settings, next);
    if (result.status === 'ok') {
      writeFailures.delete('settings');
      settingsSessionOnly = false;
      return true;
    }
    writeFailures.add('settings');
    settingsSessionOnly = true;
    return false;
  }

  function persistStats(next: StoredStats): boolean {
    if (statsIssue !== null) return false;
    const result = writeStoredShard(storage, STORAGE_KEYS.stats, next);
    if (result.status === 'ok') {
      writeFailures.delete('stats');
      statsSessionOnly = false;
      return true;
    }
    writeFailures.add('stats');
    statsSessionOnly = true;
    return false;
  }

  function persistRun(next: PersistedRun): boolean {
    if (runIssue !== null) return false;
    const result = writeStoredShard(storage, STORAGE_KEYS.run, next);
    if (result.status === 'ok') {
      writeFailures.delete('run');
      runSessionOnly = false;
      return true;
    }
    writeFailures.add('run');
    runSessionOnly = true;
    return false;
  }

  /** Re-read the latest stats shard before applying an outcome (multi-tab safety). */
  function readStatsForMutation(): { stats: StoredStats; readable: boolean } {
    if (statsIssue !== null) return { stats: statsValue, readable: false };
    const result = readStoredShard(storage, STORAGE_KEYS.stats, {
      validate: isStoredStats,
      migrations: shardMigrations('stats'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) persistMigratedShard('stats', result.data);
        statsValue = result.data;
        return { stats: result.data, readable: true };
      case 'missing':
        statsValue = statsSessionOnly ? statsValue : EMPTY_STATS;
        return { stats: statsValue, readable: true };
      case 'unavailable':
        storageReadable = false;
        return { stats: statsValue, readable: false };
      case 'corrupt':
      case 'unsupported-version':
        statsIssue = issueFromRead('stats', result);
        return { stats: statsValue, readable: false };
    }
  }

  interface RecordOutcomeResult {
    readonly recorded: boolean;
    readonly persisted: boolean;
  }

  function recordRunOutcome(entry: HistoryEntry): RecordOutcomeResult {
    const source = readStatsForMutation();
    const result = recordOutcome(source.stats, entry);
    statsValue = result.next;
    if (!result.recorded) return { recorded: false, persisted: source.readable };
    if (!source.readable) {
      statsSessionOnly = true;
      return { recorded: true, persisted: false };
    }
    return { recorded: true, persisted: persistStats(result.next) };
  }

  interface StatsRollbackSnapshot {
    readonly stats: StoredStats;
    readonly sessionOnly: boolean;
  }

  /**
   * Record an outcome, and if the stats shard is writable but the write fails,
   * roll the run shard back so reloading cannot resurrect a run whose loss was
   * never durably counted. A genuinely unreadable stats shard keeps the
   * session-only path (REQ-010), so it does not trigger a rollback.
   */
  interface OutcomeRollbackResult {
    readonly outcome: RecordOutcomeResult;
    /** True when the outcome was not durably recorded and callers must fail. */
    readonly rolledBack: boolean;
    /** True when restoring the run shard failed as well (best effort exhausted). */
    readonly rollbackFailed: boolean;
  }

  function recordOutcomeWithRollback(
    entry: HistoryEntry,
    restoreRun: () => boolean,
  ): OutcomeRollbackResult {
    const statsWereUsable = statsIssue === null && !statsSessionOnly && storageReadable;
    const snapshot: StatsRollbackSnapshot = { stats: statsValue, sessionOnly: statsSessionOnly };
    const outcome = recordRunOutcome(entry);
    if (outcome.persisted || !statsWereUsable || statsIssue !== null) {
      return { outcome, rolledBack: false, rollbackFailed: false };
    }

    // The outcome write failed while stats were writable. Restore the in-memory
    // ledger whatever happens next, so this session never keeps a loss that
    // storage may not back.
    const runRestored = restoreRun();
    statsValue = snapshot.stats;
    statsSessionOnly = snapshot.sessionOnly;
    if (!runRestored) {
      // Both the outcome write and the compensating run write failed. The
      // caller must still report a failure and the warning surfaces both shards;
      // reload behavior in this double-failure window is documented as
      // best-effort in README.md.
      writeFailures.add('run');
      return { outcome, rolledBack: true, rollbackFailed: true };
    }
    return { outcome, rolledBack: true, rollbackFailed: false };
  }

  /** Re-read the latest run shard before a mutation (multi-tab safety). */
  function readLatestRun(): PersistedRun | null {
    if (runIssue !== null) return null;
    const result = readStoredShard(storage, STORAGE_KEYS.run, {
      validate: isPersistedRun,
      migrations: shardMigrations('run'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) persistMigratedShard('run', result.data);
        runValue = result.data;
        return result.data;
      case 'missing':
        runValue = null;
        return null;
      case 'unavailable':
        storageReadable = false;
        return runValue;
      case 'corrupt':
      case 'unsupported-version':
        runIssue = issueFromRead('run', result);
        return null;
    }
  }

  /** Record a completed outcome that has not reached the stats shard yet. */
  function healCompletedRun(run: PersistedRun): RecordOutcomeResult | null {
    if (run.state.status === 'playing' || run.outcomeRecorded) return null;
    const outcome = recordRunOutcome(completedHistoryEntry(run));
    if (outcome.persisted) {
      runValue = { ...run, outcomeRecorded: true };
      persistRun(runValue);
    }
    return outcome;
  }

  function loadAll(): void {
    storageReadable = storage.available;
    const settings = loadSettingsShard();
    if (!settingsSessionOnly) settingsValue = settings.data;
    settingsIssue = settings.issue;

    const stats = loadStatsShard();
    if (!statsSessionOnly) statsValue = stats.data;
    statsIssue = stats.issue;

    const run = loadRunShard();
    if (!runSessionOnly) runValue = run.data;
    runIssue = run.issue;

    if (runValue !== null) healCompletedRun(runValue);
  }

  function buildSnapshot(): StoreSnapshot {
    const activeRun: ActiveRunView | null =
      runValue !== null && runValue.state.status === 'playing' ? { ...runValue } : null;

    const completedResult: CompletedResultView | null =
      runValue !== null && runValue.state.status !== 'playing' && runValue.state.result !== null
        ? {
            runId: runValue.runId,
            seed: runValue.seed,
            config: runValue.config,
            startedAt: runValue.startedAt,
            updatedAt: runValue.updatedAt,
            completedAt: runValue.completedAt ?? runValue.updatedAt,
            state: runValue.state,
            result: runValue.state.result,
          }
        : null;

    const warnings: StoreWarning[] = [];
    if (!storageReadable) warnings.push({ kind: 'storage-unavailable' });
    for (const issue of [runIssue, statsIssue, settingsIssue]) {
      if (issue !== null) warnings.push({ kind: 'unreadable-data', issue });
    }
    if (storageReadable) {
      for (const shard of writeFailures) warnings.push({ kind: 'write-failed', shard });
    }

    const recovery: RecoveryIssue[] = [];
    for (const issue of [runIssue, statsIssue, settingsIssue]) {
      if (issue !== null) recovery.push(issue);
    }

    return {
      activeRun,
      completedResult,
      statistics: statsValue.statistics,
      winRatePercent: winRatePercent(statsValue.statistics),
      history: statsValue.history,
      settings: settingsValue,
      title: {
        canContinue: activeRun !== null,
        canDiscard: activeRun !== null,
        hasCompletedResult: completedResult !== null,
      },
      warnings,
      recovery,
      storageAvailable: storageReadable,
    };
  }

  let snapshot: StoreSnapshot = buildSnapshot();

  function notify(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  function startResolvedRun(seed: string, config: RuleConfig): StartRunResult {
    let state: GameState;
    try {
      state = createInitialState(seed, config);
    } catch {
      return { ok: false, reason: 'invalid-seed' };
    }

    const latest = readLatestRun();
    const replacedRunId = latest?.runId ?? null;
    if (latest !== null && latest.state.status !== 'playing') {
      // Replace a finished result without another loss, but make sure its
      // outcome reaches the stats shard before the payload is overwritten.
      healCompletedRun(latest);
    }

    const startedAt = now().toISOString();
    const runId = newRunId();
    const nextRun = createPersistedRun(runId, state, startedAt, startedAt);

    // Storage unavailable or the run shard unreadable: keep playing for this
    // session without touching the saved payload or recording an abandonment
    // that storage cannot back up (REQ-010).
    if (!storageReadable || runIssue !== null) {
      runValue = nextRun;
      runSessionOnly = true;
      notify();
      return {
        ok: true,
        run: { runId, seed, config, startedAt, state, persisted: false },
        replacedRunId,
        abandonedLossRecorded: false,
      };
    }

    // Persist the replacement first. Only when it is durable can the outgoing
    // run be considered replaced; a failed write leaves the old run resumable
    // and records no abandonment (REQ-001 / REQ-009).
    if (!persistRun(nextRun)) {
      notify();
      return { ok: false, reason: 'write-failed' };
    }
    runValue = nextRun;

    let abandonedLossRecorded = false;
    if (latest !== null && latest.state.status === 'playing') {
      const recorded = recordOutcomeWithRollback(
        abandonedHistoryEntry(latest, now().toISOString()),
        () => persistRun(latest),
      );
      if (recorded.rolledBack) {
        // Stats could not durably count the loss. If the compensating write
        // restored the outgoing run, memory shows it; if that write also failed,
        // memory mirrors storage and keeps the already-persisted replacement.
        runValue = recorded.rollbackFailed ? nextRun : latest;
        notify();
        return { ok: false, reason: 'write-failed' };
      }
      abandonedLossRecorded = recorded.outcome.recorded;
    }
    notify();
    return {
      ok: true,
      run: { runId, seed, config, startedAt, state, persisted: true },
      replacedRunId,
      abandonedLossRecorded,
    };
  }

  function startNewRun(config: RuleConfig): StartRunResult {
    if (!isRuleConfig(config)) return { ok: false, reason: 'invalid-config' };
    let seed: string;
    try {
      seed = newSeed();
    } catch {
      return { ok: false, reason: 'seed-unavailable' };
    }
    const normalized = parseSeed(seed);
    if (normalized === null) return { ok: false, reason: 'invalid-seed' };
    return startResolvedRun(normalized, config);
  }

  function startRunWithSeed(seedInput: string, config: RuleConfig): StartRunResult {
    if (!isRuleConfig(config)) return { ok: false, reason: 'invalid-config' };
    const seed = parseSeed(seedInput);
    if (seed === null) return { ok: false, reason: 'invalid-seed' };
    return startResolvedRun(seed, config);
  }

  function startFromSharedLink(input: string, fallbackConfig: RuleConfig): StartRunResult {
    const parsed = parseReplayLink(input, fallbackConfig);
    if (!parsed.ok) {
      if (parsed.reason === 'invalid-seed') return { ok: false, reason: 'invalid-seed' };
      if (parsed.reason === 'invalid-config') return { ok: false, reason: 'invalid-config' };
      return { ok: false, reason: 'invalid-link' };
    }
    // The caller's selected options only matter when the link omits config.
    if (!isRuleConfig(parsed.config)) return { ok: false, reason: 'invalid-config' };
    return startResolvedRun(parsed.seed, parsed.config);
  }

  function replayHistoryEntry(runId: string): StartRunResult {
    const entry = statsValue.history.find((candidate) => candidate.runId === runId);
    if (entry === undefined) return { ok: false, reason: 'history-run-missing' };
    return startResolvedRun(entry.seed, entry.config);
  }

  function saveRunState(runId: string, state: GameState): SaveRunResult {
    if (!isGameState(state)) return { ok: false, reason: 'invalid-state', persisted: false };
    if (state.status !== 'playing') return { ok: false, reason: 'run-completed', persisted: false };

    const knownRun = runValue;
    const latest = readLatestRun();
    if (latest !== null && latest.runId !== runId) {
      notify();
      return { ok: false, reason: 'run-replaced', persisted: false };
    }
    if (latest !== null && latest.state.status !== 'playing') {
      notify();
      return { ok: false, reason: 'run-completed', persisted: false };
    }
    // Another tab discarded (or abandoned) this run: do not resurrect it from a
    // stale save. Its abandonment was already recorded by the tab that removed it.
    if (
      latest === null &&
      knownRun !== null &&
      knownRun.runId === runId &&
      !runSessionOnly &&
      runIssue === null &&
      storageReadable
    ) {
      notify();
      return { ok: false, reason: 'run-replaced', persisted: false };
    }

    const expected = latest ?? (knownRun !== null && knownRun.runId === runId ? knownRun : null);
    if (expected !== null && (state.seed !== expected.seed || state.config !== expected.config)) {
      notify();
      return { ok: false, reason: 'state-mismatch', persisted: false };
    }

    const startedAt = latest?.startedAt ?? now().toISOString();
    const nextRun = createPersistedRun(runId, state, startedAt, now().toISOString());
    runValue = nextRun;
    const persisted = persistRun(nextRun);
    notify();
    return { ok: true, persisted };
  }

  function completeRun(runId: string, state: GameState): CompleteRunResult {
    if (!isGameState(state)) return { ok: false, reason: 'invalid-state' };
    if (state.status === 'playing' || state.result === null) {
      return { ok: false, reason: 'run-active' };
    }

    const knownRun = runValue;
    const latest = readLatestRun();
    if (latest !== null && latest.runId !== runId) {
      notify();
      return { ok: false, reason: 'run-replaced' };
    }

    const expected = latest ?? (knownRun !== null && knownRun.runId === runId ? knownRun : null);
    if (expected !== null && (state.seed !== expected.seed || state.config !== expected.config)) {
      notify();
      return { ok: false, reason: 'state-mismatch' };
    }

    if (latest !== null && latest.state.status !== 'playing') {
      // A stale tab (or repeated reload) finished an already-completed run.
      const healed = healCompletedRun(latest);
      // Another tab may have recorded the outcome already; sync the ledger so
      // this tab's snapshot reflects it.
      if (healed === null) readStatsForMutation();
      const result = latest.state.result;
      if (result === null) return { ok: false, reason: 'invalid-state' };
      notify();
      return {
        ok: true,
        persisted: runValue?.outcomeRecorded === true,
        recorded: healed?.recorded ?? false,
        result,
        alreadyCompleted: true,
      };
    }

    const sessionOnly =
      latest === null && (runSessionOnly || !storageReadable || runIssue !== null);
    if (latest === null && !sessionOnly) {
      // Another tab discarded or replaced this run; its outcome is already
      // recorded there, and this tab must not write over the newer run.
      return { ok: false, reason: 'run-replaced' };
    }

    const completedAt = now().toISOString();
    const completedRun: PersistedRun = {
      runId,
      seed: state.seed,
      config: state.config,
      startedAt: latest?.startedAt ?? runValue?.startedAt ?? completedAt,
      updatedAt: completedAt,
      completedAt,
      outcomeRecorded: false,
      state,
    };
    runValue = completedRun;
    const persisted = persistRun(completedRun);

    const outcome = recordRunOutcome(completedHistoryEntry(completedRun));
    if (outcome.persisted) {
      runValue = { ...completedRun, outcomeRecorded: true };
      persistRun(runValue);
    }
    notify();

    const result = completedRun.state.result;
    if (result === null) return { ok: false, reason: 'invalid-state' };
    return {
      ok: true,
      persisted,
      recorded: outcome.recorded,
      result,
      alreadyCompleted: false,
    };
  }

  function discardActiveRun(): DiscardRunResult {
    if (runIssue !== null) return { ok: false, reason: 'unreadable-run' };
    const latest = readLatestRun();
    if (latest === null) return { ok: false, reason: 'no-run' };
    if (!storageReadable) {
      // Cannot remove durable data: keep the run resumable rather than report a
      // discard whose removal silently failed.
      return { ok: false, reason: 'write-failed' };
    }

    // Remove first. Abandonment is recorded only once storage confirms the run is
    // gone, so a failed removal leaves the run resumable with zero losses.
    const removed = removeStoredShard(storage, STORAGE_KEYS.run);
    if (removed.status !== 'ok') {
      writeFailures.add('run');
      notify();
      return { ok: false, reason: 'write-failed' };
    }
    runValue = null;
    runSessionOnly = false;

    let recordedAbandonment = false;
    if (latest.state.status === 'playing') {
      const recorded = recordOutcomeWithRollback(
        abandonedHistoryEntry(latest, now().toISOString()),
        () => persistRun(latest),
      );
      if (recorded.rolledBack) {
        // If the compensating write failed, the shard stays removed in storage
        // and memory must not resurrect it.
        runValue = recorded.rollbackFailed ? null : latest;
        notify();
        return { ok: false, reason: 'write-failed' };
      }
      recordedAbandonment = recorded.outcome.recorded;
    } else if (!latest.outcomeRecorded) {
      // The shard is already gone, so record the pending result without
      // rewriting a completed payload that would resurrect the discarded result.
      const recorded = recordOutcomeWithRollback(completedHistoryEntry(latest), () =>
        persistRun(latest),
      );
      if (recorded.rolledBack) {
        runValue = latest;
        notify();
        return { ok: false, reason: 'write-failed' };
      }
    }
    notify();
    return { ok: true, discardedRunId: latest.runId, recordedAbandonment, persisted: true };
  }

  function saveSettings(settings: StoredSettings): SaveSettingsResult {
    if (!isStoredSettings(settings)) return { ok: false, reason: 'invalid-settings' };
    settingsValue = settings;
    const persisted = persistSettings(settings);
    notify();
    return { ok: true, persisted };
  }

  /** Re-read the latest settings shard before a partial merge (multi-tab safety). */
  function readSettingsForMutation(): StoredSettings {
    if (settingsIssue !== null) return settingsValue;
    const result = readStoredShard(storage, STORAGE_KEYS.settings, {
      validate: isStoredSettings,
      migrations: shardMigrations('settings'),
    });
    switch (result.status) {
      case 'ok':
        if (result.migratedFrom !== undefined) persistMigratedShard('settings', result.data);
        settingsValue = result.data;
        return result.data;
      case 'missing':
        settingsValue = settingsSessionOnly ? settingsValue : defaultSettings;
        return settingsValue;
      case 'unavailable':
        storageReadable = false;
        return settingsValue;
      case 'corrupt':
      case 'unsupported-version':
        settingsIssue = issueFromRead('settings', result);
        return settingsValue;
    }
  }

  function updateSettings(patch: {
    readonly locale?: LocalePreference;
    readonly reducedMotion?: boolean | null;
  }): SaveSettingsResult {
    const current = readSettingsForMutation();
    return saveSettings(mergeSettings(current, patch));
  }

  function discardUnreadableRun(): boolean {
    if (runIssue === null) return false;
    if (removeStoredShard(storage, STORAGE_KEYS.run).status !== 'ok') return false;
    runIssue = null;
    runValue = null;
    runSessionOnly = false;
    notify();
    return true;
  }

  function resetUnreadableStats(): boolean {
    if (statsIssue === null) return false;
    if (removeStoredShard(storage, STORAGE_KEYS.stats).status !== 'ok') return false;
    statsIssue = null;
    statsValue = EMPTY_STATS;
    statsSessionOnly = false;
    writeFailures.delete('stats');
    notify();
    return true;
  }

  function resetUnreadableSettings(): boolean {
    if (settingsIssue === null) return false;
    if (removeStoredShard(storage, STORAGE_KEYS.settings).status !== 'ok') return false;
    settingsIssue = null;
    settingsValue = defaultSettings;
    settingsSessionOnly = false;
    writeFailures.delete('settings');
    notify();
    return true;
  }

  function refresh(): void {
    loadAll();
    notify();
  }

  function close(): void {
    listeners.clear();
    unsubscribeStorage();
  }

  const unsubscribeStorage = storage.subscribe((key) => {
    if (
      key === null ||
      key === STORAGE_KEYS.run ||
      key === STORAGE_KEYS.stats ||
      key === STORAGE_KEYS.settings
    ) {
      refresh();
    }
  });

  loadAll();
  snapshot = buildSnapshot();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    close,
    startNewRun,
    startRunWithSeed,
    startFromSharedLink,
    replayHistoryEntry,
    saveRunState,
    completeRun,
    discardActiveRun,
    saveSettings,
    updateSettings,
    buildReplayLink: (seed, config) => buildReplayHash(seed, config),
    buildReplayUrl: (seed, config, baseUrl) => buildReplayUrl(seed, config, baseUrl),
    discardUnreadableRun,
    resetUnreadableStats,
    resetUnreadableSettings,
  };
}
