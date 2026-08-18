/**
 * E2e seam-3 ground truth: replays embedded action scripts through the pure
 * engine (no DOM) to compute expected states/results, and validates that the
 * embedded scripts still land exactly where the specs claim they do. Nothing
 * here launches a browser.
 */
import { DEFAULT_CONFIG, createInitialState, reduce } from '../../src/engine'
import type { Action, CardId, GameConfig, GameState, Result } from '../../src/engine'

export interface ScriptStep {
  action: Action
  state: GameState
  result: Result
}

export const CANON: GameConfig = DEFAULT_CONFIG

/** The 4 cards dealt on seed start (engine truth for the seeded-URL test). */
export function firstRoom(seed: string, config: GameConfig = CANON): CardId[] {
  const { result } = reduce(createInitialState(seed, config), {
    type: 'StartNewRun',
    seed,
    config,
  })
  if (result.type !== 'RoomDealt') throw new Error('StartNewRun did not deal')
  return result.cards
}

/**
 * Replays an embedded action list through the pure reducer. Hard-fails on any
 * rejected action (an embedded script that drifts out of validity is a test
 * bug, not an app bug) and asserts the free run terminates as expected.
 */
export function runActionScript(seed: string, actions: readonly Action[]): ScriptStep[] {
  let state = createInitialState(seed, CANON)
  const steps: ScriptStep[] = []
  actions.forEach((action, i) => {
    const { state: next, result } = reduce(state, action)
    if (result.type === 'InvalidAction' || result.type === 'RunAwayBlocked') {
      throw new Error(
        `script for seed ${seed} rejected at step ${i}: ${JSON.stringify(action)} → ${JSON.stringify(result)}`,
      )
    }
    steps.push({ action, state: next, result })
    state = next
  })
  return steps
}

/** Terminal step of a script (must be GameWon/GameLost). */
export function terminalOf(steps: readonly ScriptStep[]): ScriptStep {
  const last = steps[steps.length - 1]
  if (last === undefined || last.state.phase === 'playing') {
    throw new Error('script did not reach a terminal state')
  }
  return last
}
