import { describe, expect, it } from "vitest";
import { IllegalActionError } from "./actions";
import { applyAction } from "./reduce";
import { c, stateWith, weaponOf } from "./test-fixtures";

describe("fight barehanded", () => {
  it("takes the monster's full value and discards it", () => {
    const monster = c("clubs", 8);
    const next = applyAction(
      stateWith({ room: [monster, c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 20 }),
      { type: "FIGHT", cardId: "C8", useWeapon: false },
    );
    expect(next.health).toBe(12);
    expect(next.room.map((x) => x.id)).toEqual(["H2", "H3", "H4"]);
    expect(next.discard).toEqual([monster]);
    expect(next.weapon).toBeNull();
  });

  it("is allowed while holding a legal weapon, leaving the weapon untouched (rule 4)", () => {
    const armed = weaponOf(10);
    const next = applyAction(
      stateWith({ room: [c("clubs", 3), c("hearts", 2), c("hearts", 3), c("hearts", 4)], weapon: armed }),
      { type: "FIGHT", cardId: "C3", useWeapon: false },
    );
    expect(next.weapon).toEqual(armed);
    expect(next.health).toBe(17);
  });

  it("logs the fight", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)] }),
      { type: "FIGHT", cardId: "C8", useWeapon: false },
    );
    expect(next.log).toContainEqual({
      kind: "fight", monster: c("clubs", 8), weapon: null, damage: 8, healthAfter: 12,
    });
  });
});

describe("fight with a weapon", () => {
  it("takes only the difference and stacks the monster on the weapon", () => {
    const next = applyAction(
      stateWith({
        room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
        weapon: weaponOf(5),
      }),
      { type: "FIGHT", cardId: "C8", useWeapon: true },
    );
    expect(next.health).toBe(17);
    expect(next.weapon?.kills.map((x) => x.id)).toEqual(["C8"]);
    expect(next.discard).toEqual([]);
  });

  it("floors damage at zero but still lowers the threshold (rule 6)", () => {
    const next = applyAction(
      stateWith({
        room: [c("spades", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
        weapon: weaponOf(9),
      }),
      { type: "FIGHT", cardId: "S8", useWeapon: true },
    );
    expect(next.health).toBe(20);
    expect(next.weapon?.kills.map((x) => x.rank)).toEqual([8]);
  });

  it("refuses a monster at or above the threshold (rule 6)", () => {
    const state = stateWith({
      room: [c("clubs", 10), c("hearts", 2), c("hearts", 3), c("hearts", 4)],
      weapon: weaponOf(9, [10]),
    });
    expect(() => applyAction(state, { type: "FIGHT", cardId: "C10", useWeapon: true })).toThrow(
      IllegalActionError,
    );
  });

  it("refuses a weapon fight when unarmed", () => {
    const state = stateWith({ room: [c("clubs", 4), c("hearts", 2), c("hearts", 3), c("hearts", 4)] });
    expect(() => applyAction(state, { type: "FIGHT", cardId: "C4", useWeapon: true })).toThrow(
      IllegalActionError,
    );
  });
});

describe("death (rule 9)", () => {
  it("clamps health to zero and ends the game", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.health).toBe(0);
    expect(next.status).toBe("lost");
  });

  it("logs game over", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.log.at(-1)).toMatchObject({ kind: "gameOver", outcome: "lost" });
  });

  it("rejects any further action", () => {
    const dead = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 5 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(() => applyAction(dead, { type: "DRINK", cardId: "H2" })).toThrow(IllegalActionError);
  });

  it("does not deal a new room on death", () => {
    const next = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2)], deck: [c("clubs", 2), c("clubs", 3)], health: 1 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(next.room.map((x) => x.id)).toEqual(["H2"]);
    expect(next.deck).toHaveLength(2);
  });
});

describe("room refill (rule 2)", () => {
  it("deals three new cards when one card is left, keeping the carried card first", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6), c("spades", 7), c("spades", 8)],
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });

    expect(next.room.map((x) => x.id)).toEqual(["H9", "S5", "S6", "S7"]);
    expect(next.deck.map((x) => x.id)).toEqual(["S8"]);
    expect(next.roomNumber).toBe(2);
  });

  it("resets the potion flag and clears ranLastRoom on the deal", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6), c("spades", 7)],
      potionUsedThisRoom: true,
      ranLastRoom: true,
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.ranLastRoom).toBe(false);
  });

  it("logs only the newly dealt cards", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6)],
    });
    const next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.log.at(-1)).toEqual({ kind: "deal", roomNumber: 2, cards: [c("spades", 5), c("spades", 6)] });
  });
});

describe("short final room and winning (rule 3)", () => {
  it("deals fewer than three when the deck runs short", () => {
    const state = stateWith({
      room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("hearts", 9)],
      deck: [c("spades", 5), c("spades", 6)],
    });
    let next = applyAction(state, { type: "FIGHT", cardId: "C2", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });
    expect(next.room.map((x) => x.id)).toEqual(["H9", "S5", "S6"]);
    expect(next.deck).toEqual([]);
  });

  it("requires every card of a short room to be resolved, then wins", () => {
    let next = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4)], deck: [] });
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.status).toBe("playing");
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });
    expect(next.status).toBe("playing");
    expect(next.room).toHaveLength(1);
    next = applyAction(next, { type: "FIGHT", cardId: "C4", useWeapon: false });
    expect(next.status).toBe("won");
    expect(next.room).toEqual([]);
  });

  it("logs game over on the win with the remaining health as score", () => {
    let next = stateWith({ room: [c("clubs", 2)], deck: [], health: 14 });
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });
    expect(next.log.at(-1)).toEqual({ kind: "gameOver", outcome: "won", score: 12 });
  });
});

describe("guards", () => {
  it("rejects an action for a card that is not in the room", () => {
    expect(() =>
      applyAction(stateWith({ room: [c("clubs", 2)] }), { type: "FIGHT", cardId: "C9", useWeapon: false }),
    ).toThrow(IllegalActionError);
  });

  it("never mutates the input state", () => {
    const state = stateWith({ room: [c("clubs", 8), c("hearts", 2), c("hearts", 3), c("hearts", 4)] });
    const snapshot = structuredClone(state);
    applyAction(state, { type: "FIGHT", cardId: "C8", useWeapon: false });
    expect(state).toEqual(snapshot);
  });
});
