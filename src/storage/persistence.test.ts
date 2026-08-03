import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "../engine";
import {
  EMPTY_STATS, SCHEMA, loadRun, loadStats, recordResult, saveRun, saveStats,
} from "./persistence";

const RUN_KEY = "scoundrel.run";
const STATS_KEY = "scoundrel.stats";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("run round trip", () => {
  it("returns null when nothing is stored", () => {
    expect(loadRun()).toBeNull();
  });

  it("saves and restores a run exactly", () => {
    const state = createGame("4F2A9C");
    saveRun({ schema: SCHEMA, state, statsRecorded: false });
    expect(loadRun()).toEqual({ schema: SCHEMA, state, statsRecorded: false });
  });

  it("preserves the statsRecorded flag", () => {
    saveRun({ schema: SCHEMA, state: createGame("000001"), statsRecorded: true });
    expect(loadRun()?.statsRecorded).toBe(true);
  });
});

describe("run rejection", () => {
  it("rejects unparseable JSON", () => {
    window.localStorage.setItem(RUN_KEY, "{not json");
    expect(loadRun()).toBeNull();
  });

  it("rejects a schema mismatch instead of migrating", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: 99, state, statsRecorded: false }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a missing statsRecorded flag", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: SCHEMA, state }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a state that violates the invariants", () => {
    const state = createGame("4F2A9C");
    const tampered = { ...state, deck: state.deck.slice(3) };
    window.localStorage.setItem(RUN_KEY, JSON.stringify({ schema: SCHEMA, state: tampered, statsRecorded: false }));
    expect(loadRun()).toBeNull();
  });

  it("rejects a hand-edited health value", () => {
    const state = createGame("4F2A9C");
    window.localStorage.setItem(
      RUN_KEY,
      JSON.stringify({ schema: SCHEMA, state: { ...state, health: 999 }, statsRecorded: false }),
    );
    expect(loadRun()).toBeNull();
  });
});

describe("stats", () => {
  it("returns empty stats when nothing is stored", () => {
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("saves and restores stats", () => {
    const stats = { schema: SCHEMA, best: 12, played: 4, won: 1 };
    saveStats(stats);
    expect(loadStats()).toEqual(stats);
  });

  it("falls back to empty on corrupt or mismatched payloads", () => {
    window.localStorage.setItem(STATS_KEY, "garbage");
    expect(loadStats()).toEqual(EMPTY_STATS);

    window.localStorage.setItem(STATS_KEY, JSON.stringify({ schema: 99, best: 5, played: 1, won: 1 }));
    expect(loadStats()).toEqual(EMPTY_STATS);

    window.localStorage.setItem(STATS_KEY, JSON.stringify({ schema: SCHEMA, best: "high", played: 1, won: 1 }));
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("accepts a null best", () => {
    saveStats({ schema: SCHEMA, best: null, played: 3, won: 0 });
    expect(loadStats()).toEqual({ schema: SCHEMA, best: null, played: 3, won: 0 });
  });
});

describe("recordResult", () => {
  it("records the first result whatever it is", () => {
    expect(recordResult(EMPTY_STATS, "lost", -40)).toEqual({ schema: SCHEMA, best: -40, played: 1, won: 0 });
  });

  it("counts wins separately from plays", () => {
    const after = recordResult(recordResult(EMPTY_STATS, "lost", -40), "won", 12);
    expect(after).toEqual({ schema: SCHEMA, best: 12, played: 2, won: 1 });
  });

  it("never lets a loss displace a better score", () => {
    const withWin = { schema: SCHEMA, best: 12, played: 1, won: 1 };
    expect(recordResult(withWin, "lost", -40).best).toBe(12);
  });

  it("takes the higher of two wins", () => {
    const withWin = { schema: SCHEMA, best: 12, played: 1, won: 1 };
    expect(recordResult(withWin, "won", 18).best).toBe(18);
    expect(recordResult(withWin, "won", 3).best).toBe(12);
  });

  it("is pure", () => {
    const stats = { schema: SCHEMA, best: 5, played: 1, won: 1 };
    recordResult(stats, "won", 20);
    expect(stats).toEqual({ schema: SCHEMA, best: 5, played: 1, won: 1 });
  });
});

describe("storage unavailable", () => {
  it("degrades instead of throwing on read", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadRun()).toBeNull();
    expect(loadStats()).toEqual(EMPTY_STATS);
  });

  it("degrades instead of throwing on write", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveRun({ schema: SCHEMA, state: createGame("000001"), statsRecorded: false })).not.toThrow();
    expect(() => saveStats(EMPTY_STATS)).not.toThrow();
  });
});
