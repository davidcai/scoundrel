/**
 * Engine implementation for Scoundrel.
 *
 * Contract frozen in ./types.ts and in the exported signatures below;
 * semantics per docs/rules.md (canonical) + docs/spec.md + docs/design-plan.md
 * sections C/D. Pure functions only: no side effects, no Date.now/randomness
 * outside the seed; state stays JSON-serializable.
 *
 * Contract decisions made here (flagged to reviewers):
 * - `StartNewRun` initializes the run AND deals the first room, returning
 *   `RoomDealt{cards}` (user story: "starting a run deals the top 4 cards").
 *   `DealRoom` remains valid only from an empty-room playing state (e.g. a
 *   rehydrated pre-deal save); otherwise it reduces to `InvalidAction`.
 * - `weaponBroke` is always `false` — canonical Scoundrel has no weapon-break
 *   rule; the field stays for UI announcement compatibility.
 * - `startedAt` is always `0` — the engine is pure and must not call
 *   Date.now(); the persistence layer stamps wall-clock time when saving.
 * - Terminal transitions clear `roomSnapshot` (undo is a within-room tool;
 *   Win/Lose screens are final). Losing takes precedence over winning when an
 *   action is simultaneously lethal and deck-clearing (cannot happen in
 *   practice; ordering is defensive).
 */
import type {
  Action,
  CardId,
  CardKind,
  GameConfig,
  GameState,
  Result,
  RunAwayBlockReason,
  Suit,
} from './types'
import { CARD_IDS } from './cards'
import { shuffled } from './rng'

export * from './types'
export { CARD_IDS } from './cards'

const STARTING_HP = 20
const ROOM_SIZE = 4
const RESOLVE_TARGET = ROOM_SIZE - 1 // resolve 3 of 4; the 4th auto-carries (Q29b)

interface Outcome {
  state: GameState
  result: Result
}

/* ------------------------------------------------------------------ */
/* Card helpers                                                        */
/* ------------------------------------------------------------------ */

/** Rules.md values: J=11, Q=12, K=13, A=14. */
export const numericValue: (card: CardId) => number = (card) => {
  const v = card.slice(card.indexOf('-') + 1)
  switch (v) {
    case 'j':
      return 11
    case 'q':
      return 12
    case 'k':
      return 13
    case 'a':
      return 14
    default:
      return Number(v)
  }
}

export const suitOf: (card: CardId) => Suit = (card) =>
  card.slice(0, card.indexOf('-')) as Suit

export const kindOf: (card: CardId) => CardKind = (card) => {
  const suit = suitOf(card)
  if (suit === 'diamond') return 'weapon'
  if (suit === 'heart') return 'potion'
  return 'monster'
}

/** Canonical rules config from docs/rules.md. */
export const DEFAULT_CONFIG: GameConfig = {
  runAwayMode: 'once',
  potionsPerRoom: 1,
  weaponDegradation: true,
}

/* ------------------------------------------------------------------ */
/* State construction & internal plumbing                              */
/* ------------------------------------------------------------------ */

/** Creates the initial run state: shuffles the 44-card dungeon via mulberry32(seed). */
export const createInitialState: (seed: string, config: GameConfig) => GameState = (
  seed,
  config,
) => ({
  seed,
  config: { ...config },
  phase: 'playing',
  hp: STARTING_HP,
  maxHp: STARTING_HP,
  dungeon: shuffled(CARD_IDS, seed),
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
})

/** Deep-enough copy for the undo snapshot; snapshots never nest (roomSnapshot: null). */
const cloneForSnapshot = (s: GameState): GameState => ({
  ...s,
  config: { ...s.config },
  dungeon: [...s.dungeon],
  room: [...s.room],
  killStack: [...s.killStack],
  runHighlights: { ...s.runHighlights },
  roomSnapshot: null,
})

/** Attach the single current-room snapshot (Q7b/Q36a: start-of-room undo seam). */
const withRoomSnapshot = (s: GameState): GameState => ({ ...s, roomSnapshot: cloneForSnapshot(s) })

const invalid = (state: GameState, reason: string): Outcome => ({
  state,
  result: { type: 'InvalidAction' as const, reason },
})

/** Finalize a freshly dealt room: reset per-room counters, advance the turn, snapshot. */
const startRoom = (s: GameState, room: CardId[], dungeon: CardId[]): GameState =>
  withRoomSnapshot({
    ...s,
    dungeon,
    room,
    resolvedCount: 0,
    potionsUsedThisRoom: 0,
    turnCount: s.turnCount + 1,
  })

/** Mark a room card as resolved (remove from room, bump the counter). */
const resolveCard = (s: GameState, cardId: CardId): GameState => ({
  ...s,
  room: s.room.filter((c) => c !== cardId),
  resolvedCount: s.resolvedCount + 1,
})

/** Lose score (rules.md): 0 minus values of all unplayed monsters left in the dungeon. */
const loseScore = (dungeon: CardId[]): number => {
  const total = dungeon.reduce((sum, c) => (kindOf(c) === 'monster' ? sum + numericValue(c) : sum), 0)
  return total === 0 ? 0 : -total // normalize: never emit -0
}

