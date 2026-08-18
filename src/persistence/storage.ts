/**
 * Sharded localStorage core (Q11b/Q22b).
 *
 * Each shard lives under its own key and is stored as a single versioned
 * envelope: `{ version: N, data: ... }`. `readVersioned` upgrades older
 * envelopes through a caller-supplied migrate function so schema changes
 * never corrupt or silently reset saved data (Q47).
 *
 * All access is try/catch guarded: when storage is unavailable (private
 * browsing, quota, jsdom oddities) reads fall back and writes become no-ops.
 */

export const STORAGE_KEYS = {
  settings: 'scoundrel:settings',
  stats: 'scoundrel:stats',
  run: 'scoundrel:run',
} as const;

export interface Envelope {
  version: number;
  data: unknown;
}

function safeGet(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — write is best-effort */
  }
}

export function readEnvelope(key: string): Envelope | null {
  const raw = safeGet(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof (parsed as { version: unknown }).version === 'number' &&
      'data' in parsed
    ) {
      return parsed as Envelope;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeEnvelope(key: string, version: number, data: unknown): void {
  safeSet(key, JSON.stringify({ version, data }));
}

export function removeKey(key: string): void {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

/**
 * Reads the envelope at `key` and migrates it to `currentVersion`.
 *
 * `migrate(version, data)` is only invoked for envelopes older/newer than the
 * current version; it returns the data upgraded to the current schema, or
 * null when the stored shape is unrecognizable (callers then get `fallback`).
 * Successful migrations are written back immediately so the upgrade is sticky.
 */
export function readVersioned<T>(
  key: string,
  currentVersion: number,
  migrate: (version: number, data: unknown) => T | null,
  fallback: T,
): T {
  const env = readEnvelope(key);
  if (env === null) return fallback;
  if (env.version === currentVersion) return env.data as T;
  const migrated = migrate(env.version, env.data);
  if (migrated === null) return fallback;
  writeEnvelope(key, currentVersion, migrated);
  return migrated;
}
