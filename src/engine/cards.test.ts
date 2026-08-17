import { describe, expect, it } from 'vitest';
import { buildDeck, cardAriaLabel, cardLabel, cardType, cardValue, isMonster } from './cards';

describe('buildDeck', () => {
  it('builds exactly 44 unique cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(44);
    expect(new Set(deck).size).toBe(44);
  });

  it('gives black suits 13 cards and red suits 9 cards', () => {
    const deck = buildDeck();
    for (const suit of ['club', 'spade']) {
      const count = deck.filter((id) => id.startsWith(suit + '-')).length;
      expect(count).toBe(13);
    }
    for (const suit of ['diamond', 'heart']) {
      const count = deck.filter((id) => id.startsWith(suit + '-')).length;
      expect(count).toBe(9);
    }
  });

  it('excludes red face cards and red aces', () => {
    const deck = new Set(buildDeck());
    expect(deck.has('diamond-a')).toBe(false);
    expect(deck.has('diamond-j')).toBe(false);
    expect(deck.has('diamond-q')).toBe(false);
    expect(deck.has('diamond-k')).toBe(false);
    expect(deck.has('heart-a')).toBe(false);
    expect(deck.has('heart-j')).toBe(false);
    expect(deck.has('heart-q')).toBe(false);
    expect(deck.has('heart-k')).toBe(false);
  });
});

describe('cardValue', () => {
  it('maps faces and aces per the rules', () => {
    expect(cardValue('club-2')).toBe(2);
    expect(cardValue('spade-10')).toBe(10);
    expect(cardValue('club-j')).toBe(11);
    expect(cardValue('club-q')).toBe(12);
    expect(cardValue('club-k')).toBe(13);
    expect(cardValue('spade-a')).toBe(14);
  });
});

describe('cardType', () => {
  it('classifies clubs and spades as monsters, diamonds as weapons, hearts as potions', () => {
    expect(cardType('club-8')).toBe('monster');
    expect(cardType('spade-3')).toBe('monster');
    expect(cardType('diamond-5')).toBe('weapon');
    expect(cardType('heart-2')).toBe('potion');
    expect(isMonster('spade-k')).toBe(true);
  });
});

describe('labels', () => {
  it('produces a human label', () => {
    expect(cardLabel('heart-7')).toBe('7 of Hearts');
  });
  it('produces an accessible label', () => {
    expect(cardAriaLabel('club-8')).toBe('8 of Clubs, monster, value 8');
  });
});
