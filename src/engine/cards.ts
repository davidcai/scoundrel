import type { CardId, CardKind, Rank, Suit } from './types';

export const MONSTER_SUITS: readonly Suit[] = ['club', 'spade'] as const;
export const WEAPON_SUIT: Suit = 'diamond';
export const POTION_SUIT: Suit = 'heart';

/** Clubs and spades keep all 13 ranks; diamonds and hearts only 2–10 (44 cards total). */
export const FULL_RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'j',
  'q',
  'k',
  'a',
] as const;
export const NUMBER_RANKS: readonly Rank[] = FULL_RANKS.slice(0, 9);

const RANK_VALUES: Record<Rank, number> = {
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
  a: 14,
};

const SUIT_NAMES: Record<Suit, string> = {
  club: 'Clubs',
  diamond: 'Diamonds',
  heart: 'Hearts',
  spade: 'Spades',
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  club: '♣',
  diamond: '♦',
  heart: '♥',
  spade: '♠',
};

const KINDS: Record<Suit, CardKind> = {
  club: 'monster',
  spade: 'monster',
  diamond: 'weapon',
  heart: 'potion',
};

/** Canonical 44-card deck (deterministic order, pre-shuffle). */
export function buildDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of ['club', 'spade'] as const) {
    for (const rank of FULL_RANKS) deck.push(`${suit}-${rank}` as CardId);
  }
  for (const suit of ['diamond', 'heart'] as const) {
    for (const rank of NUMBER_RANKS) deck.push(`${suit}-${rank}` as CardId);
  }
  return deck;
}

export function isCardId(value: string): value is CardId {
  return buildDeck().includes(value as CardId);
}

export function cardValue(cardId: CardId): number {
  return RANK_VALUES[cardRank(cardId)];
}

export function cardKind(cardId: CardId): CardKind {
  return KINDS[cardSuit(cardId)];
}

export function cardSuit(cardId: CardId): Suit {
  return cardId.slice(0, cardId.indexOf('-')) as Suit;
}

export function cardRank(cardId: CardId): Rank {
  return cardId.slice(cardId.indexOf('-') + 1) as Rank;
}

export function cardLabel(cardId: CardId): string {
  const rank = cardRank(cardId);
  const name =
    rank === 'j'
      ? 'Jack'
      : rank === 'q'
        ? 'Queen'
        : rank === 'k'
          ? 'King'
          : rank === 'a'
            ? 'Ace'
            : rank;
  return `${name} of ${SUIT_NAMES[cardSuit(cardId)]}`;
}

export function cardSymbol(cardId: CardId): string {
  return SUIT_SYMBOLS[cardSuit(cardId)];
}

export function isRedCard(cardId: CardId): boolean {
  const suit = cardSuit(cardId);
  return suit === 'diamond' || suit === 'heart';
}

/** ARIA label, e.g. "8 of Clubs, monster, value 8". */
export function cardAriaLabel(cardId: CardId): string {
  return `${cardLabel(cardId)}, ${cardKind(cardId)}, value ${cardValue(cardId)}`;
}

/** Sum of monster values across a list of cards (scoring on defeat). */
export function monsterSum(cards: readonly CardId[]): number {
  return cards.reduce((sum, card) => sum + (cardKind(card) === 'monster' ? cardValue(card) : 0), 0);
}
