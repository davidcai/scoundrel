/**
 * Card vocabulary for the Scoundrel rules engine.
 *
 * The deck is a fresh 44-card set (rules.md, "The Deck"): a standard 52-card
 * deck plus jokers, minus both jokers, all red face cards, and both red aces.
 */

export const SUITS = ['club', 'spade', 'diamond', 'heart'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'] as const;
export type Rank = (typeof RANKS)[number];

/** A card identifier such as `club-8`, matching the artwork filenames. */
export type CardId = `${Suit}-${Rank}`;

/** Monsters come from clubs and spades; weapons from diamonds; potions from hearts. */
export type CardKind = 'monster' | 'weapon' | 'potion';

/** Numerical values from rules.md: numbers equal face value; J=11, Q=12, K=13, A=14. */
const RANK_VALUES: Readonly<Record<Rank, number>> = {
  a: 14,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  j: 11,
  q: 12,
  k: 13,
};

/** Ranks that can be weapons or potions: the red face cards and red aces are removed. */
export const NUMBER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
export type NumberRank = (typeof NUMBER_RANKS)[number];

export function createCardId(suit: Suit, rank: Rank): CardId {
  return `${suit}-${rank}`;
}

export function isSuit(value: string): value is Suit {
  return (SUITS as readonly string[]).includes(value);
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export function isCardId(value: string): value is CardId {
  const separator = value.indexOf('-');
  if (separator < 0) return false;
  const suit = value.slice(0, separator);
  const rank = value.slice(separator + 1);
  return isSuit(suit) && isRank(rank);
}

export function splitCardId(card: CardId): { readonly suit: Suit; readonly rank: Rank } {
  const separator = card.indexOf('-');
  return {
    suit: card.slice(0, separator) as Suit,
    rank: card.slice(separator + 1) as Rank,
  };
}

export function cardSuit(card: CardId): Suit {
  return splitCardId(card).suit;
}

export function cardRank(card: CardId): Rank {
  return splitCardId(card).rank;
}

export function cardValue(card: CardId): number {
  return RANK_VALUES[cardRank(card)];
}

export function cardKind(card: CardId): CardKind {
  const suit = cardSuit(card);
  if (suit === 'club' || suit === 'spade') return 'monster';
  if (suit === 'diamond') return 'weapon';
  return 'potion';
}

export function isMonster(card: CardId): boolean {
  return cardKind(card) === 'monster';
}

export function isWeaponCard(card: CardId): boolean {
  return cardKind(card) === 'weapon';
}

export function isPotionCard(card: CardId): boolean {
  return cardKind(card) === 'potion';
}

/**
 * Canonical deck order from the Phase 1 foundation decisions:
 * clubs A–K, spades A–K, diamonds 2–10, hearts 2–10.
 */
export const CANONICAL_DECK: readonly CardId[] = Object.freeze([
  ...RANKS.map((rank) => createCardId('club', rank)),
  ...RANKS.map((rank) => createCardId('spade', rank)),
  ...NUMBER_RANKS.map((rank) => createCardId('diamond', rank)),
  ...NUMBER_RANKS.map((rank) => createCardId('heart', rank)),
]);
