import { describe, expect, it } from 'vitest'

import { mulberry32, seedToUint32 } from './prng'
import {
  DECK_SIZE,
  buildDeck,
  cardValue,
  isMonster,
  isPotion,
  isWeapon,
  rankOf,
  shuffle,
  suitOf,
} from './deck'

describe('buildDeck', () => {
  it('contains exactly 44 unique cards', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(44)
    expect(DECK_SIZE).toBe(44)
    expect(new Set(deck).size).toBe(44)
  })

  it('keeps all 13 Clubs and all 13 Spades (monsters incl. J/Q/K/A)', () => {
    const deck = buildDeck()
    for (const suit of ['C', 'S']) {
      for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
        expect(deck).toContain(`${rank}${suit}`)
      }
    }
  })

  it('keeps only 2–10 of Diamonds and Hearts', () => {
    const deck = buildDeck()
    for (const suit of ['D', 'H']) {
      for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10']) {
        expect(deck).toContain(`${rank}${suit}`)
      }
      for (const rank of ['J', 'Q', 'K', 'A']) {
        expect(deck).not.toContain(`${rank}${suit}`)
      }
    }
  })

  it('removes red face cards, red Aces, and jokers', () => {
    const deck = buildDeck()
    const removed = ['JH', 'QH', 'KH', 'JD', 'QD', 'KD', 'AH', 'AD']
    for (const cardId of removed) {
      expect(deck).not.toContain(cardId)
    }
    expect(deck.some((c) => c.includes('JOKER'))).toBe(false)
  })
})

describe('card metadata', () => {
  it('parses suit and rank (incl. two-char rank 10)', () => {
    expect(suitOf('8C')).toBe('C')
    expect(suitOf('10D')).toBe('D')
    expect(rankOf('8C')).toBe('8')
    expect(rankOf('10D')).toBe('10')
    expect(rankOf('QH')).toBe('Q')
  })

  it('computes values: J=11, Q=12, K=13, A=14, numbers = face value', () => {
    expect(cardValue('2H')).toBe(2)
    expect(cardValue('10C')).toBe(10)
    expect(cardValue('JC')).toBe(11)
    expect(cardValue('QS')).toBe(12)
    expect(cardValue('KS')).toBe(13)
    expect(cardValue('AC')).toBe(14)
  })

  it('classifies by suit: C/S monsters, D weapons, H potions', () => {
    expect(isMonster('AC')).toBe(true)
    expect(isMonster('2S')).toBe(true)
    expect(isMonster('5D')).toBe(false)
    expect(isMonster('5H')).toBe(false)

    expect(isWeapon('2D')).toBe(true)
    expect(isWeapon('10D')).toBe(true)
    expect(isWeapon('2C')).toBe(false)

    expect(isPotion('2H')).toBe(true)
    expect(isPotion('10H')).toBe(true)
    expect(isPotion('2S')).toBe(false)
  })
})

describe('shuffle', () => {
  it('is deterministic for a given seed', () => {
    const deck = buildDeck()
    const a = shuffle(deck, mulberry32(seedToUint32('alpha')))
    const b = shuffle(deck, mulberry32(seedToUint32('alpha')))
    expect(a).toEqual(b)
  })

  it('diverges for distinct seeds', () => {
    const deck = buildDeck()
    const a = shuffle(deck, mulberry32(seedToUint32('alpha')))
    const b = shuffle(deck, mulberry32(seedToUint32('omega')))
    expect(a).not.toEqual(b)
    expect([...a].sort()).toEqual([...b].sort())
  })

  it('does not mutate the input deck', () => {
    const deck = buildDeck()
    const before = [...deck]
    shuffle(deck, mulberry32(123))
    expect(deck).toEqual(before)
  })

  it('preserves the full card set as a permutation', () => {
    const deck = buildDeck()
    const shuffled = shuffle(deck, mulberry32(999))
    expect(shuffled).toHaveLength(deck.length)
    expect([...shuffled].sort()).toEqual([...deck].sort())
  })
})
