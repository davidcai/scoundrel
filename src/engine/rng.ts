export type Rng = () => number;

export const SEED_PATTERN = /^[0-9A-F]{6}$/;

export function normalizeSeed(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return SEED_PATTERN.test(upper) ? upper : null;
}

export function seedToInt(seed: string): number {
  return Number.parseInt(seed, 16);
}

/** Small, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seedInt: number): Rng {
  let state = seedInt >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
