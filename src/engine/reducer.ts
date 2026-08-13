/**
 * Scoundrel game reducer.
 *
 * Pure (state, action) → { state, result } per src/engine/types.ts. Never
 * mutates input state, never throws for in-game invalid actions (they reduce
 * to `InvalidAction{reason}`), and every returned state stays
 * JSON-serializable (the room snapshot's own `roomSnapshot` is always null).
 *
 * Behavior decisions (docs/spec.md "Rule decisions", docs/design-plan.md):
 * - Combat damage = max(0, monster − weapon). Barehanded always legal even
 *   with a weapon equipped (full monster value, kill stack untouched).
 * - Weapon degradation (config toggle): the weapon may only fight monsters
 *   with value strictly lower than its last kill (killStack top).
 * - Weapon swap discards the old weapon + entire kill stack.
 * - Potions: per-room cap from config (1 canonical, 'unlimited' toggle).
 *   Beyond the cap the heart is discarded without healing (wasted), but it
 *   still resolves the card. The counter resets whenever a new room starts.
 * - RunAway sends all current room cards to the dungeon bottom and deals a
 *   fresh 4-card room immediately; blocked 'twice-in-row' (mode 'once') or
 *   'no-cards' (fewer than 4 cards available for the new room, i.e.
 *   dungeon.length + room.length < 8). Blocked attempts leave state unchanged.
 * - Final room: when the dungeon is empty after dealing, the room must be
 *   resolved in full (no carryover). Resolving the final card with an empty
 *   dungeon wins: score = hp. hp ≤ 0 at any resolution loses:
 *   score = 0 − sum(values of monsters left in the dungeon deck). Death beats
 *   completion when both happen on the final card.
 * - Per-room undo: every room start (DealRoom / EnterNextRoom / RanAway deal)
 *   snapshots into roomSnapshot. UndoToRoomStart restores it and keeps the
 *   same snapshot attached so undo can be retried; invalid only when there is
 *   no snapshot.
 */

import type {
  ActionResult,
  CardId,
  GameAction,
  GameConfig,
  GameResult,
  GameState,
  Reducer,
  ReducerResult,
} from './types'
import { DEFAULT_CONFIG } from './types'
import { buildDeck, cardValue, isMonster, isPotion, isWeapon, shuffle } from './deck'
import { mulberry32, seedToUint32 } from './prng'

/** Canonical starting health (docs/rules.md: "Start with 20 Health"). */
export const MAX_HP = 20

/** Cards dealt to a full room. */
const ROOM_SIZE = 4

/** Cards that must be resolved in a normal (non-final) room. */
const ROOM_RESOLVE_TARGET = 3

/**
 * Cards that must be resolved before leaving the current room. Once the
 * dungeon is empty the room is final and resolves in full; otherwise exactly
 * 3 of 4 resolve and the 4th carries over.
 */
function roomResolveTarget(state: GameState): number {
  return state.dungeon.length === 0 ? state.room.length + state.resolvedCount : ROOM_RESOLVE_TARGET
}

function invalid(state: GameState, reason: string): ReducerResult {
  return { state, result: { type: 'InvalidAction', reason } }
}

/** Build the post-deal state including its room-start snapshot. */
function withRoomSnapshot(state: GameState): GameState {
  const snapshot: GameState = { ...state, roomSnapshot: null }
  return { ...state, roomSnapshot: snapshot }
}

/** Attach terminal outcomes (lose first — death beats completion) after a resolution. */
function withTerminal(state: GameState, via: ActionResult): ReducerResult {
  if (state.hp <= 0) {
    const monsterSum = state.dungeon
      .filter(isMonster)
      .reduce((sum, cardId) => sum + cardValue(cardId), 0)
    const result: GameResult = {
      type: 'GameLost',
      score: 0 - monsterSum,
      seed: state.seed,
      config: state.config,
      via,
    }
    return { state: { ...state, phase: 'lost' }, result }
  }
  if (state.dungeon.length === 0 && state.room.length === 0) {
    const result: GameResult = {
      type: 'GameWon',
      score: state.hp,
      seed: state.seed,
      config: state.config,
      via,
    }
    return { state: { ...state, phase: 'won' }, result }
  }
  return { state, result: via }
}

