/**
 * Versioned saved-data envelopes (implementation-plan foundation decision,
 * REQ-010, DEC-003).
 *
 * Every shard is stored as JSON `{ schemaVersion, data }` under the product's
 * own namespace. Reads validate the payload, migrate supported older versions
 * through ordered migration functions, and report corrupt or unsupported
 * payloads without rewriting them so the store can offer recovery choices.
 *
 * This is the single source of truth for the saved-data version and the
 * `scoundrel:*` key names. Bump `SCHEMA_VERSION` and add a migration step to
 * `SHARD_MIGRATIONS` for the affected shard, or saved data is discarded.
 */
import type { StoreStorage } from './storage';

export const SCHEMA_VERSION = 1;
export const STORAGE_NAMESPACE = 'scoundrel';

export const STORAGE_KEYS = {
  settings: `${STORAGE_NAMESPACE}:settings`,
  stats: `${STORAGE_NAMESPACE}:stats`,
  run: `${STORAGE_NAMESPACE}:run`,
} as const;

export type StorageShard = keyof typeof STORAGE_KEYS;

/** Upgrades shard data from its own version N to version N + 1. */
export type MigrationStep = (data: unknown) => unknown;
export type Migrations = Readonly<Record<number, MigrationStep>>;

export interface StoredEnvelope {
  readonly schemaVersion: number;
  readonly data: unknown;
}

export type ReadStoredResult<T> =
  | {
      readonly status: 'ok';
      readonly data: T;
      /** Version of the envelope as written. */
      readonly version: number;
      /** Present when a migration ran; the original version. */
      readonly migratedFrom?: number;
    }
  | { readonly status: 'missing' }
  | { readonly status: 'corrupt'; readonly raw: string }
  | { readonly status: 'unsupported-version'; readonly raw: string; readonly version: number }
  | { readonly status: 'unavailable' };

export type WriteStoredResult = { readonly status: 'ok' } | { readonly status: 'unavailable' };

export interface ReadStoredOptions<T> {
  /** Returns true only for a fully valid payload. */
  readonly validate: (value: unknown) => value is T;
  /** Migration steps keyed by the version they upgrade from. */
  readonly migrations?: Migrations;
  /** Target version; defaults to the current saved-data version. */
  readonly schemaVersion?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchemaVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Read and validate one shard. Unreadable payloads are returned with their raw
 * text so the caller can preserve them instead of overwriting.
 */
export function readStoredShard<T>(
  storage: StoreStorage,
  key: string,
  options: ReadStoredOptions<T>,
): ReadStoredResult<T> {
  const read = storage.read(key);
  if (read.status === 'unavailable') return { status: 'unavailable' };
  if (read.value === null) return { status: 'missing' };

  const raw = read.value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', raw };
  }
  if (!isRecord(parsed) || !isSchemaVersion(parsed.schemaVersion)) {
    return { status: 'corrupt', raw };
  }

  const writtenVersion = parsed.schemaVersion;
  const targetVersion = options.schemaVersion ?? SCHEMA_VERSION;
  if (writtenVersion > targetVersion) {
    return { status: 'unsupported-version', raw, version: writtenVersion };
  }

  const migrations = options.migrations ?? {};
  let data: unknown = parsed.data;
  let version = writtenVersion;
  while (version < targetVersion) {
    const step = migrations[version];
    if (step === undefined) return { status: 'unsupported-version', raw, version: writtenVersion };
    try {
      data = step(data);
    } catch {
      return { status: 'corrupt', raw };
    }
    version += 1;
  }

  if (!options.validate(data)) return { status: 'corrupt', raw };
  if (writtenVersion !== version) {
    return { status: 'ok', data, version, migratedFrom: writtenVersion };
  }
  return { status: 'ok', data, version };
}

/** Serialize one shard under the current saved-data version. */
export function writeStoredShard(
  storage: StoreStorage,
  key: string,
  data: unknown,
  schemaVersion: number = SCHEMA_VERSION,
): WriteStoredResult {
  let raw: string;
  try {
    raw = JSON.stringify({ schemaVersion, data } satisfies StoredEnvelope);
  } catch {
    return { status: 'unavailable' };
  }
  return storage.write(key, raw);
}

/** Remove one shard entirely; used by explicit discard and reset recovery actions. */
export function removeStoredShard(storage: StoreStorage, key: string): WriteStoredResult {
  return storage.remove(key);
}

/**
 * Migration registry per shard. The first released saved-data schema is
 * version 1, so no production migrations exist yet. When `SCHEMA_VERSION`
 * changes, add the upgrade step here for each affected shard.
 */
export const SHARD_MIGRATIONS: Readonly<Record<StorageShard, Migrations>> = Object.freeze({
  settings: {},
  stats: {},
  run: {},
});
