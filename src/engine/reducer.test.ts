import { describe, expect, it } from 'vitest'

import type { GameConfig, GameResult, GameState } from './types'
import { DEFAULT_CONFIG } from './types'
import { buildDeck } from './deck'
import { createInitialState, reducer } from './index'
import { FIXED_NOW, at, makeState } from './test-helpers'

const CANONICAL: GameConfig = DEFAULT_CONFIG
const NO_DEGRADATION: GameConfig = { ...DEFAULT_CONFIG, weaponDegradation: false }
const UNLIMITED_POTIONS: GameConfig = { ...DEFAULT_CONFIG, potionsPerRoom: 'unlimited' }
const UNLIMITED_RUN: GameConfig = { ...DEFAULT_CONFIG, runAwayMode: 'unlimited' }

/** Narrow a GameResult to a specific variant, failing the test otherwise. */
function expectResult<T extends GameResult['type']>(
  result: GameResult,
  type: T,
): Extract<GameResult, { type: T }> {
  if (result.type !== type) {
    throw new Error(`expected result "${type}", got "${result.type}"`)
  }
  return result as Extract<GameResult, { type: T }>
}

/** Engine-internal resolve target, mirrored for test policy. */
function resolveTarget(state: GameState): number {
  return state.dungeon.length === 0 ? state.room.length + state.resolvedCount : 3
}

describe('createInitialState', () => {
  it('produces the canonical fresh-run shape', () => {
    const state = createInitialState('abc123', CANONICAL, FIXED_NOW)
    expect(state.seed).toBe('abc123')
    expect(state.config).toEqual(CANONICAL)
    expect(state.phase).toBe('playing')
    expect(state.hp).toBe(20)
    expect(state.maxHp).toBe(20)
    expect(state.room).toEqual([])
    expect(state.resolvedCount).toBe(0)
    expect(state.weapon).toBeNull()
    expect(state.killStack).toEqual([])
    expect(state.potionsUsedThisRoom).toBe(0)
    expect(state.ranAwayLastRoom).toBe(false)
    expect(state.turnCount).toBe(0)
    expect(state.runHighlights).toEqual({ monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 })
    expect(state.startedAt).toBe(FIXED_NOW)
    expect(state.roomSnapshot).toBeNull()
  })

  it('shuffles the full 44-card deck deterministically per seed', () => {
    const a = createInitialState('seed-one', CANONICAL, FIXED_NOW)
    const b = createInitialState('seed-one', CANONICAL, FIXED_NOW)
    expect(a.dungeon).toEqual(b.dungeon)
    expect([...a.dungeon].sort()).toEqual([...buildDeck()].sort())
    expect(new Set(a.dungeon).size).toBe(44)
  })

  it('diverges for distinct seeds', () => {
    const a = createInitialState('seed-one', CANONICAL, FIXED_NOW)
    const b = createInitialState('seed-two', CANONICAL, FIXED_NOW)
    expect(a.dungeon).not.toEqual(b.dungeon)
  })
})

describe('StartNewRun', () => {
  it('resets to a fresh run with the given seed/config', () => {
    const mid = makeState({ hp: 3, room: ['8C'], resolvedCount: 1 })
    const { state, result } = reducer(mid, {
      type: 'StartNewRun',
      seed: 'fresh1',
      config: CANONICAL,
    })
    expectResult(result, 'RoomDealt')
    expect(state.seed).toBe('fresh1')
    expect(state.dungeon).toHaveLength(44)
    expect(state.room).toEqual([])
    expect(state.hp).toBe(20)

    const dealt = reducer(state, { type: 'DealRoom' })
    expect(dealt.state.room).toHaveLength(4)
  })
})

