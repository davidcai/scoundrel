import type { Card, Rank, Suit } from './types';

const SUIT_CODE: Record<Suit, string> = {
  clubs: 'C',
  spades: 'S',
  diamonds: 'D',
  hearts: 'H',
};

export function makeCard(suit: Suit, rank: Rank): Card {
  return { id: `${SUIT_CODE[suit]}${rank}`, suit, rank, value: rank };
}

export function buildDungeon(): Card[] {
  const cards: Card[] = [];
  const monsterRanks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const itemRanks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const r of monsterRanks) cards.push(makeCard('clubs', r));
  for (const r of monsterRanks) cards.push(makeCard('spades', r));
  for (const r of itemRanks) cards.push(makeCard('diamonds', r));
  for (const r of itemRanks) cards.push(makeCard('hearts', r));
  return cards;
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}