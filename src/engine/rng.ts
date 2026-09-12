/**
 * mulberry32 PRNG — ~10 lines, no dependency. Seeded by a uint32.
 * https://github.com/bryc/code/blob/jsc/content/docs/hash_functions/prngs_explained.md
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeds are shared as ~6-char base36 strings; anything longer/odd is hashed (FNV-1a). */
export function seedToUint32(seed: string): number {
  const normalized = seed.toLowerCase();
  if (/^[0-9a-z]{1,9}$/.test(normalized)) {
    return Number.parseInt(normalized, 36) >>> 0;
  }
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Random ~6-char base36 seed (uint32 < 36^6, zero-padded). */
export function randomSeed(): string {
  const value = Math.floor(Math.random() * 36 ** 6);
  return value.toString(36).padStart(6, '0');
}

/** Deterministic Fisher–Yates shuffle. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
