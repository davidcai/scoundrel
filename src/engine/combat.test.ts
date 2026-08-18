import { describe, expect, it } from 'vitest'
import { previewFightMonster, reduce } from './index'
import { cfg, makeState } from './testkit'

describe('combat math (Q41a: damage = max(0, monster − weapon))', () => {
  it('weapon fight takes the difference as damage and stacks the monster', () => {
    const s = makeState({ room: ['club-8'], weapon: 'diamond-5', hp: 20 })
    const { state, result } = reduce(s, { type: 'FightMonster', cardId: 'club-8' })
    expect(result).toEqual({
      type: 'MonsterDefeated',
      cardId: 'club-8',
      damage: 3,
      weaponBroke: false,
      usedWeaponId: 'diamond-5',
    })
    expect(state.hp).toBe(17)
    expect(state.weapon).toBe('diamond-5')
    expect(state.killStack).toEqual(['club-8'])
    expect(state.room).toEqual([])
    expect(state.resolvedCount).toBe(1)
    expect(state.runHighlights.monstersKilled).toBe(1)
  })

  it('stronger weapons nullify weaker monsters (damage floors at 0)', () => {
    const s = makeState({ room: ['club-2'], weapon: 'diamond-9', hp: 20 })
    const { state, result } = reduce(s, { type: 'FightMonster', cardId: 'club-2' })
    expect(result.type).toBe('MonsterDefeated')
    if (result.type === 'MonsterDefeated') expect(result.damage).toBe(0)
    expect(state.hp).toBe(20)
    expect(state.killStack).toEqual(['club-2'])
  })

  it('barehanded fight takes full monster value and discards the monster', () => {
    const s = makeState({ room: ['spade-10'], hp: 20 })
    const { state, result } = reduce(s, { type: 'FightMonster', cardId: 'spade-10' })
    expect(result).toEqual({
      type: 'MonsterDefeated',
      cardId: 'spade-10',
      damage: 10,
      weaponBroke: false,
      usedWeaponId: undefined,
    })
    expect(state.hp).toBe(10)
    expect(state.killStack).toEqual([])
  })

  it.each([
    { monster: 'club-7' as const, weapon: 'diamond-7' as const, expected: 0 },
    { monster: 'club-8' as const, weapon: 'diamond-7' as const, expected: 1 },
    { monster: 'spade-a' as const, weapon: 'diamond-2' as const, expected: 12 },
  ])(
    'weapon $weapon vs $monster deals $expected damage',
    ({ monster, weapon, expected }) => {
      const s = makeState({ room: [monster], weapon, hp: 20 })
      const { state, result } = reduce(s, { type: 'FightMonster', cardId: monster })
      expect(result.type).toBe('MonsterDefeated')
      expect(state.hp).toBe(20 - expected)
    },
  )
})

describe('barehanded is always a legal option (Q41a)', () => {
  it('barehanded with a weapon equipped: full damage, kill threshold preserved', () => {
    const s = makeState({
      room: ['spade-3'],
      weapon: 'diamond-5',
      killStack: ['club-9'],
      hp: 20,
    })
    const { state, result } = reduce(s, {
      type: 'FightMonster',
      cardId: 'spade-3',
      barehanded: true,
    })
    expect(result.type).toBe('MonsterDefeated')
    if (result.type === 'MonsterDefeated') {
      expect(result.damage).toBe(3)
      expect(result.usedWeaponId).toBeUndefined()
    }
    expect(state.hp).toBe(17)
    // Monster fought barehanded is discarded, not stacked — threshold intact.
    expect(state.killStack).toEqual(['club-9'])
  })
})

