import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, createInitialState, kindOf, previewFightMonster, reduce } from './index'
import type { Action, GameState } from './index'
import { makeState } from './testkit'

describe('winning (score = remaining hp)', () => {
  it('resolving the last card of the dungeon wins; score is remaining hp', () => {
    const s = makeState({ room: ['heart-4'], dungeon: [], hp: 13 })
    const { state, result } = reduce(s, { type: 'DrinkPotion', cardId: 'heart-4' })
    expect(result).toEqual({
      type: 'GameWon',
      score: 17, // 13 + 4 healed; final score is hp after the action
      seed: s.seed,
      config: s.config,
    })
    expect(state.phase).toBe('won')
    expect(state.hp).toBe(17)
    expect(state.roomSnapshot).toBeNull() // undo seam closed at the end of the run
  })

  it('GameWon is also the terminal result of a lethal-free final fight', () => {
    const s = makeState({ room: ['spade-6'], dungeon: [], hp: 10 })
    const { result, state } = reduce(s, { type: 'FightMonster', cardId: 'spade-6', barehanded: true })
    expect(result.type).toBe('GameWon')
    if (result.type === 'GameWon') expect(result.score).toBe(4)
    expect(state.runHighlights.roomsExplored).toBe(1) // final room counts when won
  })
})

describe('losing (score = 0 − values of unplayed monsters in the dungeon)', () => {
  it('hp at 0 or below loses; score subtracts only unplayed dungeon monsters', () => {
    const s = makeState({
      room: ['spade-10', 'club-2'], // club-2 is in the room, NOT counted
      dungeon: ['club-10', 'heart-9', 'diamond-2', 'spade-a'],
      hp: 5,
    })
    const { state, result } = reduce(s, { type: 'FightMonster', cardId: 'spade-10', barehanded: true })
    expect(result.type).toBe('GameLost')
    if (result.type === 'GameLost') expect(result.score).toBe(-(10 + 14)) // club-10 + spade-a
    expect(state.phase).toBe('lost')
    expect(state.hp).toBe(-5)
    expect(state.roomSnapshot).toBeNull()
  })

  it('a lethal weapon fight loses as well', () => {
    const s = makeState({ room: ['club-8'], weapon: 'diamond-2', hp: 3, dungeon: ['club-2'] })
    const { result } = reduce(s, { type: 'FightMonster', cardId: 'club-8' })
    expect(result.type).toBe('GameLost')
    if (result.type === 'GameLost') expect(result.score).toBe(-2)
  })

  it('losing with an empty dungeon scores 0 (never -0)', () => {
    const s = makeState({ room: ['club-10'], dungeon: [], hp: 4 })
    const { result } = reduce(s, { type: 'FightMonster', cardId: 'club-10', barehanded: true })
    expect(result.type).toBe('GameLost')
    if (result.type === 'GameLost') expect(result.score).toBe(0)
  })
})

describe('terminal states reject further play but allow restart', () => {
  const won = makeState({ phase: 'won', room: ['club-2'] })

  it.each<Action>([
    { type: 'FightMonster', cardId: 'club-2', barehanded: true },
    { type: 'DrinkPotion', cardId: 'heart-2' },
    { type: 'EquipWeapon', cardId: 'diamond-2' },
    { type: 'RunAway' },
    { type: 'EnterNextRoom' },
    { type: 'DealRoom' },
  ])('%s reduces to InvalidAction', (action) => {
    const { state, result } = reduce(won, action)
    expect(result.type).toBe('InvalidAction')
    expect(state).toBe(won)
  })

  it('UndoToRoomStart is invalid from a terminal state (snapshot cleared)', () => {
    const { result } = reduce(won, { type: 'UndoToRoomStart' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'no-snapshot' })
  })

  it('StartNewRun resets from a terminal state', () => {
    const { state, result } = reduce(won, {
      type: 'StartNewRun',
      seed: 'restart',
      config: DEFAULT_CONFIG,
    })
    expect(result.type).toBe('RoomDealt')
    expect(state.phase).toBe('playing')
    expect(state.seed).toBe('restart')
    expect(state.room).toHaveLength(4)
  })
})