export function createInitialState(
  seed: string,
  config: GameConfig = DEFAULT_CONFIG,
  startedAt: number = Date.now(),
): GameState {
  return {
    seed,
    config,
    phase: 'playing',
    hp: MAX_HP,
    maxHp: MAX_HP,
    dungeon: shuffle(buildDeck(), mulberry32(seedToUint32(seed))),
    room: [],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 0,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
    startedAt,
    roomSnapshot: null,
  }
}

function dealRoom(state: GameState): ReducerResult {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  const roomInProgress = state.room.length > 0 && state.resolvedCount < roomResolveTarget(state)
  if (roomInProgress) return invalid(state, 'room-in-progress')

  const carry = state.room // leftover card(s) of a completed room (normally ≤ 1)
  const take = Math.min(ROOM_SIZE - carry.length, state.dungeon.length)
  if (take + carry.length === 0) return invalid(state, 'no-cards')

  const dealt = state.dungeon.slice(0, take)
  const room = [...carry, ...dealt]
  const carriedFrom = carry.at(0)

  const dealtState = withRoomSnapshot({
    ...state,
    dungeon: state.dungeon.slice(take),
    room,
    resolvedCount: 0,
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: state.turnCount + 1,
    runHighlights: { ...state.runHighlights, roomsExplored: state.runHighlights.roomsExplored + 1 },
    roomSnapshot: null,
  })
  return {
    state: dealtState,
    result: {
      type: 'RoomDealt',
      cards: room,
      ...(carriedFrom !== undefined ? { carriedFrom } : {}),
    },
  }
}

function fightMonster(
  state: GameState,
  action: { type: 'FightMonster'; cardId: CardId; barehanded?: boolean },
): ReducerResult {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  const { cardId } = action
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  if (!isMonster(cardId)) return invalid(state, 'not-a-monster')
  if (state.resolvedCount >= roomResolveTarget(state)) return invalid(state, 'room-complete')

  const weapon = state.weapon
  const useWeapon = weapon !== null && action.barehanded !== true
  const monsterValue = cardValue(cardId)

  let damage: number
  let killStack = state.killStack
  let usedWeaponId: CardId | undefined
  if (useWeapon) {
    if (state.config.weaponDegradation && killStack.length > 0) {
      const lastKill = killStack.at(-1)
      if (lastKill !== undefined && monsterValue >= cardValue(lastKill)) {
        return invalid(state, 'weapon-degraded')
      }
    }
    damage = Math.max(0, monsterValue - cardValue(weapon))
    killStack = [...killStack, cardId]
    usedWeaponId = weapon
  } else {
    damage = monsterValue
  }

  const next: GameState = {
    ...state,
    hp: state.hp - damage,
    room: state.room.filter((card) => card !== cardId),
    resolvedCount: state.resolvedCount + 1,
    killStack,
    turnCount: state.turnCount + 1,
    runHighlights: {
      ...state.runHighlights,
      monstersKilled: state.runHighlights.monstersKilled + 1,
    },
  }
  const via: ActionResult = {
    type: 'MonsterDefeated',
    cardId,
    damage,
    weaponBroke: false,
    ...(usedWeaponId !== undefined ? { usedWeaponId } : {}),
  }
  return withTerminal(next, via)
}

function drinkPotion(
  state: GameState,
  action: { type: 'DrinkPotion'; cardId: CardId },
): ReducerResult {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  const { cardId } = action
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  if (!isPotion(cardId)) return invalid(state, 'not-a-potion')
  if (state.resolvedCount >= roomResolveTarget(state)) return invalid(state, 'room-complete')

  const cap = state.config.potionsPerRoom === 'unlimited' ? Number.POSITIVE_INFINITY : 1
  const wasted = state.potionsUsedThisRoom >= cap
  const healed = wasted ? 0 : Math.min(state.maxHp, state.hp + cardValue(cardId)) - state.hp

  const next: GameState = {
    ...state,
    hp: state.hp + healed,
    room: state.room.filter((card) => card !== cardId),
    resolvedCount: state.resolvedCount + 1,
    potionsUsedThisRoom: wasted ? state.potionsUsedThisRoom : state.potionsUsedThisRoom + 1,
    turnCount: state.turnCount + 1,
    runHighlights: {
      ...state.runHighlights,
      potionsWasted: state.runHighlights.potionsWasted + (wasted ? 1 : 0),
    },
  }
  const via: ActionResult = { type: 'PotionQuaffed', cardId, healed, wasted }
  return withTerminal(next, via)
}

