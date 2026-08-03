import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { MAX_HEALTH, ROOM_SIZE, createGame, weaponThreshold } from "./state";

describe("rule constants", () => {
  // Pinned to the rulebook, not to themselves. Every other assertion compares
  // these constants to values derived from them, so a wrong value here would
  // rebalance the whole game with a green suite.
  it("match docs/rules.md", () => {
    expect(MAX_HEALTH).toBe(20);
    expect(ROOM_SIZE).toBe(4);
  });
});

describe("createGame", () => {
  const state = createGame("4F2A9C");

  it("records the seed", () => {
    expect(state.seed).toBe("4F2A9C");
  });

  it("deals a room of four and leaves 40 in the deck", () => {
    expect(state.room).toHaveLength(4);
    expect(state.deck).toHaveLength(40);
  });

  it("starts at full health with nothing equipped or discarded", () => {
    expect(state.health).toBe(MAX_HEALTH);
    expect(state.weapon).toBeNull();
    expect(state.discard).toEqual([]);
  });

  it("starts flags clear, on room 1, playing", () => {
    expect(state.potionUsedThisRoom).toBe(false);
    expect(state.ranLastRoom).toBe(false);
    expect(state.roomNumber).toBe(1);
    expect(state.status).toBe("playing");
  });

  it("seeds the log with the first deal", () => {
    expect(state.log).toEqual([{ kind: "deal", roomNumber: 1, cards: state.room }]);
  });

  it("accounts for all 44 cards", () => {
    expect(new Set([...state.deck, ...state.room].map((c) => c.id)).size).toBe(44);
  });

  it("is deterministic for a seed", () => {
    expect(createGame("4F2A9C")).toEqual(createGame("4F2A9C"));
  });

  it("differs across seeds", () => {
    expect(createGame("000001").room.map((c) => c.id)).not.toEqual(
      createGame("000002").room.map((c) => c.id),
    );
  });

  it("throws on an invalid seed", () => {
    expect(() => createGame("nope")).toThrow(/seed/i);
  });
});

describe("seed contract (golden)", () => {
  // Pins the whole seed -> dungeon mapping: the PRNG constants, the shuffle
  // algorithm, buildDungeon's base order, and the deal. A seed is public — it
  // appears in the URL and inside saved games — so changing any of those
  // silently invalidates every shared link and every stored run, and no other
  // test in this codebase would notice.
  //
  // If this fails and you did not intend to change the mapping, do NOT update
  // the expected values. Find what moved.
  it("maps seed 4F2A9C to an exact dungeon", () => {
    const state = createGame("4F2A9C");

    expect(state.room.map((card) => card.id)).toEqual(["H10", "S6", "D10", "H9"]);

    expect(state.deck.map((card) => card.id)).toEqual([
      "S12", "S2", "D7", "C9", "S5", "S9", "S7", "C8", "H4", "H3",
      "D4", "C4", "C13", "C7", "C14", "D9", "D2", "C11", "S4", "H2",
      "H6", "S8", "H5", "D5", "C2", "H7", "C12", "D6", "H8", "S13",
      "C6", "D3", "S10", "D8", "C3", "S3", "C10", "S11", "S14", "C5",
    ]);
  });
});

describe("weaponThreshold", () => {
  it("is null with no weapon", () => {
    expect(weaponThreshold(null)).toBeNull();
  });

  it("is null for a weapon with no kills, meaning unlimited", () => {
    expect(weaponThreshold({ card: makeCard("diamonds", 9), kills: [] })).toBeNull();
  });

  it("is the rank of the most recent kill", () => {
    const kills = [makeCard("spades", 12), makeCard("clubs", 10)];
    expect(weaponThreshold({ card: makeCard("diamonds", 9), kills })).toBe(10);
  });
});
