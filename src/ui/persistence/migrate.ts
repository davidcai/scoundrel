/**
 * Schema versioning + migrations (docs/spec.md Q11b/Q22b/Q46).
 *
 * Every persisted shard lives behind a single versioned wrapper
 * `{version, data}`. `migrate(key, wrapper)` walks the per-key upgrade chain
 * until the data reaches CURRENT_VERSION (or the chain gives up).
 *
 * v1 is current, so all chains start empty. Adding schema v2:
 *   1. Bump CURRENT_VERSION to 2.
 *   2. Add `1: (data) => upgraded` under each affected key's chain
 *      (the step at index N upgrades version N → N+1).
 * Multi-step upgrades (v1 → v2 → v3) then compose automatically.
 */

import type { PersistedKey } from './types'
import { STORAGE_KEYS } from './types'

/** Current schema version for every shard. */
export const CURRENT_VERSION = 1

/** The persisted envelope around each shard's data. */
export interface VersionedWrapper<T = unknown> {
  version: number
  data: T
}

/** One chain step: upgrade data from version N to N+1 (N is its chain index). */
export type MigrationStep = (data: unknown) => unknown

/** Index-by-from-version chain of upgrade steps for one key. */
export type MigrationChain = Partial<Record<number, MigrationStep>>

export type MigrationChains = Partial<Record<PersistedKey, MigrationChain>>

/** Chains for the live shards. Empty because v1 is current — see header. */
const MIGRATION_CHAINS: MigrationChains = {
  [STORAGE_KEYS.settings]: {},
  [STORAGE_KEYS.stats]: {},
  [STORAGE_KEYS.run]: {},
}

/** Hard cap on chain steps so a corrupt `version` can't loop forever. */
const MAX_MIGRATION_STEPS = 100

/**
 * Apply one chain until `targetVersion` is reached, a step is missing, or a
 * corrupt version value halts progress. Pure and never throws — the version
 * always ends ≥ the input version, and callers decide whether
 * `result.version === CURRENT_VERSION` is acceptable.
 */
export function applyMigrations(
  chain: MigrationChain,
  wrapper: VersionedWrapper,
  targetVersion: number = CURRENT_VERSION,
): VersionedWrapper {
  let { version, data } = wrapper
  let steps = 0
  while (
    Number.isInteger(version) &&
    version >= 0 &&
    version < targetVersion &&
    steps < MAX_MIGRATION_STEPS
  ) {
    const step = chain[version]
    if (!step) break
    data = step(data)
    version += 1
    steps += 1
  }
  return { version, data }
}

/**
 * Migrate a stored wrapper for `key` toward CURRENT_VERSION using that key's
 * registered chain. Never throws; if the wrapper is older than CURRENT_VERSION
 * but has no registered steps (or is newer than this build understands), it is
 * returned with its (non-current) version preserved so the caller can fall
 * back to defaults.
 */
export function migrate(
  key: PersistedKey,
  wrapper: VersionedWrapper,
  chains: MigrationChains = MIGRATION_CHAINS,
): VersionedWrapper {
  const chain = chains[key] ?? {}
  return applyMigrations(chain, wrapper)
}