function equipWeapon(
  state: GameState,
  action: { type: 'EquipWeapon'; cardId: CardId },
): ReducerResult {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  const { cardId } = action
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  if (!isWeapon(cardId)) return invalid(state, 'not-a-weapon')
  if (state.resolvedCount >= roomResolveTarget(state)) return invalid(state, 'room-complete')

  const discardedWeaponId = state.weapon ?? undefined
  const discardedMonsterIds = state.killStack

  const next: GameState = {
    ...state,
    weapon: cardId,
    killStack: [],
    room: state.room.filter((card) => card !== cardId),
    resolvedCount: state.resolvedCount + 1,
    turnCount: state.turnCount + 1,
  }
  const via: ActionResult = {
    type: 'WeaponEquipped',
    cardId,
    ...(discardedWeaponId !== undefined ? { discardedWeaponId } : {}),
    discardedMonsterIds,
  }
  return withTerminal(next, via)
}

function runAway(state: GameState): ReducerResult {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (state.room.length === 0) return invalid(state, 'no-room')
  // Running is only legal from an unfaced room — rules.md L21 sends "all 4
  // cards" back, so a partially resolved room cannot be fled (canonical rule;
  // also protects the mandatory 4th-card carryover from being dodged).
  if (state.resolvedCount > 0) return invalid(state, 'room-in-progress')
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
    return { state, result: { type: 'RunAwayBlocked', reason: 'twice-in-row' } }
  }
  // With an unfaced (full) room, "can't form a new room after putting the room
  // back on the bottom" reduces to the spec's gate: dungeon.length < 4. This
  // also blocks running once a final partial room is in progress (dungeon empty).
  if (state.dungeon.length < 4) {
    return { state, result: { type: 'RunAwayBlocked', reason: 'no-cards' } }
  }

  const recycled = [...state.dungeon, ...state.room]
  const newCards = recycled.slice(0, ROOM_SIZE)
  const next = withRoomSnapshot({
    ...state,
    dungeon: recycled.slice(ROOM_SIZE),
    room: newCards,
    resolvedCount: 0,
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: true,
    turnCount: state.turnCount + 1,
    runHighlights: { ...state.runHighlights, roomsExplored: state.runHighlights.roomsExplored + 1 },
    roomSnapshot: null,
  })
  return { state: next, result: { type: 'RanAway', newCards } }
}

function undoToRoomStart(state: GameState): ReducerResult {
  // Terminal states are sticky — undo is a within-room affordance and must not
  // resurrect a finished run (spec US 34/41/42).
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  const snapshot = state.roomSnapshot
  if (snapshot === null) return invalid(state, 'no-snapshot')
  // Keep the snapshot attached so undo can be retried within the same room.
  return { state: { ...snapshot, roomSnapshot: snapshot }, result: { type: 'UndoDone' } }
}

export const reducer: Reducer = (state: GameState, action: GameAction): ReducerResult => {
  switch (action.type) {
    case 'StartNewRun':
      // Equivalent to createInitialState(seed, config); the store should
      // follow with DealRoom. RoomDealt{cards: []} is the typed "no room yet"
      // placeholder until that first deal.
      return {
        state: createInitialState(action.seed, action.config),
        result: { type: 'RoomDealt', cards: [] },
      }
    case 'DealRoom':
    case 'EnterNextRoom':
      return dealRoom(state)
    case 'FightMonster':
      return fightMonster(state, action)
    case 'DrinkPotion':
      return drinkPotion(state, action)
    case 'EquipWeapon':
      return equipWeapon(state, action)
    case 'RunAway':
      return runAway(state)
    case 'UndoToRoomStart':
      return undoToRoomStart(state)
  }
}