/**
 * Terminal check after a card resolution. Win: deck empty and room fully
 * resolved (final score = remaining hp). Lose: hp <= 0. The resolved final
 * room counts toward roomsExplored only when won.
 */
const finishIfTerminal = (s: GameState): { state: GameState; terminal: Result | null } => {
  if (s.hp <= 0) {
    return {
      state: { ...s, phase: 'lost', roomSnapshot: null },
      terminal: { type: 'GameLost', score: loseScore(s.dungeon), seed: s.seed, config: s.config },
    }
  }
  if (s.dungeon.length === 0 && s.room.length === 0) {
    return {
      state: {
        ...s,
        phase: 'won',
        roomSnapshot: null,
        runHighlights: { ...s.runHighlights, roomsExplored: s.runHighlights.roomsExplored + 1 },
      },
      terminal: { type: 'GameWon', score: s.hp, seed: s.seed, config: s.config },
    }
  }
  return { state: s, terminal: null }
}

const withTerminal = (s: GameState, perAction: Result): Outcome => {
  const { state, terminal } = finishIfTerminal(s)
  return { state, result: terminal ?? perAction }
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Q53a + run-away restriction gate; drives the greyed-out Run button. */
export const canRunAway: (state: GameState) => {
  allowed: boolean
  reason?: RunAwayBlockReason
} = (state) => {
  if (state.phase !== 'playing' || state.room.length === 0 || state.resolvedCount > 0) {
    return { allowed: false }
  }
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
    return { allowed: false, reason: 'twice-in-row' }
  }
  if (state.dungeon.length < 4) {
    return { allowed: false, reason: 'no-cards' }
  }
  return { allowed: true }
}

/** Q17d: engine-computed damage preview so the UI never re-implements combat math. */
export const previewFightMonster: (
  state: GameState,
  cardId: CardId,
  barehanded: boolean,
) => { legal: boolean; damage: number; reason?: string } = (state, cardId, barehanded) => {
  if (state.phase !== 'playing') return { legal: false, damage: 0, reason: 'not-playing' }
  if (kindOf(cardId) !== 'monster') return { legal: false, damage: 0, reason: 'not-a-monster' }
  if (!state.room.includes(cardId))
    return { legal: false, damage: 0, reason: 'card-not-in-room' }
  const monster = numericValue(cardId)
  const weapon = state.weapon
  if (weapon === null || barehanded) return { legal: true, damage: monster }
  const damage = Math.max(0, monster - numericValue(weapon))
  if (state.config.weaponDegradation && state.killStack.length > 0) {
    const last = numericValue(state.killStack[state.killStack.length - 1])
    if (monster >= last) {
      return { legal: false, damage, reason: 'weapon-degraded' }
    }
  }
  return { legal: true, damage }
}

/* ------------------------------------------------------------------ */
/* Action handlers                                                     */
/* ------------------------------------------------------------------ */

const startNewRun = (seed: string, config: GameConfig): Outcome => {
  const fresh = createInitialState(seed, config)
  const cards = fresh.dungeon.slice(0, ROOM_SIZE)
  const state = startRoom(fresh, cards, fresh.dungeon.slice(cards.length))
  return { state, result: { type: 'RoomDealt', cards } }
}

const dealRoom = (state: GameState): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (state.room.length > 0) return invalid(state, 'room-already-dealt')
  if (state.dungeon.length === 0) return invalid(state, 'deck-empty')
  const cards = state.dungeon.slice(0, Math.min(ROOM_SIZE, state.dungeon.length))
  const next = startRoom(state, cards, state.dungeon.slice(cards.length))
  return { state: next, result: { type: 'RoomDealt', cards } }
}

const fightMonster = (state: GameState, cardId: CardId, barehanded: boolean): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (kindOf(cardId) !== 'monster') return invalid(state, 'not-a-monster')
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  const monster = numericValue(cardId)
  const weapon = state.weapon
  let damage: number
  let killStack = state.killStack
  let usedWeaponId: CardId | undefined
  if (weapon !== null && !barehanded) {
    // Q41a: damage = max(0, monster − weapon); weapon degradation gates the fight.
    if (state.config.weaponDegradation && killStack.length > 0) {
      const last = numericValue(killStack[killStack.length - 1])
      if (monster >= last) return invalid(state, 'weapon-degraded')
    }
    damage = Math.max(0, monster - numericValue(weapon))
    killStack = [...killStack, cardId]
    usedWeaponId = weapon
  } else {
    // Barehanded is always legal (Q41a); the monster is discarded and the
    // weapon threshold is preserved.
    damage = monster
  }
  const resolved = resolveCard(state, cardId)
  const next: GameState = {
    ...resolved,
    hp: resolved.hp - damage,
    killStack,
    runHighlights: {
      ...resolved.runHighlights,
      monstersKilled: resolved.runHighlights.monstersKilled + 1,
    },
  }
  return withTerminal(next, {
    type: 'MonsterDefeated',
    cardId,
    damage,
    weaponBroke: false,
    usedWeaponId,
  })
}

