import type { Card, Suit } from './types';

export const MAX_HEALTH = 20;
export const ROOM_SIZE = 4;

const SUITS: Suit[] = ['clubs', 'spades', 'diamonds', 'hearts'];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    const maxValue = suit === 'diamonds' || suit === 'hearts' ? 10 : 14;
    for (let value = 2; value <= maxValue; value++) {
      cards.push({ id: `${suit}-${value}`, suit, value });
    }
  }
  return cards;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function labelFor(value: number): string {
  switch (value) {
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 14:
      return 'A';
    default:
      return String(value);
  }
}
