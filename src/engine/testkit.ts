/**
 * Shared builders for engine unit tests (Seam 1). Not a test file itself.
 * `makeState` crafts arbitrary GameState values — GameState is the frozen
 * contract type, so building it directly is testing through the public seam.
 */
import type { GameConfig, GameState } from './types'
import { DEFAULT_CONFIG } from './index'

export const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({ ...DEFAULT_CONFIG, ...over })

export const makeState = (over: Partial<GameState> = {}): GameState => ({
  seed: 'test',
  config: cfg(),
  phase: 'playing',
  hp: 20,
  maxHp: 20,
  // Non-empty by default so crafted single-card rooms are not accidentally
  // terminal (win requires an empty dungeon). Terminal tests override this.
  dungeon: ['club-3'],
  room: [],
  resolvedCount: 0,
  weapon: null,
  killStack: [],
  potionsUsedThisRoom: 0,
  ranAwayLastRoom: false,
  turnCount: 0,
  runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
  startedAt: 0,
  roomSnapshot: null,
  ...over,
})

/** State without the undo snapshot — handy for snapshot assertions. */
export const stripSnapshot = (s: GameState): GameState => ({ ...s, roomSnapshot: null })

/** JSON deep clone (engine state must stay JSON-serializable). */
export const jsonClone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState
