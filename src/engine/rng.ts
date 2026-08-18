/**
 * Deterministic PRNG utilities (Q16a/Q26a).
 *
 * mulberry32 is a tiny (~10 lines, no dependency) 32-bit PRNG. The seed is
 * shared/transmitted as a ~6-char base36 string, so any string is hashed to a
 * uint32 first (FNV-1a) — seeding accepts arbitrary strings, not just base36.
 */

/** FNV-1a 32-bit hash: maps an arbitrary seed string to a uint32. */
export const hashSeed = (seed: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 PRNG: fast, deterministic, seedable. Returns floats in [0, 1). */
export const mulberry32 = (a: number): (() => number) => {
  let t = a >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates shuffle of a copy of `items`, deterministic for a given seed string. */
export const shuffled = <T>(items: readonly T[], seed: string): T[] => {
  const rand = mulberry32(hashSeed(seed))
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
