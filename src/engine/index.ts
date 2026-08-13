/**
 * Scoundrel engine — pure TypeScript game logic with zero React/DOM imports.
 * Public API: createInitialState(seed, config) + reducer(state, action).
 */

export * from './types'
export * from './prng'
export * from './deck'
export { MAX_HP, createInitialState, reducer } from './reducer'
