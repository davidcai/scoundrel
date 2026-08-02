/**
 * Card model for Scoundrel.
 *
 * Rule reference (docs/rules.md, "Setup & Card Values"):
 *   Take a standard 52-card deck and remove both Jokers, all red face cards
 *   (Jack, Queen, King of Hearts and Diamonds), and both red Aces.
 *   You are left with 44 cards.
 */

export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';

/** Numeric card value: 2–10 face value, J=11, Q=12, K=13, A=14. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  /** Stable identity (e.g. "s14"), used as a UI key and for action targeting. */
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  spades: '♠',
  diamonds: '♦',
  hearts: '♥',
};

const SUIT_CODE: Record<Suit, string> = {
  clubs: 'c',
  spades: 's',
  diamonds: 'd',
  hearts: 'h',
};

const RANK_LABELS: Partial<Record<Rank, string>> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank] ?? String(rank);
}

export function cardName(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

/** Clubs & Spades: inflict damage equal to their numerical value. */
export function isMonster(card: Card): boolean {
  return card.suit === 'clubs' || card.suit === 'spades';
}

/** Diamonds: weapons, strength equal to their number value (2–10). */
export function isWeapon(card: Card): boolean {
  return card.suit === 'diamonds';
}

/** Hearts: health potions, restore health equal to the card's value. */
export function isPotion(card: Card): boolean {
  return card.suit === 'hearts';
}

function makeCard(suit: Suit, rank: Rank): Card {
  return { id: `${SUIT_CODE[suit]}${rank}`, suit, rank };
}

const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Builds the 44-card Dungeon in canonical (unshuffled) order.
 *
 * Black suits keep every rank (2–A). Red suits drop the face cards and the
 * Ace, so hearts and diamonds only ever run 2–10 — which is exactly why the
 * rules describe weapon strength as "2–10".
 */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ['clubs', 'spades'] as const) {
    for (const rank of ALL_RANKS) deck.push(makeCard(suit, rank));
  }
  for (const suit of ['diamonds', 'hearts'] as const) {
    for (const rank of ALL_RANKS) {
      if (rank > 10) continue; // no red Jacks, Queens, Kings or Aces
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}
