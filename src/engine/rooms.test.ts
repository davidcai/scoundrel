import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, canRunAway, createInitialState, reduce } from './index'
import type { Action } from './index'
import { cfg, jsonClone, makeState, stripSnapshot } from './testkit'

describe('starting and dealing rooms', () => {
  it('StartNewRun deals the first room (top 4 of the shuffled deck)', () => {
    const seed = 'deal-seed'
    const before = createInitialState('irrelevant', DEFAULT_CONFIG)
    const { state, result } = reduce(before, {
      type: 'StartNewRun',
      seed,
      config: DEFAULT_CONFIG,
    })
    const expectedDeck = createInitialState(seed, DEFAULT_CONFIG).dungeon
    expect(result).toEqual({ type: 'RoomDealt', cards: expectedDeck.slice(0, 4) })
    expect(state.room).toEqual(expectedDeck.slice(0, 4))
    expect(state.dungeon).toEqual(expectedDeck.slice(4))
    expect(state.turnCount).toBe(1)
    expect(state.roomSnapshot).not.toBeNull()
  })

  it('DealRoom deals from an empty-room playing state (e.g. rehydrated save)', () => {
    const fresh = createInitialState('deal-seed', DEFAULT_CONFIG)
    const { state, result } = reduce(fresh, { type: 'DealRoom' })
    if (result.type !== 'RoomDealt') throw new Error('expected RoomDealt')
    expect(result.cards).toHaveLength(4)
    expect(state.room).toEqual(result.cards)
    expect(state.dungeon).toHaveLength(40)
  })

  it('rejects DealRoom when a room is already dealt or the game is over', () => {
    const inRoom = makeState({ room: ['club-2'], dungeon: ['club-3', 'club-4'] })
    expect(reduce(inRoom, { type: 'DealRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'room-already-dealt',
    })
    const won = makeState({ phase: 'won' })
    expect(reduce(won, { type: 'DealRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-playing',
    })
    const empty = makeState({ room: [], dungeon: [] })
    expect(reduce(empty, { type: 'DealRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'deck-empty',
    })
  })
})

describe('carryover auto-determination (Q29b: resolve 3 of 4, 4th carries)', () => {
  const roomCards = ['diamond-4', 'club-7', 'spade-9', 'heart-3'] as const
  const base = () =>
    makeState({
      room: [...roomCards],
      dungeon: ['club-2', 'heart-5', 'spade-3', 'club-10'],
      hp: 20,
    })
  const resolveThree = (order: Action[]): ReturnType<typeof reduce>['state'] =>
    order.reduce((s, action) => reduce(s, action).state, base())

  it.each([
    [
      { type: 'EquipWeapon', cardId: 'diamond-4' } as const,
      { type: 'FightMonster', cardId: 'club-7', barehanded: true } as const,
      { type: 'FightMonster', cardId: 'spade-9', barehanded: true } as const,
    ],
    [
      { type: 'FightMonster', cardId: 'spade-9', barehanded: true } as const,
      { type: 'FightMonster', cardId: 'club-7', barehanded: true } as const,
      { type: 'EquipWeapon', cardId: 'diamond-4' } as const,
    ],
  ])('the un-resolved card carries regardless of resolution order (variant %#)', (...actions) => {
    const done = resolveThree(actions)
    expect(done.resolvedCount).toBe(3)
    expect(done.room).toEqual(['heart-3'])

    const { state, result } = reduce(done, { type: 'EnterNextRoom' })
    expect(result).toEqual({
      type: 'RoomDealt',
      cards: ['heart-3', 'club-2', 'heart-5', 'spade-3'],
      carriedFrom: 'heart-3',
    })
    expect(state.room).toEqual(['heart-3', 'club-2', 'heart-5', 'spade-3'])
    expect(state.dungeon).toEqual(['club-10']) // drew 3 of the 4
    expect(state.resolvedCount).toBe(0)
    expect(state.potionsUsedThisRoom).toBe(0)
    expect(state.ranAwayLastRoom).toBe(false)
    expect(state.runHighlights.roomsExplored).toBe(1)
    expect(state.turnCount).toBe(done.turnCount + 1)
  })

  it('EnterNextRoom is rejected before 3 cards are resolved', () => {
    const s = makeState({ room: ['club-2', 'club-3'], resolvedCount: 2, dungeon: ['club-4'] })
    const { state, result } = reduce(s, { type: 'EnterNextRoom' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'room-not-complete' })
    expect(state).toBe(s)
  })

  it('unresolved hearts carry and stay drinkable; potion counter resets per room (Q54a)', () => {
    // Player already used a potion this room, then leaves heart-3 unresolved.
    const s = makeState({
      room: ['heart-3', 'club-5', 'club-6', 'club-7'],
      potionsUsedThisRoom: 1,
      hp: 20, // survives all three barehanded fights (5 + 6 + 7 = 18 damage)
      dungeon: ['spade-2', 'club-8', 'diamond-2', 'heart-9'],
    })
    const played = (['club-5', 'club-6', 'club-7'] as const).reduce(
      (acc, m) => reduce(acc, { type: 'FightMonster', cardId: m, barehanded: true }).state,
      s,
    )
    const next = reduce(played, { type: 'EnterNextRoom' }).state
    expect(next.room[0]).toBe('heart-3')
    expect(next.potionsUsedThisRoom).toBe(0)
    const quaffed = reduce(next, { type: 'DrinkPotion', cardId: 'heart-3' })
    expect(quaffed.result).toEqual({
      type: 'PotionQuaffed',
      cardId: 'heart-3',
      healed: 3,
      wasted: false,
    })
  })
})

describe('running away (Q53a + once-in-a-row)', () => {
  const setup = () =>
    makeState({
      room: ['club-9', 'spade-9', 'diamond-9', 'heart-9'],
      dungeon: ['club-2', 'club-3', 'club-4', 'club-5', 'heart-2'],
      hp: 20,
    })

  it('sends the room to the bottom of the dungeon and deals a fresh room', () => {
    const s = setup()
    const { state, result } = reduce(s, { type: 'RunAway' })
    expect(result).toEqual({ type: 'RanAway', newCards: ['club-2', 'club-3', 'club-4', 'club-5'] })
    expect(state.room).toEqual(['club-2', 'club-3', 'club-4', 'club-5'])
    // Fled cards sit at the bottom of the dungeon, in order.
    expect(state.dungeon).toEqual(['heart-2', 'club-9', 'spade-9', 'diamond-9', 'heart-9'])
    expect(state.ranAwayLastRoom).toBe(true)
    expect(state.resolvedCount).toBe(0)
    expect(state.turnCount).toBe(1)
    expect(state.roomSnapshot).not.toBeNull()
  })

  it('blocks a second consecutive run (once-in-a-row), state untouched', () => {
    const fled = reduce(setup(), { type: 'RunAway' }).state
    expect(canRunAway(fled)).toEqual({ allowed: false, reason: 'twice-in-row' })
    const { state, result } = reduce(fled, { type: 'RunAway' })
    expect(result).toEqual({ type: 'RunAwayBlocked', reason: 'twice-in-row' })
    expect(state).toBe(fled)
  })

  it('facing a room clears the flag: running is allowed again after EnterNextRoom', () => {
    const s = makeState({
      room: ['club-5'],
      resolvedCount: 3,
      ranAwayLastRoom: true,
      // Enough cards that a fresh room deals 3 and >= 4 remain for a later run.
      dungeon: ['club-2', 'club-4', 'club-6', 'spade-2', 'spade-3', 'spade-4', 'heart-2'],
    })
    const next = reduce(s, { type: 'EnterNextRoom' }).state
    expect(next.ranAwayLastRoom).toBe(false)
    expect(canRunAway(next)).toEqual({ allowed: true })
  })

  it("runAwayMode 'unlimited' lifts the twice-in-a-row restriction", () => {
    const s = makeState({
      config: cfg({ runAwayMode: 'unlimited' }),
      room: ['club-9', 'spade-9', 'diamond-9', 'heart-9'],
      ranAwayLastRoom: true,
      dungeon: ['club-2', 'club-3', 'club-4', 'club-5'],
    })
    const { state, result } = reduce(s, { type: 'RunAway' })
    expect(result.type).toBe('RanAway')
    expect(state.ranAwayLastRoom).toBe(true) // it did run again
  })

  it('is blocked when the dungeon holds fewer than 4 cards (no fresh room possible)', () => {
    const s = makeState({
      room: ['club-9', 'spade-9', 'diamond-9', 'heart-9'],
      dungeon: ['club-2', 'club-3', 'club-4'],
    })
    expect(canRunAway(s)).toEqual({ allowed: false, reason: 'no-cards' })
    const { state, result } = reduce(s, { type: 'RunAway' })
    expect(result).toEqual({ type: 'RunAwayBlocked', reason: 'no-cards' })
    expect(state).toBe(s)
  })

  it('deck-size gate applies even in unlimited mode', () => {
    const s = makeState({
      config: cfg({ runAwayMode: 'unlimited' }),
      room: ['club-9', 'spade-9', 'diamond-9', 'heart-9'],
      dungeon: ['club-2'],
    })
    expect(canRunAway(s)).toEqual({ allowed: false, reason: 'no-cards' })
  })

  it("twice-in-row is the primary gate (reported even when the deck is also short)", () => {
    const s = makeState({
      room: ['club-9', 'spade-9', 'diamond-9', 'heart-9'],
      ranAwayLastRoom: true,
      dungeon: ['club-2'],
    })
    expect(canRunAway(s)).toEqual({ allowed: false, reason: 'twice-in-row' })
  })

  it('rejects running mid-room, without a room, or after the game ends', () => {
    const midRoom = makeState({ room: ['club-2', 'club-3'], resolvedCount: 1, dungeon: ['club-4'] })
    expect(reduce(midRoom, { type: 'RunAway' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'cards-already-resolved',
    })
    const noRoom = makeState({ room: [] })
    expect(reduce(noRoom, { type: 'RunAway' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'no-room-to-run',
    })
    const over = makeState({ phase: 'lost', room: ['club-2'] })
    expect(reduce(over, { type: 'RunAway' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-playing',
    })
    // canRunAway reports these only as not-allowed (typed reasons are the two gates).
    expect(canRunAway(over)).toEqual({ allowed: false })
    expect(canRunAway(midRoom)).toEqual({ allowed: false })
  })
})

describe('undo to room start (Q7b/Q36a)', () => {
  it('restores hp, weapon, kill stack, room, and potion counter with full fidelity', () => {
    const dealt = reduce(createInitialState('x', DEFAULT_CONFIG), {
      type: 'StartNewRun',
      seed: 'undo-seed',
      config: DEFAULT_CONFIG,
    }).state
    expect(dealt.roomSnapshot).not.toBeNull()

    // Apply the first legal card action available (deterministic for this seed).
    const [card] = dealt.room
    const action: Action = card.startsWith('heart')
      ? { type: 'DrinkPotion', cardId: card }
      : card.startsWith('diamond')
        ? { type: 'EquipWeapon', cardId: card }
        : { type: 'FightMonster', cardId: card, barehanded: true }
    const acted = reduce(dealt, action).state
    expect(acted.resolvedCount).toBe(1)

    const undone = reduce(acted, { type: 'UndoToRoomStart' })
    expect(undone.result).toEqual({ type: 'UndoDone' })
    expect(undone.state).toEqual(dealt)

    // Undo is repeatable within the room.
    const actedAgain = reduce(undone.state, action).state
    const undoneAgain = reduce(actedAgain, { type: 'UndoToRoomStart' }).state
    expect(undoneAgain).toEqual(dealt)
  })

  it('EnterNextRoom clears the old snapshot and snapshots the new room (undo seam)', () => {
    const clearedRoom = makeState({
      room: ['club-9'],
      resolvedCount: 3,
      dungeon: ['club-2', 'club-3', 'club-4', 'club-5'],
      hp: 12,
    })
    const next = reduce(clearedRoom, { type: 'EnterNextRoom' }).state
    // Snapshot reflects the new room's start state.
    expect(next.roomSnapshot).toEqual(stripSnapshot(next))

    const fought = reduce(next, { type: 'FightMonster', cardId: 'club-9', barehanded: true }).state
    expect(fought.hp).toBe(3)
    const undone = reduce(fought, { type: 'UndoToRoomStart' }).state
    // Rewinds to the NEW room start — the previous room is unreachable.
    expect(undone).toEqual(next)
    expect(undone.hp).toBe(12)
    expect(undone.room).toEqual(['club-9', 'club-2', 'club-3', 'club-4'])
  })

  it('is invalid without a snapshot', () => {
    const s = makeState({ room: ['club-2'] })
    const { state, result } = reduce(s, { type: 'UndoToRoomStart' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'no-snapshot' })
    expect(state).toBe(s)
  })

  it('engine state survives a JSON round trip', () => {
    const dealt = reduce(createInitialState('x', DEFAULT_CONFIG), {
      type: 'StartNewRun',
      seed: 'json-seed',
      config: DEFAULT_CONFIG,
    }).state
    expect(jsonClone(dealt)).toEqual(dealt)
  })
})

describe('adaptive final rooms (Q52c)', () => {
  it('4 remaining (carry + 3): resolve-all, no carryover, EnterNextRoom blocked', () => {
    const s = makeState({
      room: ['club-5'],
      resolvedCount: 3,
      hp: 20,
      dungeon: ['diamond-3', 'club-6', 'heart-4'],
    })
    const dealt = reduce(s, { type: 'EnterNextRoom' })
    expect(dealt.result).toEqual({
      type: 'RoomDealt',
      cards: ['club-5', 'diamond-3', 'club-6', 'heart-4'],
      carriedFrom: 'club-5',
    })
    expect(dealt.state.dungeon).toEqual([])

    // Resolve 3: the room is NOT complete — no carryover exists in a final room.
    const actions: Action[] = [
      { type: 'FightMonster', cardId: 'club-5', barehanded: true },
      { type: 'FightMonster', cardId: 'club-6', barehanded: true },
      { type: 'EquipWeapon', cardId: 'diamond-3' },
    ]
    const played = actions.reduce((acc, action) => reduce(acc, action).state, dealt.state)
    expect(played.resolvedCount).toBe(3)
    expect(reduce(played, { type: 'EnterNextRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'final-room-must-be-fully-resolved',
    })

    // Resolving the last card wins.
    const won = reduce(played, { type: 'DrinkPotion', cardId: 'heart-4' })
    expect(won.result.type).toBe('GameWon')
    expect(won.state.phase).toBe('won')
  })

  it('3 remaining (carry + 2): resolve-all wins', () => {
    const s = makeState({
      room: ['heart-2'],
      resolvedCount: 3,
      hp: 20,
      dungeon: ['club-2', 'club-3'],
    })
    const dealt = reduce(s, { type: 'EnterNextRoom' }).state
    expect(dealt.room).toEqual(['heart-2', 'club-2', 'club-3'])
    const fought = (['club-2', 'club-3'] as const)
      .map((m) => ({ type: 'FightMonster', cardId: m, barehanded: true }) as const)
      .reduce((acc, action) => reduce(acc, action).state, dealt)
    expect(fought.phase).toBe('playing') // not won until the room is empty
    const won = reduce(fought, { type: 'DrinkPotion', cardId: 'heart-2' })
    expect(won.result.type).toBe('GameWon')
  })

  it('2 remaining (carry + 1): the natural 44-card endgame, resolve-all wins', () => {
    const s = makeState({
      room: ['club-4'],
      resolvedCount: 3,
      hp: 20,
      dungeon: ['heart-2'],
    })
    const dealt = reduce(s, { type: 'EnterNextRoom' }).state
    expect(dealt.room).toEqual(['club-4', 'heart-2'])
    expect(dealt.dungeon).toEqual([])
    const fought = reduce(dealt, { type: 'FightMonster', cardId: 'club-4', barehanded: true })
    expect(fought.result.type).toBe('MonsterDefeated')
    const won = reduce(fought.state, { type: 'DrinkPotion', cardId: 'heart-2' })
    expect(won.result.type).toBe('GameWon')
  })

  it('1 remaining: the single-card final room resolves and wins', () => {
    const heartRoom = makeState({ room: ['heart-9'], dungeon: [], hp: 5 })
    const quaffed = reduce(heartRoom, { type: 'DrinkPotion', cardId: 'heart-9' })
    expect(quaffed.result.type).toBe('GameWon')
    expect(quaffed.state.phase).toBe('won')

    const monsterRoom = makeState({ room: ['club-a'], dungeon: [], hp: 20 })
    const fought = reduce(monsterRoom, { type: 'FightMonster', cardId: 'club-a', barehanded: true })
    expect(fought.result.type).toBe('GameWon')
    expect(fought.state.hp).toBe(6)

    const diamondRoom = makeState({ room: ['diamond-8'], dungeon: [], hp: 11 })
    const equipped = reduce(diamondRoom, { type: 'EquipWeapon', cardId: 'diamond-8' })
    expect(equipped.result.type).toBe('GameWon')
    expect(equipped.state.weapon).toBe('diamond-8')
  })
})
