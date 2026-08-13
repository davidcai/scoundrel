/**
 * The 44-card Scoundrel deck and card metadata helpers.
 *
 * Per docs/rules.md "Setup & Card Values": standard 52-card deck minus both
 * jokers, all red face cards (J/Q/K of Hearts and Diamonds), and both red
 * Aces. Clubs/Spades are monsters (13 each), Diamonds are weapons (2–10),
 * Hearts are potions (2–10).
 */

import type { CardId, Rank, Suit } from './types'

const ALL_RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
]
const NUMBER_RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10']
const MONSTER_SUITS: readonly Suit[] = ['C', 'S']
const RED_SUITS: readonly Suit[] = ['D', 'H']

/** Total card count of a Scoundrel deck (52 - 6 red face - 2 red aces - 2 jokers... 44). */
export const DECK_SIZE = 44

/** Build the full 44-card deck in a deterministic canonical order. */
export function buildDeck(): CardId[] {
  const deck: CardId[] = []
  for (const suit of MONSTER_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push(`${rank}${suit}`)
    }
  }
  for (const suit of RED_SUITS) {
    for (const rank of NUMBER_RANKS) {
      deck.push(`${rank}${suit}`)
    }
  }
  return deck
}

/** Suit of a card — last character of the CardId ('8C' → 'C', '10D' → 'D'). */
export function suitOf(cardId: CardId): Suit {
  return cardId.slice(-1) as Suit
}

/** Rank of a card — all but the last character ('8C' → '8', '10D' → '10'). */
export function rankOf(cardId: CardId): Rank {
  return cardId.slice(0, -1) as Rank
}

/** Numeric value: face cards J=11, Q=12, K=13, A=14; number cards = face value. */
export function cardValue(cardId: CardId): number {
  const rank = rankOf(cardId)
  switch (rank) {
    case 'J':
      return 11
    case 'Q':
      return 12
    case 'K':
      return 13
    case 'A':
      return 14
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case '10':
      return Number(rank)
  }
}

/** Clubs and Spades are monsters. */
export function isMonster(cardId: CardId): boolean {
  const suit = suitOf(cardId)
  return suit === 'C' || suit === 'S'
}

/** Diamonds are weapons. */
export function isWeapon(cardId: CardId): boolean {
  return suitOf(cardId) === 'D'
}

/** Hearts are health potions. */
export function isPotion(cardId: CardId): boolean {
  return suitOf(cardId) === 'H'
}

/**
 * Seeded Fisher-Yates shuffle. Returns a new array; the input is not mutated.
 * `rng` is a mulberry32-style generator producing floats in [0, 1).
 */
export function shuffle(deck: readonly CardId[], rng: () => number): CardId[] {
  const out = [...deck]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a !== undefined && b !== undefined) {
      out[i] = b
      out[j] = a
    }
  }
  return out
}
