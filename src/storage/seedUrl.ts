import { normalizeSeed } from "../engine";

const SEED_SPACE = 0x1000000; // 24 bits, matching six hex characters

export function randomSeed(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const value = (buffer[0] ?? 0) % SEED_SPACE;
  return value.toString(16).toUpperCase().padStart(6, "0");
}

export function readSeedFromUrl(search: string = window.location.search): string | null {
  const raw = new URLSearchParams(search).get("seed");
  return raw === null ? null : normalizeSeed(raw);
}

/** Writes the seed into the address bar without navigating, so a dungeon is shareable. */
export function writeSeedToUrl(seed: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", seed);
    window.history.replaceState(null, "", url);
  } catch {
    // Non-browser or restricted context: the seed is still visible in the HUD.
  }
}
