/**
 * Shared helpers for engine unit tests (not a test file).
 */

import type { GameConfig, GameState } from './types'
import { DEFAULT_CONFIG } from './types'
import { createInitialState } from './reducer'

/** Fixed epoch so crafted states are deterministic across runs. */
export const FIXED_NOW = 1_700_000_000_000

/**
 * A baseline GameState with field overrides. States are plain JSON, so tests
 * hand-craft scenarios by spreading this base — the reducer contract is the
 * state shape, not the shuffle outcome.
 */
export function makeState(
  overrides: Partial<GameState> = {},
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  const base = createInitialState('test0', config, FIXED_NOW)
  return { ...base, ...overrides, config }
}

/** Index into an array under noUncheckedIndexedAccess, failing loudly. */
export function at<T>(list: readonly T[], index: number): T {
  const value = list[index]
  if (value === undefined) {
    throw new Error(`expected element at index ${String(index)}`)
  }
  return value
}