describe('DealRoom / room flow', () => {
  const dungeon = ['8C', '5H', '3D', '9S', 'AS', '2D', '4C', '6H', '7S', '10C', 'KC', '2H']

  it('deals the top 4 cards and snapshots the room start', () => {
    const state = makeState({ dungeon })
    const { state: dealt, result } = reducer(state, { type: 'DealRoom' })
    const roomDealt = expectResult(result, 'RoomDealt')
    expect(roomDealt.cards).toEqual(['8C', '5H', '3D', '9S'])
    expect(roomDealt.carriedFrom).toBeUndefined()

    expect(dealt.room).toEqual(['8C', '5H', '3D', '9S'])
    expect(dealt.dungeon).toEqual(['AS', '2D', '4C', '6H', '7S', '10C', 'KC', '2H'])
    expect(dealt.resolvedCount).toBe(0)
    expect(dealt.runHighlights.roomsExplored).toBe(1)

    const snapshot = dealt.roomSnapshot
    expect(snapshot).not.toBeNull()
    expect(snapshot?.room).toEqual(dealt.room)
    expect(snapshot?.dungeon).toEqual(dealt.dungeon)
    expect(snapshot?.roomSnapshot).toBeNull()
  })

  it('rejects DealRoom while a room is in progress', () => {
    const state = makeState({ dungeon, room: ['8C', '5H', '3D', '9S'], resolvedCount: 1 })
    const { state: next, result } = reducer(state, { type: 'DealRoom' })
    expectResult(result, 'InvalidAction')
    expect(next).toBe(state)
  })

  it('rejects EnterNextRoom before 3 of 4 are resolved', () => {
    const state = makeState({ dungeon, room: ['8C', '5H', '3D', '9S'], resolvedCount: 2 })
    const { state: next, result } = reducer(state, { type: 'EnterNextRoom' })
    expectResult(result, 'InvalidAction')
    expect(next).toBe(state)
  })

  it('locks the 4th card once 3 are resolved (auto-carryover)', () => {
    // Card ids chosen to not collide with the crafted dungeon above.
    const state = makeState({ dungeon, room: ['5C'], resolvedCount: 3, weapon: '9D' })
    for (const action of [
      { type: 'FightMonster', cardId: '5C', barehanded: true },
      { type: 'DrinkPotion', cardId: '5C' },
      { type: 'EquipWeapon', cardId: '5C' },
    ] as const) {
      const { state: next, result } = reducer(state, action)
      expectResult(result, 'InvalidAction')
      expect(next).toBe(state)
    }
  })

  it('EnterNextRoom carries the 4th card into a fresh deal', () => {
    const state = makeState({
      dungeon,
      room: ['7H'],
      resolvedCount: 3,
      potionsUsedThisRoom: 1,
      ranAwayLastRoom: true,
    })
    const { state: next, result } = reducer(state, { type: 'EnterNextRoom' })
    const roomDealt = expectResult(result, 'RoomDealt')
    expect(roomDealt.carriedFrom).toBe('7H')
    expect(roomDealt.cards).toEqual(['7H', '8C', '5H', '3D'])
    expect(next.room).toEqual(['7H', '8C', '5H', '3D'])
    expect(next.dungeon).toEqual(['9S', 'AS', '2D', '4C', '6H', '7S', '10C', 'KC', '2H'])
    expect(next.resolvedCount).toBe(0)
    expect(next.potionsUsedThisRoom).toBe(0)
    expect(next.ranAwayLastRoom).toBe(false)
    expect(next.runHighlights.roomsExplored).toBe(1)
  })

  it('rejects dealing when nothing can form a room', () => {
    const state = makeState({ dungeon: [], room: [], resolvedCount: 0 })
    const { state: next, result } = reducer(state, { type: 'DealRoom' })
    expectResult(result, 'InvalidAction')
    expect(next).toBe(state)
  })
})

