/**
 * Engine contract for Scoundrel — frozen at scaffold time.
 *
 * This file is the integration seam between the engine lane (implements it)
 * and the UI lane (consumes it). It is intentionally type-only; the function
 * contract (createInitialState, reduce, canRunAway, previewFightMonster,
 * card helpers, DEFAULT_CONFIG) is declared in ./index.ts.
 *
 * Do not change these shapes without coordinating both lanes: update
 * docs/spec.md first, then this file.
 *
 * Sources of truth: docs/rules.md (canonical rules), docs/spec.md
 * (implementation decisions), docs/design-plan.md (settled decisions).
 */

/* ------------------------------------------------------------------ */
/* Card identity (Q56: CardId doubles as the artwork filename stem).   */
/* ------------------------------------------------------------------ */

export type Suit = 'club' | 'spade' | 'diamond' | 'heart'
export type MonsterSuit = 'club' | 'spade'
export type NumericValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
export type FaceValue = 'j' | 'q' | 'k' | 'a'
export type Value = NumericValue | FaceValue

/** Monsters: clubs/spades 2..10 + j/q/k/a. */
export type MonsterCardId = `${MonsterSuit}-${Value}`
/** Weapons (diamonds) and potions (hearts): 2..10 only. */
export type ItemCardId = `${'diamond' | 'heart'}-${NumericValue}`
export type CardId = MonsterCardId | ItemCardId

export type CardKind = 'monster' | 'weapon' | 'potion'

/* ------------------------------------------------------------------ */
/* Config (Q19a)                                                       */
/* ------------------------------------------------------------------ */

export interface GameConfig {
  runAwayMode: 'once' | 'unlimited'
  /** 1 (canonical) or Number.POSITIVE_INFINITY. */
  potionsPerRoom: number
  weaponDegradation: boolean
}

/* ------------------------------------------------------------------ */
/* State (Q45b: selection intentionally absent — lives in the store).  */
/* ------------------------------------------------------------------ */

export interface RunHighlights {
  monstersKilled: number
  potionsWasted: number
  roomsExplored: number
}

export interface GameState {
  seed: string
  config: GameConfig
  phase: 'playing' | 'won' | 'lost'
  hp: number
  maxHp: number
  /** Remaining draw pile. */
  dungeon: CardId[]
  /** Current room (4 or fewer), including the carried card if any. */
  room: CardId[]
  /** Cards resolved this room. */
  resolvedCount: number
  weapon: CardId | null
  /** Last-killed monster at killStack[killStack.length - 1]. */
  killStack: CardId[]
  potionsUsedThisRoom: number
  ranAwayLastRoom: boolean
  turnCount: number
  runHighlights: RunHighlights
  startedAt: number
  /** Single current-room snapshot for undo (Q7b/Q36a). */
  roomSnapshot: GameState | null
}

/* ------------------------------------------------------------------ */
/* Actions (Q30a)                                                      */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'StartNewRun'; seed: string; config: GameConfig }
  | { type: 'DealRoom' }
  | { type: 'FightMonster'; cardId: CardId; barehanded?: boolean }
  | { type: 'DrinkPotion'; cardId: CardId }
  | { type: 'EquipWeapon'; cardId: CardId }
  | { type: 'RunAway' }
  | { type: 'UndoToRoomStart' }
  | { type: 'EnterNextRoom' }

/* ------------------------------------------------------------------ */
/* Results (Q25b / Q35b): map 1:1 to SR live-region announcements.     */
/* ------------------------------------------------------------------ */

export type RunAwayBlockReason = 'twice-in-row' | 'no-cards'

export type Result =
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
  | { type: 'RunAwayBlocked'; reason: RunAwayBlockReason }
  | { type: 'RoomDealt'; cards: CardId[]; carriedFrom?: CardId }
  | { type: 'UndoDone' }
  | { type: 'InvalidAction'; reason: string }
  | { type: 'GameWon'; score: number; seed: string; config: GameConfig }
  | { type: 'GameLost'; score: number; seed: string; config: GameConfig }
