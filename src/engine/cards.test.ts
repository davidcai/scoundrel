import { describe, expect, it } from 'vitest'
import {
  CARD_IDS,
  DEFAULT_CONFIG,
  createInitialState,
  kindOf,
  numericValue,
  suitOf,
} from './index'
import type { CardId, Suit, Value } from './index'
import { cfg } from './testkit'

describe('deck composition (rules.md: 44 cards)', () => {
  it('contains exactly 44 unique cards', () => {
    expect(CARD_IDS).toHaveLength(44)
    expect(new Set(CARD_IDS).size).toBe(44)
  })

  it('contains exactly the canonical composition: clubs+spades 2..10/j/q/k/a, diamonds+hearts 2..10', () => {
    const expected: CardId[] = []
    const faces: Value[] = ['j', 'q', 'k', 'a']
    const numerics = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const
    for (const suit of ['club', 'spade'] as const) {
      for (const v of numerics) expected.push(`${suit}-${v}`)
      for (const v of faces) expected.push(`${suit}-${v}`)
    }
    for (const suit of ['diamond', 'heart'] as const) {
      for (const v of numerics) expected.push(`${suit}-${v}`)
    }
    expect([...CARD_IDS].sort()).toEqual(expected.sort())
  })

  it('createInitialState shuffles the full deck: dungeon is exactly CARD_IDS', () => {
    const s = createInitialState('deck-check', DEFAULT_CONFIG)
    expect([...s.dungeon].sort()).toEqual([...CARD_IDS].sort())
    expect(s.dungeon).toHaveLength(44)
  })

  it('createInitialState initializes the run state per contract', () => {
    const config = cfg()
    const s = createInitialState('hello', config)
    expect(s.seed).toBe('hello')
    expect(s.config).toEqual(config)
    expect(s.phase).toBe('playing')
    expect(s.hp).toBe(20)
    expect(s.maxHp).toBe(20)
    expect(s.room).toEqual([])
    expect(s.resolvedCount).toBe(0)
    expect(s.weapon).toBeNull()
    expect(s.killStack).toEqual([])
    expect(s.potionsUsedThisRoom).toBe(0)
    expect(s.ranAwayLastRoom).toBe(false)
    expect(s.turnCount).toBe(0)
    expect(s.runHighlights).toEqual({ monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 })
    expect(s.roomSnapshot).toBeNull()
  })
})

describe('card helpers', () => {
  it.each<[CardId, number]>([
    ['club-2', 2],
    ['club-9', 9],
    ['spade-10', 10],
    ['club-j', 11],
    ['spade-q', 12],
    ['club-k', 13],
    ['spade-a', 14],
    ['diamond-2', 2],
    ['diamond-10', 10],
    ['heart-2', 2],
    ['heart-10', 10],
  ])('numericValue(%s) === %i', (card, value) => {
    expect(numericValue(card)).toBe(value)
  })

  it.each<[CardId, Suit]>([
    ['club-j', 'club'],
    ['spade-a', 'spade'],
    ['diamond-7', 'diamond'],
    ['heart-3', 'heart'],
  ])('suitOf(%s) === %s', (card, suit) => {
    expect(suitOf(card)).toBe(suit)
  })

  it.each([
    ['club-2', 'monster'],
    ['spade-a', 'monster'],
    ['diamond-5', 'weapon'],
    ['heart-5', 'potion'],
  ] as const)('kindOf(%s) === %s', (card, kind) => {
    expect(kindOf(card)).toBe(kind)
  })
})

describe('DEFAULT_CONFIG (canonical rules.md)', () => {
  it('enforces canonical rules by default', () => {
    expect(DEFAULT_CONFIG).toEqual({
      runAwayMode: 'once',
      potionsPerRoom: 1,
      weaponDegradation: true,
    })
  })
})
