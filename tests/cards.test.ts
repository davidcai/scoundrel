import { describe, expect, it } from 'vitest';
import {
  buildDeck,
  cardName,
  isMonster,
  isPotion,
  isWeapon,
  rankLabel,
} from '../src/game/cards.js';

describe('deck construction', () => {
  const deck = buildDeck();

  it('leaves exactly 44 cards', () => {
    expect(deck).toHaveLength(44);
  });

  it('has no duplicates', () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(44);
  });

  it('keeps every rank of both black suits', () => {
    for (const suit of ['clubs', 'spades'] as const) {
      const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect(ranks.sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
  });

  it('removes red face cards and red aces', () => {
    for (const suit of ['diamonds', 'hearts'] as const) {
      const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect(ranks.sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('splits into 26 monsters, 9 weapons and 9 potions', () => {
    expect(deck.filter(isMonster)).toHaveLength(26);
    expect(deck.filter(isWeapon)).toHaveLength(9);
    expect(deck.filter(isPotion)).toHaveLength(9);
  });
});

describe('card values', () => {
  it('labels face cards and aces', () => {
    expect(rankLabel(10)).toBe('10');
    expect(rankLabel(11)).toBe('J');
    expect(rankLabel(12)).toBe('Q');
    expect(rankLabel(13)).toBe('K');
    expect(rankLabel(14)).toBe('A');
  });

  it('renders a readable name', () => {
    const ace = buildDeck().find((c) => c.id === 's14');
    expect(cardName(ace!)).toBe('A♠');
  });
});
