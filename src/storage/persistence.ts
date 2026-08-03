import { validateState, type GameState } from "../engine";

export const SCHEMA = 1;

const RUN_KEY = "scoundrel.run";
const STATS_KEY = "scoundrel.stats";

export type SavedRun = {
  schema: number;
  state: GameState;
  /** True once this run's terminal result has been counted into stats. */
  statsRecorded: boolean;
};

export type Stats = {
  schema: number;
  best: number | null;
  played: number;
  won: number;
};

export const EMPTY_STATS: Stats = { schema: SCHEMA, best: null, played: 0, won: 0 };

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or exhausted quota: degrade to in-memory play.
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function loadRun(): SavedRun | null {
  const raw = readRaw(RUN_KEY);
  if (raw === null) return null;

  const record = asRecord(parseJson(raw));
  if (record === null) return null;
  if (record["schema"] !== SCHEMA) return null;
  if (typeof record["statsRecorded"] !== "boolean") return null;

  const state = validateState(record["state"]);
  if (state === null) return null;

  return { schema: SCHEMA, state, statsRecorded: record["statsRecorded"] };
}

export function saveRun(run: SavedRun): void {
  writeRaw(RUN_KEY, JSON.stringify(run));
}

export function loadStats(): Stats {
  const raw = readRaw(STATS_KEY);
  if (raw === null) return EMPTY_STATS;

  const record = asRecord(parseJson(raw));
  if (record === null) return EMPTY_STATS;
  if (record["schema"] !== SCHEMA) return EMPTY_STATS;

  const best = record["best"];
  const played = record["played"];
  const won = record["won"];
  if (best !== null && typeof best !== "number") return EMPTY_STATS;
  if (typeof played !== "number" || typeof won !== "number") return EMPTY_STATS;

  return { schema: SCHEMA, best, played, won };
}

export function saveStats(stats: Stats): void {
  writeRaw(STATS_KEY, JSON.stringify(stats));
}

/** Pure. A loss can never displace a better score because null is the only empty state. */
export function recordResult(stats: Stats, outcome: "won" | "lost", score: number): Stats {
  return {
    schema: SCHEMA,
    best: stats.best === null ? score : Math.max(stats.best, score),
    played: stats.played + 1,
    won: stats.won + (outcome === "won" ? 1 : 0),
  };
}
