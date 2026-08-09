import type { Card, CardRole, Rank, Suit } from './types';

const SUITS: Suit[] = ['clubs', 'spades', 'diamonds', 'hearts'];

function ranksForSuit(suit: Suit): Rank[] {
  if (suit === 'diamonds' || suit === 'hearts') {
    return [2, 3, 4, 5, 6, 7, 8, 9, 10];
  }
  return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
}

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranksForSuit(suit)) {
      cards.push({ id: `${suit}-${rank}`, suit, rank, value: rank });
    }
  }
  return cards;
}

export function cardRole(card: Card): CardRole {
  if (card.suit === 'clubs' || card.suit === 'spades') return 'monster';
  if (card.suit === 'diamonds') return 'weapon';
  return 'potion';
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards: Card[], seed?: number): Card[] {
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}