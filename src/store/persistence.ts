/**
 * Sharded localStorage persistence. Each key holds a single versioned wrapper
 * `{ version, data }`; `load` runs migrations across schema versions and
 * returns null on corruption so callers fall back to defaults.
 */
export const STORAGE_KEYS = {
  settings: 'scoundrel:settings',
  stats: 'scoundrel:stats',
  run: 'scoundrel:run',
} as const;

export const SCHEMA_VERSION = 1;

export interface Versioned<T> {
  version: number;
  data: T;
}

/** Migrates `data` from `fromVersion` to the current schema version. */
export type Migrate<T> = (data: unknown, fromVersion: number) => T | null;

export function load<T>(key: string, migrate: Migrate<T>): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Versioned<unknown>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Versioned<unknown>).version !== 'number' ||
      !('data' in parsed)
    ) {
      return null;
    }
    return migrate(parsed.data, parsed.version);
  } catch {
    return null;
  }
}

export function save<T>(key: string, data: T): void {
  const wrapper: Versioned<T> = { version: SCHEMA_VERSION, data };
  try {
    localStorage.setItem(key, JSON.stringify(wrapper));
  } catch {
    // Storage full or unavailable: persistence is best-effort.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Version-aware reader: runs migrations when the stored version differs from
 * the current schema, returning the migrated data (or null if unrecoverable).
 */
export function migrateVersion<T>(
  currentVersion: number,
  latest: (data: unknown) => T | null,
): Migrate<T> {
  return (data, fromVersion) => {
    if (fromVersion === currentVersion) return latest(data);
    // Future versions: no downgrade path; treat as unknown.
    if (fromVersion > currentVersion) return null;
    // Past versions: chain migrations here as SCHEMA_VERSION increments.
    // Version 1 is the first schema, so nothing to do yet.
    return latest(data);
  };
}