describe('FightMonster', () => {
  it('barehanded with no weapon: full monster value damage', () => {
    const state = makeState({ dungeon: ['2H', '3H', '4H'], room: ['8C', '5H', '3D', '9S'] })
    const { state: next, result } = reducer(state, { type: 'FightMonster', cardId: '8C' })
    const defeated = expectResult(result, 'MonsterDefeated')
    expect(defeated.damage).toBe(8)
    expect(defeated.weaponBroke).toBe(false)
    expect('usedWeaponId' in defeated).toBe(false)

    expect(next.hp).toBe(12)
    expect(next.room).toEqual(['5H', '3D', '9S'])
    expect(next.killStack).toEqual([])
    expect(next.resolvedCount).toBe(1)
    expect(next.runHighlights.monstersKilled).toBe(1)
  })

  it('with weapon: damage = monster − weapon', () => {
    const state = makeState({ dungeon: ['2H'], room: ['8C', '5H'], weapon: '5D' })
    const { state: next, result } = reducer(state, { type: 'FightMonster', cardId: '8C' })
    const defeated = expectResult(result, 'MonsterDefeated')
    expect(defeated.damage).toBe(3)
    expect(defeated.usedWeaponId).toBe('5D')

    expect(next.hp).toBe(17)
    expect(next.killStack).toEqual(['8C'])
    expect(next.weapon).toBe('5D')
  })

  it('clamps damage with max(0, monster − weapon)', () => {
    const state = makeState({ dungeon: ['2H'], room: ['3C'], weapon: '9D' })
    const { state: next, result } = reducer(state, { type: 'FightMonster', cardId: '3C' })
    expectResult(result, 'MonsterDefeated')
    expect(expectResult(result, 'MonsterDefeated').damage).toBe(0)
    expect(next.hp).toBe(20)
    expect(next.killStack).toEqual(['3C'])
  })

  it('barehanded stays legal with a weapon equipped and preserves the kill stack', () => {
    const state = makeState({ dungeon: ['2H'], room: ['9S'], weapon: '5D', killStack: ['8C'] })
    const { state: next, result } = reducer(state, {
      type: 'FightMonster',
      cardId: '9S',
      barehanded: true,
    })
    const defeated = expectResult(result, 'MonsterDefeated')
    expect(defeated.damage).toBe(9)
    expect('usedWeaponId' in defeated).toBe(false)
    expect(next.hp).toBe(11)
    expect(next.killStack).toEqual(['8C'])
  })

  describe('weapon degradation', () => {
    const equipped = makeState({
      dungeon: ['2H', '3H', '4H'],
      room: ['9S', '8S', '7S'],
      weapon: '5D',
      killStack: ['8C'],
    })

    it('blocks monsters with value >= last kill (strictly lower only)', () => {
      const equal = reducer(equipped, { type: 'FightMonster', cardId: '8S' })
      expect(expectResult(equal.result, 'InvalidAction').reason).toBe('weapon-degraded')
      expect(equal.state).toBe(equipped)

      const stronger = reducer(equipped, { type: 'FightMonster', cardId: '9S' })
      expect(expectResult(stronger.result, 'InvalidAction').reason).toBe('weapon-degraded')
      expect(stronger.state).toBe(equipped)
    })

    it('allows monsters strictly weaker than the last kill', () => {
      const { state: next, result } = reducer(equipped, { type: 'FightMonster', cardId: '7S' })
      const defeated = expectResult(result, 'MonsterDefeated')
      expect(defeated.damage).toBe(2)
      expect(next.killStack).toEqual(['8C', '7S'])
    })

    it('is disabled by the weaponDegradation toggle', () => {
      const state = makeState(
        { dungeon: ['2H'], room: ['9S'], weapon: '5D', killStack: ['8C'] },
        NO_DEGRADATION,
      )
      const { state: next, result } = reducer(state, { type: 'FightMonster', cardId: '9S' })
      expectResult(result, 'MonsterDefeated')
      expect(next.killStack).toEqual(['8C', '9S'])
    })
  })

  it('rejects non-monsters and out-of-room cards', () => {
    const state = makeState({ dungeon: ['2H'], room: ['5D', '4H', '8C'] })
    expect(
      expectResult(reducer(state, { type: 'FightMonster', cardId: '5D' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-monster')
    expect(
      expectResult(reducer(state, { type: 'FightMonster', cardId: '4H' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-monster')
    expect(
      expectResult(reducer(state, { type: 'FightMonster', cardId: 'AS' }).result, 'InvalidAction')
        .reason,
    ).toBe('card-not-in-room')
  })
})

describe('EquipWeapon', () => {
  it('equips a diamond from the room', () => {
    const state = makeState({ dungeon: ['2H'], room: ['5D', '8C'] })
    const { state: next, result } = reducer(state, { type: 'EquipWeapon', cardId: '5D' })
    const equipped = expectResult(result, 'WeaponEquipped')
    expect('discardedWeaponId' in equipped).toBe(false)
    expect(equipped.discardedMonsterIds).toEqual([])

    expect(next.weapon).toBe('5D')
    expect(next.killStack).toEqual([])
    expect(next.room).toEqual(['8C'])
    expect(next.resolvedCount).toBe(1)
  })

  it('swap discards the old weapon and its entire kill stack', () => {
    const state = makeState({
      dungeon: ['2H'],
      room: ['9D'],
      weapon: '3D',
      killStack: ['4C', '2S'],
    })
    const { state: next, result } = reducer(state, { type: 'EquipWeapon', cardId: '9D' })
    const equipped = expectResult(result, 'WeaponEquipped')
    expect(equipped.discardedWeaponId).toBe('3D')
    expect(equipped.discardedMonsterIds).toEqual(['4C', '2S'])

    expect(next.weapon).toBe('9D')
    expect(next.killStack).toEqual([])
  })

  it('rejects non-diamonds and out-of-room cards', () => {
    const state = makeState({ dungeon: ['2H'], room: ['8C', '4H'] })
    expect(
      expectResult(reducer(state, { type: 'EquipWeapon', cardId: '8C' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-weapon')
    expect(
      expectResult(reducer(state, { type: 'EquipWeapon', cardId: '4H' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-weapon')
    expect(
      expectResult(reducer(state, { type: 'EquipWeapon', cardId: '10D' }).result, 'InvalidAction')
        .reason,
    ).toBe('card-not-in-room')
  })
})

describe('DrinkPotion', () => {
  it('heals by the potion value', () => {
    const state = makeState({ dungeon: ['2H'], room: ['6H', '8C'], hp: 10 })
    const { state: next, result } = reducer(state, { type: 'DrinkPotion', cardId: '6H' })
    const quaffed = expectResult(result, 'PotionQuaffed')
    expect(quaffed.healed).toBe(6)
    expect(quaffed.wasted).toBe(false)
    expect(next.hp).toBe(16)
    expect(next.potionsUsedThisRoom).toBe(1)
    expect(next.resolvedCount).toBe(1)
  })

  it('caps healing at maxHp', () => {
    const state = makeState({ dungeon: ['2H'], room: ['6H'], hp: 19 })
    const { state: next, result } = reducer(state, { type: 'DrinkPotion', cardId: '6H' })
    expect(expectResult(result, 'PotionQuaffed').healed).toBe(1)
    expect(next.hp).toBe(20)
  })

  it('wastes potions beyond the per-room cap (card still resolves)', () => {
    const state = makeState({ dungeon: ['2H'], room: ['6H', '8C'], hp: 10 })
    const first = reducer(state, { type: 'DrinkPotion', cardId: '6H' })
    const room: GameState = { ...first.state, room: [...first.state.room, '9H'] }
    const second = reducer(room, { type: 'DrinkPotion', cardId: '9H' })
    const quaffed = expectResult(second.result, 'PotionQuaffed')
    expect(quaffed.wasted).toBe(true)
    expect(quaffed.healed).toBe(0)
    expect(second.state.hp).toBe(16)
    expect(second.state.room).toEqual(['8C'])
    expect(second.state.resolvedCount).toBe(2)
    expect(second.state.runHighlights.potionsWasted).toBe(1)
  })

  it('drinks freely with the unlimited potions toggle', () => {
    const state = makeState({ dungeon: ['2H'], room: ['6H', '9H'], hp: 2 }, UNLIMITED_POTIONS)
    const first = reducer(state, { type: 'DrinkPotion', cardId: '6H' })
    const second = reducer(first.state, { type: 'DrinkPotion', cardId: '9H' })
    expect(expectResult(second.result, 'PotionQuaffed').wasted).toBe(false)
    expect(second.state.hp).toBe(17)
    expect(second.state.runHighlights.potionsWasted).toBe(0)
    expect(second.state.potionsUsedThisRoom).toBe(2)
  })

  it('resets the potion counter each room; a carried heart stays drinkable', () => {
    const dungeon = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C']
    const completed = makeState({
      dungeon,
      room: ['9H'],
      resolvedCount: 3,
      potionsUsedThisRoom: 1,
      hp: 12,
    })
    const { state: nextRoom, result } = reducer(completed, { type: 'EnterNextRoom' })
    expect(expectResult(result, 'RoomDealt').carriedFrom).toBe('9H')
    expect(nextRoom.potionsUsedThisRoom).toBe(0)

    const quaffed = reducer(nextRoom, { type: 'DrinkPotion', cardId: '9H' })
    expect(expectResult(quaffed.result, 'PotionQuaffed').wasted).toBe(false)
    expect(quaffed.state.hp).toBe(20) // 12 + 9 capped at maxHp
    expect(quaffed.state.potionsUsedThisRoom).toBe(1)
  })

  it('rejects non-hearts and out-of-room cards', () => {
    const state = makeState({ dungeon: ['2H'], room: ['8C', '5D'] })
    expect(
      expectResult(reducer(state, { type: 'DrinkPotion', cardId: '8C' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-potion')
    expect(
      expectResult(reducer(state, { type: 'DrinkPotion', cardId: '5D' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-a-potion')
    expect(
      expectResult(reducer(state, { type: 'DrinkPotion', cardId: '9H' }).result, 'InvalidAction')
        .reason,
    ).toBe('card-not-in-room')
  })
})

describe('weapon swap escape hatch', () => {
  it('a fresh weapon can fight monsters the old stack would have blocked', () => {
    // Degradation locks 3D after killing 9C; swapping to 5D resets the
    // threshold so 10C is legal again (rules.md L27: new weapon starts fresh).
    const state = makeState({
      dungeon: ['2C'], // non-empty so the resolution isn't terminal
      room: ['10C', '5D'],
      weapon: '3D',
      killStack: ['9C'],
    })
    const blocked = reducer(state, { type: 'FightMonster', cardId: '10C' })
    expect(expectResult(blocked.result, 'InvalidAction').reason).toBe('weapon-degraded')
    expect(blocked.state).toBe(state)

    const swapped = reducer(state, { type: 'EquipWeapon', cardId: '5D' })
    expectResult(swapped.result, 'WeaponEquipped')
    expect(swapped.state.killStack).toEqual([])

    const fought = reducer(swapped.state, { type: 'FightMonster', cardId: '10C' })
    const defeated = expectResult(fought.result, 'MonsterDefeated')
    expect(defeated.damage).toBe(5)
    expect(defeated.usedWeaponId).toBe('5D')
  })
})

describe('RunAway', () => {
  const dungeon = ['8C', '9D', '10H', '6S', '7C', '2H', '3S', '4D', '5H', '6D']

  it('sends room cards to the dungeon bottom and deals a fresh room', () => {
    const state = makeState({ dungeon, room: ['2C', '3D', '4H', '5S'] })
    const { state: next, result } = reducer(state, { type: 'RunAway' })
    const ranAway = expectResult(result, 'RanAway')
    expect(ranAway.newCards).toEqual(['8C', '9D', '10H', '6S'])
    expect(next.room).toEqual(['8C', '9D', '10H', '6S'])
    expect(next.dungeon).toEqual(['7C', '2H', '3S', '4D', '5H', '6D', '2C', '3D', '4H', '5S'])
    expect(next.ranAwayLastRoom).toBe(true)
    expect(next.resolvedCount).toBe(0)
    expect(next.potionsUsedThisRoom).toBe(0)
    expect(next.runHighlights.roomsExplored).toBe(1)
    expect(next.roomSnapshot?.room).toEqual(next.room)
  })

  it.each([1, 3])(
    'rejects running once the room has been faced (resolvedCount %i)',
    (resolvedCount) => {
      // Leaving a touched room must go through undo, not run-away — rules.md
      // L21 sends "all 4 cards" back, i.e. only an unfaced room can be fled.
      const state = makeState({
        dungeon,
        room: ['2C', '3D', '4H', '5S'].slice(resolvedCount),
        resolvedCount,
      })
      const { state: next, result } = reducer(state, { type: 'RunAway' })
      expect(expectResult(result, 'InvalidAction').reason).toBe('room-in-progress')
      expect(next).toBe(state)
    },
  )

  it('blocks running twice in a row under the canonical rules', () => {
    const state = makeState({ dungeon, room: ['2C', '3D', '4H', '5S'] })
    const first = reducer(state, { type: 'RunAway' })
    const second = reducer(first.state, { type: 'RunAway' })
    expect(expectResult(second.result, 'RunAwayBlocked').reason).toBe('twice-in-row')
    expect(second.state).toBe(first.state)
  })

  it('allows consecutive runs with the unlimited toggle', () => {
    const state = makeState({ dungeon, room: ['2C', '3D', '4H', '5S'] }, UNLIMITED_RUN)
    const first = reducer(state, { type: 'RunAway' })
    expectResult(first.result, 'RanAway')
    const second = reducer(first.state, { type: 'RunAway' })
    expectResult(second.result, 'RanAway')
    expect(second.state.ranAwayLastRoom).toBe(true)
  })

  it('gates on dungeon size: blocked below 4, allowed at 4', () => {
    // Spec Q53a/L177: run is disabled when the draw pile cannot replace the room.
    const blocked = makeState({ dungeon: ['2C', '3C', '4C'], room: ['6C', '7C', '8C', '9C'] })
    const { state: blockedState, result: blockedResult } = reducer(blocked, { type: 'RunAway' })
    expect(expectResult(blockedResult, 'RunAwayBlocked').reason).toBe('no-cards')
    expect(blockedState).toBe(blocked)

    const allowed = makeState({ dungeon: ['2C', '3C', '4C', '5C'], room: ['6C', '7C', '8C', '9C'] })
    const { state: ranState, result: ranResult } = reducer(allowed, { type: 'RunAway' })
    expect(expectResult(ranResult, 'RanAway').newCards).toEqual(['2C', '3C', '4C', '5C'])
    expect(ranState.dungeon).toEqual(['6C', '7C', '8C', '9C'])
  })

  it('is always blocked once the final room is in progress', () => {
    const state = makeState({ dungeon: [], room: ['AC'] })
    const { state: next, result } = reducer(state, { type: 'RunAway' })
    expect(expectResult(result, 'RunAwayBlocked').reason).toBe('no-cards')
    expect(next).toBe(state)
  })

  it('rejects running with no room dealt', () => {
    const state = makeState({ dungeon })
    const { state: next, result } = reducer(state, { type: 'RunAway' })
    expect(expectResult(result, 'InvalidAction').reason).toBe('no-room')
    expect(next).toBe(state)
  })
})

describe('final partial rooms (resolve-all, no carryover)', () => {
  it.each([['9C', '5D', '6H'], ['9C', '5D'], ['4C']])(
    'deals and fully resolves a final partial room (case %#)',
    (...dungeon) => {
      let state = makeState({ dungeon, room: [], resolvedCount: 0 })
      const dealt = reducer(state, { type: 'DealRoom' })
      state = dealt.state
      expect(state.room).toEqual(dungeon)
      expect(state.dungeon).toEqual([])

      // Every card must resolve — there is no 3-of-4 shortcut in a final room.
      for (const cardId of dungeon) {
        const pending = cardId.endsWith('H')
          ? reducer(state, { type: 'DrinkPotion', cardId })
          : cardId.endsWith('D')
            ? reducer(state, { type: 'EquipWeapon', cardId })
            : reducer(state, { type: 'FightMonster', cardId, barehanded: true })
        expect(pending.result.type).not.toBe('InvalidAction')
        state = pending.state
      }
      expect(state.phase).toBe('won')
    },
  )

  it('treats an exactly-4-remaining deal as a final resolve-all room', () => {
    // Spec L176 mandates 4/3/2/1 coverage; the 4-case flips the resolve target
    // from 3 to 4, so the 4th card stays live and no carryover can occur.
    let state = makeState({ dungeon: ['9C', '5D', '6H', '2C'], room: [], resolvedCount: 0 })
    state = reducer(state, { type: 'DealRoom' }).state
    expect(state.room).toEqual(['9C', '5D', '6H', '2C'])
    expect(state.dungeon).toEqual([])

    // Running is impossible once the final room is in progress.
    const run = reducer(state, { type: 'RunAway' })
    expect(expectResult(run.result, 'RunAwayBlocked').reason).toBe('no-cards')
    expect(run.state).toBe(state)

    // hp 20: 9C barehanded (→11) → equip 5D → drink 6H (→17).
    state = reducer(state, { type: 'FightMonster', cardId: '9C', barehanded: true }).state
    state = reducer(state, { type: 'EquipWeapon', cardId: '5D' }).state
    state = reducer(state, { type: 'DrinkPotion', cardId: '6H' }).state

    // No 3-of-4 shortcut: EnterNextRoom is rejected before all 4 resolve.
    const early = reducer(state, { type: 'EnterNextRoom' })
    expect(expectResult(early.result, 'InvalidAction').reason).toBe('room-in-progress')
    expect(early.state).toBe(state)

    // The 4th card is not locked in the final room.
    const won = reducer(state, { type: 'FightMonster', cardId: '2C', barehanded: true })
    expect(expectResult(won.result, 'GameWon').score).toBe(15)
    expect(won.state.phase).toBe('won')
  })

  it('wins with score = hp when resolving the final card; result carries via', () => {
    // hp 20 → fight 9C barehanded (11) → equip 5D → drink 6H (17).
    const state = makeState({ dungeon: [], room: ['9C', '5D', '6H'], resolvedCount: 0 })
    const r1 = reducer(state, { type: 'FightMonster', cardId: '9C', barehanded: true })
    expect(r1.result.type).toBe('MonsterDefeated')
    const r2 = reducer(r1.state, { type: 'EquipWeapon', cardId: '5D' })
    expect(r2.result.type).toBe('WeaponEquipped')
    const r3 = reducer(r2.state, { type: 'DrinkPotion', cardId: '6H' })
    const won = expectResult(r3.result, 'GameWon')
    expect(won.score).toBe(17)
    expect(won.via.type).toBe('PotionQuaffed')
    expect(won.seed).toBe(state.seed)
    expect(won.config).toEqual(CANONICAL)
    expect(r3.state.phase).toBe('won')
    expect(r3.state.hp).toBe(17)
  })

  it('carries into a smaller final room when the dungeon runs out mid-deal', () => {
    const state = makeState({ dungeon: ['2D', '3H'], room: ['AS'], resolvedCount: 3 })
    const { state: next, result } = reducer(state, { type: 'EnterNextRoom' })
    const roomDealt = expectResult(result, 'RoomDealt')
    expect(roomDealt.carriedFrom).toBe('AS')
    expect(roomDealt.cards).toEqual(['AS', '2D', '3H'])
    expect(next.dungeon).toEqual([])
    expect(resolveTarget(next)).toBe(3)
  })

  it('a fatal final-monster fight loses instead of winning', () => {
    const state = makeState({ dungeon: [], room: ['AC'], resolvedCount: 0, hp: 5 })
    const { state: next, result } = reducer(state, {
      type: 'FightMonster',
      cardId: 'AC',
      barehanded: true,
    })
    const lost = expectResult(result, 'GameLost')
    expect(lost.score).toBe(0) // no monsters remain in the dungeon deck
    expect(lost.via.type).toBe('MonsterDefeated')
    expect(next.phase).toBe('lost')
  })
})

describe('losing & score math', () => {
  it('score = 0 − values of monsters left in the dungeon deck (only monsters count)', () => {
    const state = makeState({
      dungeon: ['9C', '5D', '9H', '2S'], // 9 + 2 = 11 monster value; D/H ignored
      room: ['8C'],
      hp: 3,
    })
    const { state: next, result } = reducer(state, {
      type: 'FightMonster',
      cardId: '8C',
      barehanded: true,
    })
    const lost = expectResult(result, 'GameLost')
    expect(lost.score).toBe(-11)
    expect(lost.via.type).toBe('MonsterDefeated')
    expect(lost.seed).toBe(state.seed)
    expect(lost.config).toEqual(CANONICAL)
    expect(next.phase).toBe('lost')
    expect(next.hp).toBe(-5)
  })

  it('excludes the current room and kill stack from the losing score', () => {
    const state = makeState({
      dungeon: ['2S'],
      room: ['8C', 'KC'],
      hp: 3,
      weapon: '5D',
      killStack: ['4C'],
    })
    const { result } = reducer(state, { type: 'FightMonster', cardId: '8C', barehanded: true })
    const lost = expectResult(result, 'GameLost')
    // Only the 2S in the dungeon deck counts; KC (unresolved, left the deck)
    // and 4C (already played onto the kill stack) are excluded — rules.md L33.
    expect(lost.score).toBe(-2)
  })

  it('a weapon-softened lethal blow still loses', () => {
    const state = makeState({ dungeon: [], room: ['9C'], hp: 2, weapon: '5D' })
    const { state: next, result } = reducer(state, { type: 'FightMonster', cardId: '9C' })
    expect(expectResult(result, 'GameLost').via.type).toBe('MonsterDefeated')
    expect(next.hp).toBe(-2)
  })

  it('locks gameplay actions once the run is terminal', () => {
    const lost = makeState({ phase: 'lost', dungeon: ['2C'], room: ['8C'] })
    expect(
      expectResult(reducer(lost, { type: 'FightMonster', cardId: '8C' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-playing')
    expect(
      expectResult(reducer(lost, { type: 'DrinkPotion', cardId: '8C' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-playing')
    expect(
      expectResult(reducer(lost, { type: 'EquipWeapon', cardId: '8C' }).result, 'InvalidAction')
        .reason,
    ).toBe('not-playing')

    const won = makeState({ phase: 'won', dungeon: [] })
    expect(expectResult(reducer(won, { type: 'DealRoom' }).result, 'InvalidAction').reason).toBe(
      'not-playing',
    )
    expect(expectResult(reducer(won, { type: 'RunAway' }).result, 'InvalidAction').reason).toBe(
      'not-playing',
    )
  })
})

describe('per-room undo', () => {
  const dungeon = ['8C', '5H', '3D', '9S', 'AS', '2D', '4C', '6H', '7S', '10C']

  function dealtState(): GameState {
    const { state } = reducer(makeState({ dungeon }), { type: 'DealRoom' })
    return state
  }

  it('restores the exact room-start state', () => {
    const dealt = dealtState()
    const fought = reducer(dealt, { type: 'FightMonster', cardId: '8C', barehanded: true }).state
    expect(fought.hp).toBe(12)

    const undone = reducer(fought, { type: 'UndoToRoomStart' })
    expectResult(undone.result, 'UndoDone')
    expect(undone.state).toEqual(dealt)
    expect(undone.state.hp).toBe(20)
    expect(undone.state.room).toEqual(['8C', '5H', '3D', '9S'])
    expect(undone.state.resolvedCount).toBe(0)
  })

  it('keeps the snapshot so undo can be retried after a different line', () => {
    const dealt = dealtState()
    const fought = reducer(dealt, { type: 'FightMonster', cardId: '8C', barehanded: true }).state
    const undone1 = reducer(fought, { type: 'UndoToRoomStart' }).state
    expect(undone1.roomSnapshot).toEqual(dealt.roomSnapshot)

    const quaffed = reducer(undone1, { type: 'DrinkPotion', cardId: '5H' }).state
    const undone2 = reducer(quaffed, { type: 'UndoToRoomStart' })
    expect(undone2.state).toEqual(dealt)
  })

  it('is invalid with no snapshot', () => {
    const fresh = makeState({ roomSnapshot: null })
    const { state: next, result } = reducer(fresh, { type: 'UndoToRoomStart' })
    expect(expectResult(result, 'InvalidAction').reason).toBe('no-snapshot')
    expect(next).toBe(fresh)
  })

  it('cannot resurrect a lost run', () => {
    const dealt = reducer(makeState({ dungeon: ['AC', '2C', '3C', '4C'], hp: 5 }), {
      type: 'DealRoom',
    }).state
    const died = reducer(dealt, { type: 'FightMonster', cardId: 'AC', barehanded: true })
    expectResult(died.result, 'GameLost')
    const undone = reducer(died.state, { type: 'UndoToRoomStart' })
    expect(expectResult(undone.result, 'InvalidAction').reason).toBe('not-playing')
    expect(undone.state).toBe(died.state)
  })

  it('cannot rewind a won run', () => {
    const dealt = reducer(makeState({ dungeon: ['2H'] }), { type: 'DealRoom' }).state
    const won = reducer(dealt, { type: 'DrinkPotion', cardId: '2H' })
    expectResult(won.result, 'GameWon')
    const undone = reducer(won.state, { type: 'UndoToRoomStart' })
    expect(expectResult(undone.result, 'InvalidAction').reason).toBe('not-playing')
    expect(undone.state).toBe(won.state)
  })

  it('running away reseams: undo returns to the post-run room, not the fled room', () => {
    // runAway snapshots the newly dealt room, so the run decision itself is a
    // commitment (undo is scoped to the CURRENT room only).
    const dealt = reducer(makeState({ dungeon }), { type: 'DealRoom' }).state
    expect(dealt.room).toEqual(['8C', '5H', '3D', '9S'])
    const ran = reducer(dealt, { type: 'RunAway' }).state
    expect(ran.room).toEqual(['AS', '2D', '4C', '6H'])
    const fought = reducer(ran, { type: 'FightMonster', cardId: 'AS', barehanded: true }).state
    expect(fought.hp).toBe(6)
    const undone = reducer(fought, { type: 'UndoToRoomStart' })
    expectResult(undone.result, 'UndoDone')
    expect(undone.state.room).toEqual(['AS', '2D', '4C', '6H'])
    expect(undone.state.ranAwayLastRoom).toBe(true)
    expect(undone.state.hp).toBe(20)
  })

  it('EnterNextRoom reseams: undo returns to the new room, never the old one', () => {
    const dealt = dealtState()
    const s1 = reducer(dealt, { type: 'FightMonster', cardId: '8C', barehanded: true }).state
    const s2 = reducer(s1, { type: 'DrinkPotion', cardId: '5H' }).state
    const s3 = reducer(s2, { type: 'EquipWeapon', cardId: '3D' }).state
    const entered = reducer(s3, { type: 'EnterNextRoom' }).state
    const carried = at(entered.room, 0)
    expect(carried).toBe('9S')

    const fought = reducer(entered, {
      type: 'FightMonster',
      cardId: at(entered.room, 1),
      barehanded: true,
    }).state
    const undone = reducer(fought, { type: 'UndoToRoomStart' })
    expect(undone.state).toEqual(entered)
    expect(at(undone.state.room, 0)).toBe('9S')
  })
})

describe('purity & serializability', () => {
  it('never mutates the input state', () => {
    const state = makeState({
      dungeon: ['2H', '3H'],
      room: ['8C', '5H', '3D'],
      weapon: '5D',
      killStack: ['4C'],
    })
    const before = JSON.stringify(state)
    reducer(state, { type: 'FightMonster', cardId: '8C' })
    reducer(state, { type: 'DrinkPotion', cardId: '5H' })
    reducer(state, { type: 'EquipWeapon', cardId: '3D' })
    expect(JSON.stringify(state)).toBe(before)
    expect(state.room).toEqual(['8C', '5H', '3D'])
    expect(state.killStack).toEqual(['4C'])
  })

  it('keeps every returned state JSON-serializable (snapshot depth one)', () => {
    const dealt = reducer(makeState({ dungeon: ['8C', '5H', '3D', '9S', 'AS', '2D', '4C'] }), {
      type: 'DealRoom',
    }).state
    expect(JSON.parse(JSON.stringify(dealt))).toEqual(dealt)

    const fought = reducer(dealt, { type: 'FightMonster', cardId: '9S', barehanded: true }).state
    expect(JSON.parse(JSON.stringify(fought))).toEqual(fought)

    const undone = reducer(fought, { type: 'UndoToRoomStart' }).state
    expect(JSON.parse(JSON.stringify(undone))).toEqual(undone)
    expect(undone.roomSnapshot?.roomSnapshot).toBeNull()
  })
})

describe('seeded full-run determinism', () => {
  it('deck order depends only on the seed (config affects rules, not the shuffle)', () => {
    const togglesOff: GameConfig = {
      runAwayMode: 'unlimited',
      potionsPerRoom: 'unlimited',
      weaponDegradation: false,
    }
    const a = createInitialState('cfg-ind', CANONICAL, FIXED_NOW)
    const b = createInitialState('cfg-ind', togglesOff, FIXED_NOW)
    expect(a.dungeon).toEqual(b.dungeon)
    expect(a.config).not.toEqual(b.config)
  })

  /** Simple fixed policy: deal when empty; resolve the first card; enter when complete. */
  function playOut(seed: string): { state: GameState; steps: number } {
    const fullDeck = new Set(buildDeck())
    let state = createInitialState(seed, CANONICAL, FIXED_NOW)
    let steps = 0
    while (state.phase === 'playing' && steps < 500) {
      steps += 1
      let step: { state: GameState; result: GameResult }
      if (state.room.length === 0) {
        step = reducer(state, { type: 'DealRoom' })
      } else if (state.resolvedCount >= resolveTarget(state)) {
        step = reducer(state, { type: 'EnterNextRoom' })
      } else {
        const cardId = at(state.room, 0)
        if (cardId.endsWith('H')) {
          step = reducer(state, { type: 'DrinkPotion', cardId })
        } else if (cardId.endsWith('D')) {
          step = reducer(state, { type: 'EquipWeapon', cardId })
        } else {
          step = reducer(state, { type: 'FightMonster', cardId })
          if (step.result.type === 'InvalidAction') {
            step = reducer(state, { type: 'FightMonster', cardId, barehanded: true })
          }
        }
      }
      expect(step.result.type).not.toBe('InvalidAction')
      // Conservation invariant: no duplicate live cards, every live card is a
      // real deck member (discards/potions leave the union by design).
      const live = [
        ...step.state.dungeon,
        ...step.state.room,
        ...(step.state.weapon === null ? [] : [step.state.weapon]),
        ...step.state.killStack,
      ]
      expect(new Set(live).size).toBe(live.length)
      for (const id of live) expect(fullDeck.has(id)).toBe(true)
      state = step.state
    }
    return { state, steps }
  }

  it('plays a full run to a terminal state', () => {
    const { state, steps } = playOut('fullrun')
    expect(steps).toBeLessThan(500)
    expect(['won', 'lost']).toContain(state.phase)
  })

  it('is bit-for-bit reproducible for the same seed', () => {
    const a = playOut('fullrun')
    const b = playOut('fullrun')
    expect(a.state).toEqual(b.state)
    expect(a.steps).toBe(b.steps)
  })

  it('diverges between seeds', () => {
    const a = playOut('fullrun-one')
    const b = playOut('fullrun-two')
    expect(a.state).not.toEqual(b.state)
  })
})