describe('weapon degradation (only strictly-weaker monsters than the last kill)', () => {
  const armed = makeState({
    room: ['club-9', 'club-8', 'club-7'],
    weapon: 'diamond-2',
    killStack: ['spade-8'], // last kill value 8
    hp: 20,
  })

  it('blocks a stronger monster (9 >= 8)', () => {
    const { state, result } = reduce(armed, { type: 'FightMonster', cardId: 'club-9' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'weapon-degraded' })
    expect(state).toBe(armed) // invalid actions never mutate
  })

  it('blocks an equal monster (8 >= 8) — must be strictly weaker', () => {
    const { result } = reduce(armed, { type: 'FightMonster', cardId: 'club-8' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'weapon-degraded' })
  })

  it('allows a weaker monster (7 < 8) and lowers the threshold', () => {
    const { state, result } = reduce(armed, { type: 'FightMonster', cardId: 'club-7' })
    expect(result.type).toBe('MonsterDefeated')
    expect(state.killStack).toEqual(['spade-8', 'club-7'])
    // Chain: now only monsters < 7 are legal.
    const blocked = reduce(state, { type: 'FightMonster', cardId: 'club-8' })
    expect(blocked.result).toEqual({ type: 'InvalidAction', reason: 'weapon-degraded' })
  })

  it('fresh weapon (empty kill stack) can fight anything', () => {
    const s = makeState({ room: ['spade-a'], weapon: 'diamond-2', hp: 20 })
    const { result } = reduce(s, { type: 'FightMonster', cardId: 'spade-a' })
    expect(result.type).toBe('MonsterDefeated')
  })

  it('degradation toggle off allows any monster regardless of threshold', () => {
    const s = makeState({
      config: cfg({ weaponDegradation: false }),
      room: ['club-9'],
      weapon: 'diamond-2',
      killStack: ['spade-8'],
      hp: 20,
    })
    const { result } = reduce(s, { type: 'FightMonster', cardId: 'club-9' })
    expect(result.type).toBe('MonsterDefeated')
  })
})

describe('weapon swap discards weapon + entire kill stack (Q42a)', () => {
  it('equipping a new diamond discards the old weapon and its stack', () => {
    const s = makeState({
      room: ['diamond-9'],
      weapon: 'diamond-3',
      killStack: ['club-7', 'club-5'],
      hp: 20,
    })
    const { state, result } = reduce(s, { type: 'EquipWeapon', cardId: 'diamond-9' })
    expect(result).toEqual({
      type: 'WeaponEquipped',
      cardId: 'diamond-9',
      discardedWeaponId: 'diamond-3',
      discardedMonsterIds: ['club-7', 'club-5'],
    })
    expect(state.weapon).toBe('diamond-9')
    expect(state.killStack).toEqual([])
    expect(state.room).toEqual([])
    expect(state.resolvedCount).toBe(1)
  })

  it('new weapon starts fresh: previously-degraded targets are legal again', () => {
    const s = makeState({
      room: ['diamond-9', 'club-a'],
      weapon: 'diamond-3',
      killStack: ['club-2'], // degraded: only monsters < 2 were legal
      hp: 20,
    })
    const equipped = reduce(s, { type: 'EquipWeapon', cardId: 'diamond-9' }).state
    const fought = reduce(equipped, { type: 'FightMonster', cardId: 'club-a' })
    expect(fought.result.type).toBe('MonsterDefeated')
    if (fought.result.type === 'MonsterDefeated') expect(fought.result.damage).toBe(5)
  })

  it('first equip has nothing to discard', () => {
    const s = makeState({ room: ['diamond-4'], hp: 20 })
    const { state, result } = reduce(s, { type: 'EquipWeapon', cardId: 'diamond-4' })
    expect(result).toEqual({
      type: 'WeaponEquipped',
      cardId: 'diamond-4',
      discardedWeaponId: undefined,
      discardedMonsterIds: [],
    })
    expect(state.weapon).toBe('diamond-4')
  })
})

