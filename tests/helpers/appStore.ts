/**
 * Store fixtures for the Phase 4 interface tests.
 *
 * The store owns persistence; these helpers build real stores over memory
 * storage (or deliberately broken storage) and record real engine runs so the
 * RTL tests exercise the same code paths the browser does.
 */
import {
  DEFAULT_RULE_CONFIG,
  applyAction,
  type GameState,
  type RuleConfig,
} from '../../src/engine';
import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  createScoundrelStore,
  type ScoundrelStore,
  type ScoundrelStoreOptions,
} from '../../src/store';
import {
  createMemoryStorage,
  createUnavailableStorage,
  type StorageWrite,
  type StoreStorage,
} from '../../src/store/storage';
import { doomedPolicy, toAction } from './game';

export { createMemoryStorage, createUnavailableStorage };

export interface MemoryStoreFixture {
  storage: StoreStorage;
  store: ScoundrelStore;
}

/** A store over a fresh in-memory shard set. */
export function createMemoryStoreFixture(options: ScoundrelStoreOptions = {}): MemoryStoreFixture {
  const storage = createMemoryStorage();
  return { storage, store: createScoundrelStore({ storage, ...options }) };
}

/** Write one shard envelope directly (to seed fixtures or corrupt payloads). */
export function writeShard(
  storage: StoreStorage,
  shard: keyof typeof STORAGE_KEYS,
  data: unknown,
): void {
  const written = storage.write(
    STORAGE_KEYS[shard],
    JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }),
  );
  if (written.status !== 'ok') throw new Error(`Could not seed the ${shard} shard.`);
}

/** Write a raw string under a shard key (corrupt JSON / wrong version tests). */
export function writeRawShard(
  storage: StoreStorage,
  shard: keyof typeof STORAGE_KEYS,
  raw: string,
): void {
  const written = storage.write(STORAGE_KEYS[shard], raw);
  if (written.status !== 'ok') throw new Error(`Could not seed the raw ${shard} shard.`);
}

/** Storage that reads fine but never accepts a write (quota-failure shape). */
export function failingWriteStorage(): StoreStorage {
  const unavailable: StorageWrite = { status: 'unavailable' };
  return {
    available: true,
    read: () => ({ status: 'ok', value: null }),
    write: () => unavailable,
    remove: () => unavailable,
    subscribe: () => () => undefined,
  };
}

/** Play a run to its outcome through the engine and record it in the store. */
export function recordCompletedRun(
  store: ScoundrelStore,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
): { runId: string; state: GameState } {
  const started = store.startNewRun(config);
  if (!started.ok) throw new Error(`Could not start a run: ${started.reason}`);

  let state = started.run.state;
  for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
    const result = applyAction(state, toAction(doomedPolicy(state)));
    if (!result.ok) throw new Error(`Doomed policy was rejected: ${result.reason}`);
    state = result.state;
  }
  if (state.status === 'playing') throw new Error('Doomed policy did not finish the run.');

  const completed = store.completeRun(started.run.runId, state);
  if (!completed.ok) throw new Error(`Could not complete the run: ${completed.reason}`);
  return { runId: started.run.runId, state };
}

/** Record a batch of completed runs (history-trim tests need more than 50). */
export function recordCompletedRuns(store: ScoundrelStore, count: number): void {
  for (let index = 0; index < count; index += 1) recordCompletedRun(store);
}
