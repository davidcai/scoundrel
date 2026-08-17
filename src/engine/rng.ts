import type { CardId } from './types';

/** Deterministic 32-bit PRNG (mulberry32). ~10 lines, no deps. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Convert a base36 seed string into a uint32 for mulberry32. */
export function seedToUint32(seed: string): number {
  const cleaned = seed.toLowerCase().replace(/[^0-9a-z]/g, '');
  if (cleaned.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const digit = SEED_ALPHABET.indexOf(cleaned[i]);
    n = n * 36 + digit;
  }
  return n >>> 0;
}

/** Generate a random ~6-char base36 seed for a fresh run. */
export function randomSeed(length = 6): string {
  let out = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += SEED_ALPHABET[bytes[i] % 36];
    return out;
  }
  for (let i = 0; i < length; i++) out += SEED_ALPHABET[Math.floor(Math.random() * 36)];
  return out;
}

/** Fisher–Yates shuffle using a supplied RNG (deterministic given the same seed). */
export function shuffledDeck(deck: CardId[], rand: () => number): CardId[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
