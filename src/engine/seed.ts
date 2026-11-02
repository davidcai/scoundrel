/**
 * Seeded deck ordering for the Scoundrel rules engine.
 *
 * Implements the Phase 1 foundation decisions recorded in
 * docs/implementation-plan.md: hash the seed's UTF-8 bytes with 32-bit FNV-1a,
 * generate values with mulberry32, and run Fisher–Yates from the last index down
 * over the canonical deck order. No unseeded random source is used, so previews and
 * confirmed outcomes always see the same dungeon for a given seed.
 */

import { CANONICAL_DECK, type CardId } from './cards';
import { MAX_SEED_LENGTH } from './constants';

/** Trim surrounding whitespace and apply Unicode NFC normalization. */
export function normalizeSeed(input: string): string {
  return input.trim().normalize('NFC');
}

/**
 * Validate a seed and return its canonical form, or `null` when invalid.
 *
 * The foundation decision defines a valid seed as a trimmed, NFC-normalized,
 * case-sensitive Unicode string of 1–64 characters.
 */
export function parseSeed(input: string): string | null {
  const seed = normalizeSeed(input);
  const length = Array.from(seed).length;
  if (length < 1 || length > MAX_SEED_LENGTH) return null;
  return seed;
}

export function isValidSeed(input: string): boolean {
  return parseSeed(input) !== null;
}

/**
 * Validate a seed and return its canonical form, or throw for an invalid one.
 *
 * Every exported deck builder funnels through this helper so a seed accepted by
 * `createInitialState` is accepted (with the same normalization) by
 * `createDungeon` and `shuffleDeck`, and invalid seeds are rejected everywhere.
 *
 * @throws RangeError when the seed is not 1–64 trimmed, NFC-normalized characters.
 */
export function requireSeed(input: string): string {
  const seed = parseSeed(input);
  if (seed === null) {
    throw new RangeError('Invalid seed: expected 1–64 trimmed, NFC-normalized characters');
  }
  return seed;
}

/**
 * 32-bit FNV-1a hash of the seed's UTF-8 bytes. Expects an already-normalized
 * seed; the exported deck builders normalize through `requireSeed` first.
 */
export function hashSeed(seed: string): number {
  const bytes = new TextEncoder().encode(seed);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic pseudo-random generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle a deck with a deterministic Fisher–Yates pass from the last index
 * down, per the documented seed contract. The seed is validated and normalized
 * through the shared path, and the input array is not mutated.
 *
 * @throws RangeError when the seed is invalid (see `requireSeed`).
 */
export function shuffleDeck(deck: readonly CardId[], seed: string): CardId[] {
  const normalizedSeed = requireSeed(seed);
  const shuffled = [...deck];
  const random = mulberry32(hashSeed(normalizedSeed));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

/**
 * The shuffled 44-card dungeon for a seed, in draw order (index 0 dealt first).
 *
 * @throws RangeError when the seed is invalid (see `requireSeed`).
 */
export function createDungeon(seed: string): CardId[] {
  return shuffleDeck(CANONICAL_DECK, seed);
}