const drinkPotion = (state: GameState, cardId: CardId): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (kindOf(cardId) !== 'potion') return invalid(state, 'not-a-potion')
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  // One potion per room is canonical; potionsPerRoom loosens the within-room
  // cap only (Q54a). Extra drinks resolve the card but heal nothing.
  const wasted = state.potionsUsedThisRoom >= state.config.potionsPerRoom
  const healed = wasted ? 0 : Math.min(numericValue(cardId), state.maxHp - state.hp)
  const resolved = resolveCard(state, cardId)
  const next: GameState = {
    ...resolved,
    hp: resolved.hp + healed,
    potionsUsedThisRoom: resolved.potionsUsedThisRoom + 1,
    runHighlights: {
      ...resolved.runHighlights,
      potionsWasted: resolved.runHighlights.potionsWasted + (wasted ? 1 : 0),
    },
  }
  return withTerminal(next, { type: 'PotionQuaffed', cardId, healed, wasted })
}

const equipWeapon = (state: GameState, cardId: CardId): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (kindOf(cardId) !== 'weapon') return invalid(state, 'not-a-weapon')
  if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room')
  // Q42a: swapping discards the old weapon AND its entire kill stack.
  const discardedWeaponId: CardId | undefined = state.weapon ?? undefined
  const discardedMonsterIds = [...state.killStack]
  const resolved = resolveCard(state, cardId)
  const next: GameState = { ...resolved, weapon: cardId, killStack: [] }
  return withTerminal(next, { type: 'WeaponEquipped', cardId, discardedWeaponId, discardedMonsterIds })
}

const runAway = (state: GameState): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  if (state.room.length === 0) return invalid(state, 'no-room-to-run')
  if (state.resolvedCount > 0) return invalid(state, 'cards-already-resolved')
  // Send all 4 room cards to the bottom of the dungeon and deal a fresh room.
  // Gates: no two runs in a row (unless 'unlimited'); deck must hold >= 4 (Q53a).
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
    return { state, result: { type: 'RunAwayBlocked', reason: 'twice-in-row' } }
  }
  if (state.dungeon.length < 4) {
    return { state, result: { type: 'RunAwayBlocked', reason: 'no-cards' } }
  }
  const pooled = [...state.dungeon, ...state.room]
  const newCards = pooled.slice(0, ROOM_SIZE)
  const next = startRoom({ ...state, ranAwayLastRoom: true }, newCards, pooled.slice(ROOM_SIZE))
  return { state: next, result: { type: 'RanAway', newCards } }
}

const undoToRoomStart = (state: GameState): Outcome => {
  const snap = state.roomSnapshot
  if (snap === null) return invalid(state, 'no-snapshot')
  // Snapshots are never mutated, so aliasing is safe; keeping the snapshot on
  // the restored state makes undo repeatable within the same room.
  return { state: { ...snap, roomSnapshot: snap }, result: { type: 'UndoDone' } }
}

const enterNextRoom = (state: GameState): Outcome => {
  if (state.phase !== 'playing') return invalid(state, 'not-playing')
  // Q52c adaptive final room: once the dungeon is empty there is no next room;
  // the current one must be resolved in full (no carryover).
  if (state.dungeon.length === 0) return invalid(state, 'final-room-must-be-fully-resolved')
  if (state.resolvedCount < RESOLVE_TARGET || state.room.length !== 1) {
    return invalid(state, 'room-not-complete')
  }
  const carried = state.room[0]
  const draw = Math.min(RESOLVE_TARGET, state.dungeon.length)
  const dealt = state.dungeon.slice(0, draw)
  const cards = [carried, ...dealt]
  const next = startRoom(
    {
      ...state,
      ranAwayLastRoom: false,
      runHighlights: {
        ...state.runHighlights,
        roomsExplored: state.runHighlights.roomsExplored + 1,
      },
    },
    cards,
    state.dungeon.slice(draw),
  )
  return { state: next, result: { type: 'RoomDealt', cards, carriedFrom: carried } }
}

/** Pure reducer: (state, action) -> { state, result } (Q21b/Q25b). */
export const reduce: (
  state: GameState,
  action: Action,
) => { state: GameState; result: Result } = (state, action) => {
  switch (action.type) {
    case 'StartNewRun':
      return startNewRun(action.seed, action.config)
    case 'DealRoom':
      return dealRoom(state)
    case 'FightMonster':
      return fightMonster(state, action.cardId, action.barehanded ?? false)
    case 'DrinkPotion':
      return drinkPotion(state, action.cardId)
    case 'EquipWeapon':
      return equipWeapon(state, action.cardId)
    case 'RunAway':
      return runAway(state)
    case 'UndoToRoomStart':
      return undoToRoomStart(state)
    case 'EnterNextRoom':
      return enterNextRoom(state)
    default:
      // Action.type is exhaustively handled above; keep a defensive default so
      // the reducer can never fall off the end (double-project typecheck).
      return invalid(state, 'unknown-action')
  }
}
