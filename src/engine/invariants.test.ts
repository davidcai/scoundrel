import { describe, expect, it } from "vitest";
import type { Action } from "./actions";
import { buildDungeon } from "./cards";
import { assertInvariants, InvariantError, validateState } from "./invariants";
import { offersFor, runOffer } from "./legality";
import { applyAction } from "./reduce";
import { createGame, type GameState } from "./state";
import { c, stateWith, weaponOf } from "./test-fixtures";

describe("assertInvariants", () => {
  it("accepts a fresh game", () => {
    expect(() => assertInvariants(createGame("4F2A9C"))).not.toThrow();
  });

  it("rejects a missing card", () => {
    const state = createGame("4F2A9C");
    expect(() => assertInvariants({ ...state, deck: state.deck.slice(1) })).toThrow(InvariantError);
  });

  it("rejects a duplicated card", () => {
    const state = createGame("4F2A9C");
    const first = state.deck[0];
    if (first === undefined) throw new Error("fixture");
    expect(() => assertInvariants({ ...state, discard: [first] })).toThrow(InvariantError);
  });

  it("rejects health outside 0..20", () => {
    const state = createGame("4F2A9C");
    expect(() => assertInvariants({ ...state, health: 21 })).toThrow(InvariantError);
    expect(() => assertInvariants({ ...state, health: -1 })).toThrow(InvariantError);
  });

  it("rejects an oversized room", () => {
    const state = createGame("4F2A9C");
    const extra = state.deck[0];
    if (extra === undefined) throw new Error("fixture");
    expect(() =>
      assertInvariants({ ...state, room: [...state.room, extra], deck: state.deck.slice(1) }),
    ).toThrow(InvariantError);
  });

  it("rejects a weapon kill stack that is not strictly descending", () => {
    const deck = buildDungeon().filter((x) => !["D9", "S4", "S8"].includes(x.id));
    expect(() =>
      assertInvariants(stateWith({ deck, weapon: { card: c("diamonds", 9), kills: [c("spades", 4), c("spades", 8)] } })),
    ).toThrow(InvariantError);
  });

  it("rejects a live game with an empty room and an empty deck", () => {
    expect(() => assertInvariants(stateWith({ deck: [], room: [], discard: buildDungeon() }))).toThrow(
      InvariantError,
    );
  });
});

describe("invariants hold across random legal play", () => {
  /** Deterministic pseudo-random pick so any failure reproduces exactly. */
  function pick<T>(items: readonly T[], roll: number): T {
    const item = items[roll % items.length];
    if (item === undefined) throw new Error("pick from empty list");
    return item;
  }

  function legalActions(state: GameState): Action[] {
    const actions: Action[] = state.room.flatMap((card) =>
      offersFor(state, card).filter((o) => o.enabled).map((o) => o.action),
    );
    const run = runOffer(state);
    if (run.enabled) actions.push(run.action);
    return actions;
  }

  for (const seedInt of [1, 2, 3, 17, 99, 1234, 65535, 16777215]) {
    const seed = seedInt.toString(16).toUpperCase().padStart(6, "0");

    it(`holds for every step of seed ${seed}`, () => {
      let state = createGame(seed);
      assertInvariants(state);

      let roll = seedInt;
      let steps = 0;
      while (state.status === "playing" && steps < 500) {
        const actions = legalActions(state);
        expect(actions.length).toBeGreaterThan(0);   // never deadlocks
        roll = (roll * 1103515245 + 12345) >>> 0;
        state = applyAction(state, pick(actions, roll));
        assertInvariants(state);
        steps += 1;
      }

      expect(state.status).not.toBe("playing");
      expect(steps).toBeLessThan(500);
    });
  }
});

describe("validateState", () => {
  it("accepts a round-tripped game", () => {
    const state = createGame("4F2A9C");
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it("rejects non-objects, wrong shapes, and invariant violations", () => {
    const state = createGame("4F2A9C");
    expect(validateState(null)).toBeNull();
    expect(validateState("nope")).toBeNull();
    expect(validateState({})).toBeNull();
    expect(validateState({ ...state, health: "twenty" })).toBeNull();
    expect(validateState({ ...state, status: "bogus" })).toBeNull();
    expect(validateState({ ...state, seed: "nope" })).toBeNull();
    expect(validateState({ ...state, deck: state.deck.slice(1) })).toBeNull();
    expect(validateState({ ...state, room: [{ id: "S8" }] })).toBeNull();
  });

  it("accepts a state with an equipped weapon", () => {
    const deck = buildDungeon().filter((x) => !["D9", "S11"].includes(x.id));
    const state = stateWith({ deck, weapon: weaponOf(9, [11]) });
    expect(validateState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
