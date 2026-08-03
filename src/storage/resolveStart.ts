import type { SavedRun } from "./persistence";

export type StartDecision =
  | { kind: "resume"; run: SavedRun }
  | { kind: "fresh"; seed: string };

/**
 * The three load rules, in order:
 *   1. URL seed equal to the saved run's seed -> resume (plain refresh)
 *   2. URL seed different -> start that dungeon fresh (shared link)
 *   3. No URL seed -> resume if possible, otherwise generate
 */
export function resolveStart(
  urlSeed: string | null,
  saved: SavedRun | null,
  makeSeed: () => string,
): StartDecision {
  if (urlSeed !== null) {
    return saved !== null && saved.state.seed === urlSeed
      ? { kind: "resume", run: saved }
      : { kind: "fresh", seed: urlSeed };
  }
  return saved !== null ? { kind: "resume", run: saved } : { kind: "fresh", seed: makeSeed() };
}
