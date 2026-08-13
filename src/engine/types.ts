/**
 * Engine contract — pinned by the orchestrator before implementation lanes start.
 *
 * Derived directly from docs/spec.md ("Engine state shape", "Config object",
 * "Action union", "Result union") and docs/design-plan.md (Q30a, Q35b, Q19a).
 * Implementation lanes MUST NOT change these types without escalating.
 *
 * Contract trims made at pin time (recorded here deliberately):
 * - `potionsPerRoom` is `1 | 'unlimited'` instead of `1 | Infinity`, because
 *   GameConfig must survive JSON serialization (localStorage persistence and
 *   shareable replay URLs). The semantics are identical.
 * - Terminal results (`GameWon` / `GameLost`) carry a `via` field holding the
 *   non-terminal result that triggered the transition, so UI announcements and
 *   stats writes keep their payload even on the terminal action.
 */

/** Card suits: Clubs/Spades are monsters, Diamonds are weapons, Hearts are potions. */
export type Suit = 'C' | 'S' | 'D' | 'H'

/** Ranks 2–10, J=11, Q=12, K=13, A=14. */
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

/**
 * Card identity string, format `${Rank}${Suit}` — e.g. '8C', '10D', 'QH', 'AS'.
 * The full 44-card deck is standard 52 minus jokers, red face cards, and red Aces
 * (see docs/rules.md "Setup & Card Values").
 */
export type CardId = string

export interface GameConfig {
  /** 'once' = cannot run from two rooms in a row (canonical rules). */
  runAwayMode: 'once' | 'unlimited'
  /** 1 = canonical one-potion-per-room rule. ('unlimited' — see header note.) */
  potionsPerRoom: 1 | 'unlimited'
  /** true = weapon can only fight monsters weaker than its last kill. */
  weaponDegradation: boolean
}

/** Canonical-rules config (docs/rules.md faithful). */
export const DEFAULT_CONFIG: GameConfig = {
  runAwayMode: 'once',
  potionsPerRoom: 1,
  weaponDegradation: true,
}

export type GamePhase = 'playing' | 'won' | 'lost'

export interface RunHighlights {
  monstersKilled: number
  potionsWasted: number
  roomsExplored: number
}

/**
 * Flat, JSON-serializable game truth. Selection state is deliberately absent —
 * it lives in the Zustand store (spec Q45b).
 *
 * `roomSnapshot` holds the single current-room snapshot for per-room undo
 * (explicit "Enter Next Room" clears the old snapshot and snapshots the new
 * room at its start). A snapshot's own `roomSnapshot` is always null.
 */
export interface GameState {
  seed: string
  config: GameConfig
  phase: GamePhase
  hp: number
  maxHp: number
  /** Remaining draw pile. */
  dungeon: CardId[]
  /** Current room (4 or fewer cards), including any carried-over card. */
  room: CardId[]
  /** Cards resolved this room (room completes at 3 for a 4-card room,
   *  or all cards for the final partial room). */
  resolvedCount: number
  weapon: CardId | null
  /** Defeated monsters; last-killed is killStack[killStack.length - 1]. */
  killStack: CardId[]
  potionsUsedThisRoom: number
  ranAwayLastRoom: boolean
  turnCount: number
  runHighlights: RunHighlights
  /** Epoch ms when the run started (for stats/history). */
  startedAt: number
  roomSnapshot: GameState | null
}

export type GameAction =
  | { type: 'StartNewRun'; seed: string; config: GameConfig }
  | { type: 'DealRoom' }
  | { type: 'FightMonster'; cardId: CardId; barehanded?: boolean }
  | { type: 'DrinkPotion'; cardId: CardId }
  | { type: 'EquipWeapon'; cardId: CardId }
  | { type: 'RunAway' }
  | { type: 'UndoToRoomStart' }
  | { type: 'EnterNextRoom' }

/** Non-terminal results (per docs/spec.md "Result union"). */
export type ActionResult =
  | {
      type: 'MonsterDefeated'
      cardId: CardId
      damage: number
      weaponBroke: boolean
      usedWeaponId?: CardId
    }
  | {
      type: 'WeaponEquipped'
      cardId: CardId
      discardedWeaponId?: CardId
      discardedMonsterIds: CardId[]
    }
  | { type: 'PotionQuaffed'; cardId: CardId; healed: number; wasted: boolean }
  | { type: 'RanAway'; newCards: CardId[] }
  | { type: 'RunAwayBlocked'; reason: 'twice-in-row' | 'no-cards' }
  | { type: 'RoomDealt'; cards: CardId[]; carriedFrom?: CardId }
  | { type: 'UndoDone' }
  | { type: 'InvalidAction'; reason: string }

/** Terminal results. `via` carries the action result that ended the run. */
export type TerminalResult =
  | { type: 'GameWon'; score: number; seed: string; config: GameConfig; via: ActionResult }
  | { type: 'GameLost'; score: number; seed: string; config: GameConfig; via: ActionResult }

export type GameResult = ActionResult | TerminalResult

/** Reducer entry point: pure (state, action) → { state, result }. */
export interface ReducerResult {
  state: GameState
  result: GameResult
}

export type Reducer = (state: GameState, action: GameAction) => ReducerResult
