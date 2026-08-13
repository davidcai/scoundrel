/**
 * Deterministic PRNG + seed-string helpers.
 *
 * The engine is seeded by a uint32 (mulberry32). Runs are shared as ~6-char
 * base36 strings; `seedToUint32` / `uint32ToSeed` convert between the two
 * representations exactly (mod 2^32) so a shared seed reproduces the run.
 */

/**
 * mulberry32 — tiny, fast, deterministic 32-bit PRNG.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Derive a uint32 from a seed string. Pure base36 strings ('0'-'9','a'-'z',
 * case-insensitive) fold to their exact base36 value mod 2^32; any other
 * characters are mixed in deterministically so arbitrary strings still seed.
 */
export function seedToUint32(seed: string): number {
  let h = 0
  for (const ch of seed.toLowerCase().trim()) {
    const digit = parseInt(ch, 36)
    if (Number.isNaN(digit)) {
      h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0
    } else {
      h = (Math.imul(h, 36) + digit) >>> 0
    }
  }
  return h
}

/** Convert a uint32 to a base36 seed string, zero-padded to 6 chars. */
export function uint32ToSeed(value: number): string {
  return (value >>> 0).toString(36).padStart(6, '0')
}

/**
 * Generate a random 6-char base36 seed string. Bounded to 36^6 - 1 so the
 * output is always exactly 6 chars.
 */
export function randomSeed(): string {
  // 36^6 = 2176782336 possible 6-char base36 seeds.
  return uint32ToSeed(Math.floor(Math.random() * 2176782336))
}
