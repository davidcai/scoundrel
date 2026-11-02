import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DECK,
  NUMBER_RANKS,
  RANKS,
  SUITS,
  cardKind,
  cardRank,
  cardSuit,
  cardValue,
  createCardId,
  isCardId,
  isMonster,
  isPotionCard,
  isWeaponCard,
} from './index';

describe('canonical 44-card deck', () => {
  it('contains 44 unique cards', () => {
    expect(CANONICAL_DECK).toHaveLength(44);
    expect(new Set(CANONICAL_DECK).size).toBe(44);
  });

  it('is ordered clubs A–K, spades A–K, diamonds 2–10, hearts 2–10', () => {
    const expected = [
      ...RANKS.map((rank) => `club-${rank}`),
      ...RANKS.map((rank) => `spade-${rank}`),
      ...NUMBER_RANKS.map((rank) => `diamond-${rank}`),
      ...NUMBER_RANKS.map((rank) => `heart-${rank}`),
    ];

    expect(CANONICAL_DECK).toEqual(expected);
  });

  it('contains all 13 clubs and spades as monsters and only 2–10 diamonds and hearts', () => {
    expect(CANONICAL_DECK.filter((card) => cardSuit(card) === 'club')).toHaveLength(13);
    expect(CANONICAL_DECK.filter((card) => cardSuit(card) === 'spade')).toHaveLength(13);
    expect(CANONICAL_DECK.filter((card) => cardSuit(card) === 'diamond')).toHaveLength(9);
    expect(CANONICAL_DECK.filter((card) => cardSuit(card) === 'heart')).toHaveLength(9);
  });

  it('removes red face cards and red aces but keeps black face cards and aces', () => {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const card = createCardId(suit, rank);
        const isRed = suit === 'diamond' || suit === 'heart';
        const isFaceOrAce = rank === 'a' || rank === 'j' || rank === 'q' || rank === 'k';
        expect(CANONICAL_DECK.includes(card)).toBe(!(isRed && isFaceOrAce));
      }
    }
  });

  it('keeps jokers out of the deck', () => {
    expect(CANONICAL_DECK.some((card) => card.includes('joker'))).toBe(false);
  });
});

describe('card values and kinds', () => {
  it('uses number values and J=11, Q=12, K=13, A=14', () => {
    expect(cardValue('club-2')).toBe(2);
    expect(cardValue('club-10')).toBe(10);
    expect(cardValue('club-j')).toBe(11);
    expect(cardValue('club-q')).toBe(12);
    expect(cardValue('club-k')).toBe(13);
    expect(cardValue('club-a')).toBe(14);
  });

  it('maps suits to card kinds', () => {
    expect(cardKind('club-5')).toBe('monster');
    expect(cardKind('spade-a')).toBe('monster');
    expect(cardKind('diamond-7')).toBe('weapon');
    expect(cardKind('heart-9')).toBe('potion');
  });

  it('exposes monster, weapon, and potion predicates', () => {
    expect(isMonster('club-5')).toBe(true);
    expect(isMonster('spade-k')).toBe(true);
    expect(isMonster('diamond-5')).toBe(false);
    expect(isMonster('heart-5')).toBe(false);
    expect(isWeaponCard('diamond-2')).toBe(true);
    expect(isWeaponCard('club-2')).toBe(false);
    expect(isPotionCard('heart-10')).toBe(true);
    expect(isPotionCard('spade-10')).toBe(false);
  });

  it('splits card identifiers back into suit and rank', () => {
    expect(cardSuit('spade-10')).toBe('spade');
    expect(cardRank('spade-10')).toBe('10');
  });

  it('recognizes valid card identifiers only', () => {
    expect(isCardId('club-a')).toBe(true);
    expect(isCardId('diamond-10')).toBe(true);
    expect(isCardId('joker-a')).toBe(false);
    expect(isCardId('club-1')).toBe(false);
    expect(isCardId('club-')).toBe(false);
    expect(isCardId('club-a-b')).toBe(false);
    expect(isCardId('Club-a')).toBe(false);
  });
});
