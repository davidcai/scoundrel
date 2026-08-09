import type { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['clubs', 'spades', 'diamonds', 'hearts'];

const SUIT_LETTER: Record<Suit, string> = {
  clubs: 'C',
  spades: 'S',
  diamonds: 'D',
  hearts: 'H',
};

const RANK_MIN = 2;
const RANK_MAX = 14; // J=11, Q=12, K=13, A=14

/**
 * Build the 44-card Scoundrel deck.
 * Clubs (13) + Spades (13) + Diamonds (9) + Hearts (9) = 44.
 * All red face cards (J/Q/K/A of diamonds and hearts) are removed.
 */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    const isRed = suit === 'diamonds' || suit === 'hearts';
    for (let rank = RANK_MIN; rank <= RANK_MAX; rank++) {
      // Remove all red face cards and red aces (ranks 11–14) from the red suits.
      if (isRed && rank >= 11) continue;
      const card: Card = {
        id: `${SUIT_LETTER[suit]}${rank}`,
        suit,
        rank: rank as Rank,
        value: rank,
      };
      deck.push(card);
    }
  }
  if (deck.length !== 44) {
    throw new Error(`buildDeck: expected 44 cards, got ${deck.length}`);
  }
  return deck;
}

/** Standard mulberry32 seeded PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using the given RNG.
 * Returns a NEW array; the input array is not mutated.
 */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Human-readable rank label: "2".."10","J","Q","K","A". */
export function rankLabel(rank: Rank): string {
  switch (rank) {
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    default:
      return String(rank);
  }
}
