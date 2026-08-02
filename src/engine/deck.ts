import type { Card, Suit } from './types';

const RANK_NAMES: Record<number, string> = {
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
};

function rankName(rank: number): string {
  return RANK_NAMES[rank] ?? String(rank);
}

function makeCard(suit: Suit, rank: number): Card {
  const name = rankName(rank);
  return { suit, rank, value: rank, id: `${name}_of_${suit}` };
}

/**
 * Builds the 44-card Scoundrel dungeon:
 * all Clubs & Spades (2..Ace) plus Diamonds & Hearts 2..10 only.
 */
export function buildDungeon(): Card[] {
  const cards: Card[] = [];
  for (const suit of ['spades', 'clubs'] as const) {
    for (let rank = 2; rank <= 14; rank++) cards.push(makeCard(suit, rank));
  }
  for (const suit of ['diamonds', 'hearts'] as const) {
    for (let rank = 2; rank <= 10; rank++) cards.push(makeCard(suit, rank));
  }
  return cards;
}

/** Deterministic PRNG (mulberry32) so games/tests can be replayed by seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
