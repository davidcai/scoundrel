/**
 * Storage access for the persisted store (Phase 4, REQ-010).
 *
 * The store never talks to `localStorage` directly. This module isolates the
 * three failure modes the recovery policy cares about:
 *
 * - the browser blocks storage access entirely (sandboxed iframe, disabled
 *   cookies, private-mode quota failures);
 * - an individual read or write throws (usually a quota error);
 * - other tabs change a key, which must refresh the in-memory snapshot.
 *
 * Reads and writes return result objects instead of throwing so the store can
 * keep the game playable for the session and surface a warning.
 */

/** The small `Storage` surface the persisted store needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageRead =
  { readonly status: 'ok'; readonly value: string | null } | { readonly status: 'unavailable' };
export type StorageWrite = { readonly status: 'ok' } | { readonly status: 'unavailable' };

/** Cross-tab change notifications; `null` means "everything may have changed". */
export type StorageListener = (key: string | null) => void;

export interface StoreStorage {
  /** Whether the backing storage was usable when created. Writes may still fail later. */
  readonly available: boolean;
  read(key: string): StorageRead;
  write(key: string, value: string): StorageWrite;
  remove(key: string): StorageWrite;
  subscribe(listener: StorageListener): () => void;
}

const PROBE_KEY = '__scoundrel_storage_probe__';

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function probe(storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrap a `Storage`-shaped object so calls never throw and cross-tab updates are
 * observable. Passing a target lets tests exercise every failure path without
 * touching the real browser storage.
 */
export function createStoreStorage(
  options: {
    target?: StorageLike | null;
    subscribe?: (listener: StorageListener) => () => void;
  } = {},
): StoreStorage {
  const target = options.target === undefined ? getBrowserStorage() : options.target;
  let available = probe(target);
  const defaultSubscribe = (listener: StorageListener): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;
    const onStorage = (event: StorageEvent) => listener(event.key);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  };
  const subscribe = options.subscribe ?? defaultSubscribe;

  return {
    get available() {
      return available;
    },
    read(key) {
      if (target === null || !available) return { status: 'unavailable' };
      try {
        return { status: 'ok', value: target.getItem(key) };
      } catch {
        available = false;
        return { status: 'unavailable' };
      }
    },
    write(key, value) {
      if (target === null || !available) return { status: 'unavailable' };
      try {
        target.setItem(key, value);
        return { status: 'ok' };
      } catch {
        return { status: 'unavailable' };
      }
    },
    remove(key) {
      if (target === null || !available) return { status: 'unavailable' };
      try {
        target.removeItem(key);
        return { status: 'ok' };
      } catch {
        return { status: 'unavailable' };
      }
    },
    subscribe,
  };
}

export interface MemoryStorage extends StoreStorage {
  /** Raw key/value view for arranging and asserting test fixtures. */
  snapshot(): Readonly<Record<string, string>>;
}

/** In-memory storage for tests and for the "storage unavailable" session fallback. */
export function createMemoryStorage(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    available: true,
    snapshot: () => Object.freeze(Object.fromEntries(values)),
    read(key) {
      return { status: 'ok', value: values.get(key) ?? null };
    },
    write(key, value) {
      values.set(key, value);
      return { status: 'ok' };
    },
    remove(key) {
      values.delete(key);
      return { status: 'ok' };
    },
    // In-memory storage has no second tab to observe; tests create a second
    // store over the same storage to simulate one.
    subscribe: () => () => undefined,
  };
}

/**
 * Simulates a browser that refuses storage access. Used by tests and useful as
 * a documented "storage unavailable" example for the interface layer.
 */
export function createUnavailableStorage(): StoreStorage {
  return {
    available: false,
    read: () => ({ status: 'unavailable' }),
    write: () => ({ status: 'unavailable' }),
    remove: () => ({ status: 'unavailable' }),
    subscribe: () => () => undefined,
  };
}