describe('health potions (one per room, capped at maxHp)', () => {
  it('drinks a potion and heals up to its value', () => {
    const s = makeState({ room: ['heart-7'], hp: 12 })
    const { state, result } = reduce(s, { type: 'DrinkPotion', cardId: 'heart-7' })
    expect(result).toEqual({ type: 'PotionQuaffed', cardId: 'heart-7', healed: 7, wasted: false })
    expect(state.hp).toBe(19)
    expect(state.potionsUsedThisRoom).toBe(1)
  })

  it('healing is capped at 20', () => {
    const s = makeState({ room: ['heart-5'], hp: 19 })
    const { state, result } = reduce(s, { type: 'DrinkPotion', cardId: 'heart-5' })
    expect(result).toEqual({ type: 'PotionQuaffed', cardId: 'heart-5', healed: 1, wasted: false })
    expect(state.hp).toBe(20)
  })

  it('second potion in the same room is wasted: no heal, still resolves the card', () => {
    const s = makeState({ room: ['heart-7', 'heart-9'], hp: 10 })
    const first = reduce(s, { type: 'DrinkPotion', cardId: 'heart-7' })
    expect(first.result).toEqual({
      type: 'PotionQuaffed',
      cardId: 'heart-7',
      healed: 7,
      wasted: false,
    })
    const second = reduce(first.state, { type: 'DrinkPotion', cardId: 'heart-9' })
    expect(second.result).toEqual({
      type: 'PotionQuaffed',
      cardId: 'heart-9',
      healed: 0,
      wasted: true,
    })
    expect(second.state.hp).toBe(17)
    expect(second.state.room).toEqual([])
    expect(second.state.resolvedCount).toBe(2)
    expect(second.state.runHighlights.potionsWasted).toBe(1)
  })

  it('potionsPerRoom: Infinity allows multiple healing potions in one room', () => {
    const s = makeState({
      config: cfg({ potionsPerRoom: Number.POSITIVE_INFINITY }),
      room: ['heart-3', 'heart-4'],
      hp: 5,
    })
    const first = reduce(s, { type: 'DrinkPotion', cardId: 'heart-3' })
    const second = reduce(first.state, { type: 'DrinkPotion', cardId: 'heart-4' })
    expect(second.result).toEqual({
      type: 'PotionQuaffed',
      cardId: 'heart-4',
      healed: 4,
      wasted: false,
    })
    expect(second.state.hp).toBe(12)
  })
})

describe('damage preview (Q17d)', () => {
  const s = makeState({
    room: ['club-8', 'diamond-2'],
    weapon: 'diamond-5',
    killStack: ['club-9'],
    hp: 20,
  })

  it('previews weapon damage without dispatching', () => {
    expect(previewFightMonster(s, 'club-8', false)).toEqual({ legal: true, damage: 3 })
  })

  it('previews barehanded damage even with a weapon equipped', () => {
    expect(previewFightMonster(s, 'club-8', true)).toEqual({ legal: true, damage: 8 })
  })

  it('flags degraded fights as illegal, no weapon means full damage', () => {
    const degraded = makeState({
      room: ['club-a'],
      weapon: 'diamond-5',
      killStack: ['club-9'],
    })
    expect(previewFightMonster(degraded, 'club-a', false)).toEqual({
      legal: false,
      damage: 9,
      reason: 'weapon-degraded',
    })
    const noWeapon = makeState({ room: ['club-a'] })
    expect(previewFightMonster(noWeapon, 'club-a', false)).toEqual({ legal: true, damage: 14 })
  })

  it('rejects non-monsters, cards not in the room, and terminal phases', () => {
    expect(previewFightMonster(s, 'diamond-2', false)).toEqual({
      legal: false,
      damage: 0,
      reason: 'not-a-monster',
    })
    expect(previewFightMonster(s, 'spade-3', false)).toEqual({
      legal: false,
      damage: 0,
      reason: 'card-not-in-room',
    })
    expect(previewFightMonster(makeState({ phase: 'won' }), 'club-8', true)).toEqual({
      legal: false,
      damage: 0,
      reason: 'not-playing',
    })
  })
})

describe('invalid card actions (InvalidAction, never throw)', () => {
  const s = makeState({ room: ['club-5', 'heart-5', 'diamond-5'], hp: 20 })

  it.each([
    [{ type: 'FightMonster', cardId: 'heart-5' } as const, 'not-a-monster'],
    [{ type: 'FightMonster', cardId: 'diamond-5' } as const, 'not-a-monster'],
    [{ type: 'DrinkPotion', cardId: 'club-5' } as const, 'not-a-potion'],
    [{ type: 'EquipWeapon', cardId: 'heart-5' } as const, 'not-a-weapon'],
    [{ type: 'FightMonster', cardId: 'spade-3' } as const, 'card-not-in-room'],
    [{ type: 'DrinkPotion', cardId: 'heart-9' } as const, 'card-not-in-room'],
    [{ type: 'EquipWeapon', cardId: 'diamond-9' } as const, 'card-not-in-room'],
  ])('%o is rejected with %s', (action, reason) => {
    const { state, result } = reduce(s, action)
    expect(result).toEqual({ type: 'InvalidAction', reason })
    expect(state).toBe(s)
  })

  it('rejecting card actions once the run is over', () => {
    const won = makeState({ phase: 'won', room: ['club-5'] })
    const { result } = reduce(won, { type: 'FightMonster', cardId: 'club-5' })
    expect(result).toEqual({ type: 'InvalidAction', reason: 'not-playing' })
  })
})