describe('determinism (mulberry32 seeds, Q16a)', () => {
  it('same seed produces the same deck order', () => {
    const a = createInitialState('abc123', DEFAULT_CONFIG)
    const b = createInitialState('abc123', DEFAULT_CONFIG)
    expect(a.dungeon).toEqual(b.dungeon)
  })

  it('different seeds produce different deck orders', () => {
    const a = createInitialState('abc123', DEFAULT_CONFIG)
    const b = createInitialState('xyz789', DEFAULT_CONFIG)
    expect(a.dungeon).not.toEqual(b.dungeon)
    // Same multiset regardless of seed.
    expect([...a.dungeon].sort()).toEqual([...b.dungeon].sort())
  })

  it('accepts arbitrary seed strings (not just base36)', () => {
    const a = createInitialState('hello world!', DEFAULT_CONFIG)
    const b = createInitialState('hello world!', DEFAULT_CONFIG)
    expect(a.dungeon).toEqual(b.dungeon)
    expect(a.dungeon).toHaveLength(44)
  })
})

describe('a full scripted run through the public reducer API', () => {
  /** Fixed policy: heal, re-arm, weapon-fight the first legal monster, else barehanded. */
  const playToEnd = (seed: string): { state: GameState; roomsAdvanced: number } => {
    let state = reduce(createInitialState('dummy', DEFAULT_CONFIG), {
      type: 'StartNewRun',
      seed,
      config: DEFAULT_CONFIG,
    }).state
    let roomsAdvanced = 0
    for (let guard = 0; state.phase === 'playing'; guard++) {
      if (guard > 500) throw new Error('scripted run did not terminate')
      if (state.room.length === 1 && state.resolvedCount === 3 && state.dungeon.length > 0) {
        state = reduce(state, { type: 'EnterNextRoom' }).state
        roomsAdvanced += 1
        continue
      }
      const potion = state.room.find((c) => kindOf(c) === 'potion')
      if (potion && state.hp < state.maxHp) {
        state = reduce(state, { type: 'DrinkPotion', cardId: potion }).state
        continue
      }
      const weapon = state.room.find((c) => kindOf(c) === 'weapon')
      if (weapon && state.weapon === null) {
        state = reduce(state, { type: 'EquipWeapon', cardId: weapon }).state
        continue
      }
      const legalFight = state.room.find(
        (c) => kindOf(c) === 'monster' && previewFightMonster(state, c, false).legal,
      )
      if (legalFight) {
        state = reduce(state, { type: 'FightMonster', cardId: legalFight }).state
        continue
      }
      const monster = state.room.find((c) => kindOf(c) === 'monster')
      if (monster) {
        state = reduce(state, { type: 'FightMonster', cardId: monster, barehanded: true }).state
        continue
      }
      if (weapon) {
        state = reduce(state, { type: 'EquipWeapon', cardId: weapon }).state
        continue
      }
      if (potion) {
        // Full hp: drink anyway — the potion is wasted but the room advances.
        state = reduce(state, { type: 'DrinkPotion', cardId: potion }).state
        continue
      }
      throw new Error(`policy stuck: no legal play in room ${state.room.join(',')}`)
    }
    return { state, roomsAdvanced: roomsAdvanced }
  }

  it('terminates and scores per the rules', () => {
    const { state, roomsAdvanced } = playToEnd('integration-1')
    expect(state.phase).not.toBe('playing')
    if (state.phase === 'won') {
      expect(state.dungeon).toEqual([])
      expect(state.room).toEqual([])
      expect(state.runHighlights.roomsExplored).toBe(roomsAdvanced + 1)
      expect(state.hp).toBeGreaterThan(0)
      expect(state.hp).toBeLessThanOrEqual(20)
    } else {
      expect(state.hp).toBeLessThanOrEqual(0)
    }
  })

  it('is exactly reproducible for the same seed', () => {
    const a = playToEnd('integration-1').state
    const b = playToEnd('integration-1').state
    expect(a).toEqual(b)
  })

  it('different seeds can produce different trajectories', () => {
    const a = playToEnd('integration-1').state
    const b = playToEnd('integration-2').state
    expect(createInitialState('integration-1', DEFAULT_CONFIG).dungeon).not.toEqual(
      createInitialState('integration-2', DEFAULT_CONFIG).dungeon,
    )
    expect(a.turnCount).toBeGreaterThan(0)
    expect(b.turnCount).toBeGreaterThan(0)
  })
})
