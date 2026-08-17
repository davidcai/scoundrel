import type { CardId, CardType, Rank, Suit } from './types';

export const SUITS: Suit[] = ['club', 'spade', 'diamond', 'heart'];

/** Card ranks per suit. Red cards (diamond/heart) only have 2–10 per rules. */
const RANKS_BY_SUIT: Record<Suit, Rank[]> = {
  club: ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'],
  spade: ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'],
  diamond: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
  heart: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
};

const VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  j: 11, q: 12, k: 13, a: 14,
};

const SUIT_LABEL: Record<Suit, string> = {
  club: 'Clubs', spade: 'Spades', diamond: 'Diamonds', heart: 'Hearts',
};

export function suitOf(id: CardId): Suit {
  return id.split('-')[0] as Suit;
}

export function rankOf(id: CardId): Rank {
  return id.split('-')[1] as Rank;
}

export function cardValue(id: CardId): number {
  return VALUE[rankOf(id)];
}

export function cardType(id: CardId): CardType {
  const suit = suitOf(id);
  if (suit === 'club' || suit === 'spade') return 'monster';
  if (suit === 'diamond') return 'weapon';
  return 'potion';
}

export const isMonster = (id: CardId): boolean => cardType(id) === 'monster';
export const isWeapon = (id: CardId): boolean => cardType(id) === 'weapon';
export const isPotion = (id: CardId): boolean => cardType(id) === 'potion';

/** The 44-card Scoundrel deck: black suits full 13, red suits 2–10. */
export function buildDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS_BY_SUIT[suit]) {
      deck.push(suit + '-' + rank);
    }
  }
  return deck;
}

export function suitLabel(suit: Suit): string {
  return SUIT_LABEL[suit];
}

/** "8 of Clubs" style label. */
export function cardLabel(id: CardId): string {
  return cardValue(id) + ' of ' + suitLabel(suitOf(id));
}

/** Screen-reader label: "8 of Clubs, monster, value 8". */
export function cardAriaLabel(id: CardId): string {
  return cardLabel(id) + ', ' + cardType(id) + ', value ' + cardValue(id);
}
