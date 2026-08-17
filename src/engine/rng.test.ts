import { describe, expect, it } from 'vitest';
import { buildDeck } from './cards';
import { mulberry32, seedToUint32, shuffledDeck } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('returns values in [0, 1)', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedToUint32', () => {
  it('is deterministic and strips non-base36 characters', () => {
    expect(seedToUint32('abc')).toBe(seedToUint32('abc'));
    expect(seedToUint32('a-bc!')).toBe(seedToUint32('abc'));
  });
});

describe('shuffledDeck', () => {
  it('produces a permutation of the deck', () => {
    const deck = buildDeck();
    const shuffled = shuffledDeck(deck, mulberry32(7));
    expect(shuffled).toHaveLength(44);
    expect([...shuffled].sort()).toEqual([...deck].sort());
  });

  it('is deterministic given the same seed', () => {
    const deck = buildDeck();
    const a = shuffledDeck(deck, mulberry32(42));
    const b = shuffledDeck(deck, mulberry32(42));
    expect(a).toEqual(b);
  });
});
