import type { CardId, Rank, Suit } from '../../engine/types'

/** Meaning language: clubs/spades are monsters, diamonds weapons, hearts potions. */
export const SUIT_META: Record<Suit, { name: string; meaning: string; cssClass: string }> = {
  C: { name: 'Clubs', meaning: 'monster', cssClass: 'club' },
  S: { name: 'Spades', meaning: 'monster', cssClass: 'spade' },
  D: { name: 'Diamonds', meaning: 'weapon', cssClass: 'diamond' },
  H: { name: 'Hearts', meaning: 'potion', cssClass: 'heart' },
}

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

const RANKS = Object.keys(RANK_VALUE) as Rank[]
const SUITS: Suit[] = ['C', 'S', 'D', 'H']

export interface ParsedCard {
  rank: Rank
  suit: Suit
  value: number
}

/** Parse a `${Rank}${Suit}` CardId ('8C', '10D', 'QH', 'AS'). Returns null on junk. */
export function parseCard(cardId: CardId): ParsedCard | null {
  const suit = cardId.slice(-1) as Suit
  const rank = cardId.slice(0, -1) as Rank
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) return null
  return { rank, suit, value: RANK_VALUE[rank] }
}

/** SR summary per spec US55: "8 of Clubs, monster, value 8". */
export function describeCard(parsed: ParsedCard): string {
  const { name, meaning } = SUIT_META[parsed.suit]
  return `${parsed.rank} of ${name}, ${meaning}, value ${String(parsed.value)}`
}
