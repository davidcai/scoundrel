import { describe, expect, it } from 'vitest';
import {
  CANONICAL_DECK,
  createDungeon,
  createInitialState,
  hashSeed,
  isValidSeed,
  mulberry32,
  normalizeSeed,
  parseSeed,
  requireSeed,
  shuffleDeck,
} from './index';

describe('seed validation and normalization', () => {
  it('trims whitespace and applies NFC normalization', () => {
    expect(normalizeSeed('  scoundrel  ')).toBe('scoundrel');
    expect(normalizeSeed('  e\u0301  ')).toBe('\u00e9');
  });

  it('accepts 1–64 characters after trimming and rejects other lengths', () => {
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('   ')).toBeNull();
    expect(parseSeed('a')).toBe('a');
    expect(parseSeed('a'.repeat(64))).toBe('a'.repeat(64));
    expect(parseSeed('a'.repeat(65))).toBeNull();
    expect(parseSeed(`  ${'a'.repeat(64)}  `)).toBe('a'.repeat(64));
    expect(isValidSeed('seed-123')).toBe(true);
    expect(isValidSeed('')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(parseSeed('Abc')).not.toBe(parseSeed('abc'));
  });

  it('canonicalizes decomposed and precomposed input to the same seed', () => {
    expect(parseSeed('e\u0301')).toBe(parseSeed('\u00e9'));
  });
});

describe('seed hashing and pseudo-random generation', () => {
  it('hashes with 32-bit FNV-1a over UTF-8 bytes', () => {
    // Reference FNV-1a 32-bit values.
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
    expect(hashSeed('\u00e9')).not.toBe(hashSeed('e'));
  });

  it('returns a uint32 from the seed hash', () => {
    for (const seed of ['a', 'scoundrel', '你好', '\u00e9']) {
      const hash = hashSeed(seed);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('produces the same mulberry32 sequence for the same seed', () => {
    const first = mulberry32(12345);
    const second = mulberry32(12345);
    const firstValues = [first(), first(), first()];
    const secondValues = [second(), second(), second()];

    expect(firstValues).toEqual(secondValues);
    for (const value of firstValues) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different mulberry32 sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('deterministic deck ordering', () => {
  it('shuffles a permutation of the input without mutating it', () => {
    const input = [...CANONICAL_DECK];
    const shuffled = shuffleDeck(input, 'permutation-seed');

    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort()).toEqual([...input].sort());
    expect(input).toEqual([...CANONICAL_DECK]);
  });

  it('produces the same deck for the same seed and a different deck for another seed', () => {
    expect(shuffleDeck(CANONICAL_DECK, 'same-seed')).toEqual(
      shuffleDeck(CANONICAL_DECK, 'same-seed'),
    );
    expect(shuffleDeck(CANONICAL_DECK, 'seed-one')).not.toEqual(
      shuffleDeck(CANONICAL_DECK, 'seed-two'),
    );
  });

  it('treats NFC-equivalent seeds as the same dungeon and keeps case significant', () => {
    expect(createDungeon('e\u0301')).toEqual(createDungeon('\u00e9'));
    expect(createDungeon('Case')).not.toEqual(createDungeon('case'));
  });

  it('creates the same initial state for a repeated seed', () => {
    const first = createInitialState('determinism-seed');
    const second = createInitialState('determinism-seed');

    expect(second).toEqual(first);
    expect(second.dungeon).toEqual(first.dungeon);
    expect(second.room).toEqual(first.room);
  });

  it('creates a different initial dungeon for a different seed', () => {
    const first = createInitialState('determinism-seed');
    const second = createInitialState('another-seed');

    expect(second.dungeon).not.toEqual(first.dungeon);
  });
});

describe('shared seed validation path', () => {
  it('gives every exported deck builder the same order as createInitialState', () => {
    for (const seed of ['shared-path', '  padded seed  ', 'Case-Sensitive']) {
      const initial = createInitialState(seed);
      const fullDeck = [...initial.room.cards.map((roomCard) => roomCard.card), ...initial.dungeon];

      expect(createDungeon(seed)).toEqual(fullDeck);
      expect(shuffleDeck(CANONICAL_DECK, seed)).toEqual(fullDeck);
      expect(initial.seed).toBe(requireSeed(seed));
    }
  });

  it('rejects invalid seeds consistently in every exported entry point', () => {
    for (const invalid of ['', '   ', 'a'.repeat(65)]) {
      expect(parseSeed(invalid)).toBeNull();
      expect(() => requireSeed(invalid)).toThrow(RangeError);
      expect(() => createInitialState(invalid)).toThrow(RangeError);
      expect(() => createDungeon(invalid)).toThrow(RangeError);
      expect(() => shuffleDeck(CANONICAL_DECK, invalid)).toThrow(RangeError);
    }
  });

  it('accepts the 1–64 character boundaries everywhere', () => {
    for (const valid of ['a', 'a'.repeat(64), `  ${'a'.repeat(64)}  `]) {
      const canonical = requireSeed(valid);
      expect(canonical).toBe(normalizeSeed(valid));
      expect(createDungeon(valid)).toEqual(createDungeon(canonical));
      expect(shuffleDeck(CANONICAL_DECK, valid)).toEqual(shuffleDeck(CANONICAL_DECK, canonical));
    }
  });

  it('normalizes equivalent seeds identically everywhere', () => {
    const decomposed = '  e\u0301  ';
    const composed = '\u00e9';

    expect(requireSeed(decomposed)).toBe(composed);
    expect(createDungeon(decomposed)).toEqual(createDungeon(composed));
    expect(shuffleDeck(CANONICAL_DECK, decomposed)).toEqual(shuffleDeck(CANONICAL_DECK, composed));
    expect(createInitialState(decomposed)).toEqual(createInitialState(composed));
  });
});
