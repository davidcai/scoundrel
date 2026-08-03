import { describe, expect, it } from "vitest";
import { IllegalActionError } from "./actions";
import { applyAction } from "./reduce";
import { c, stateWith } from "./test-fixtures";

const fullRoom = [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)];
const deckOf6 = [c("spades", 6), c("spades", 7), c("spades", 8), c("spades", 9), c("spades", 10), c("spades", 11)];

describe("run away", () => {
  it("sends all four cards to the bottom in display order (rule 8)", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(next.room.map((x) => x.id)).toEqual(["S6", "S7", "S8", "S9"]);
    expect(next.deck.map((x) => x.id)).toEqual(["S10", "S11", "C2", "C3", "C4", "C5"]);
  });

  it("marks the room as run from and resets the potion flag", () => {
    const next = applyAction(
      stateWith({ room: fullRoom, deck: deckOf6, potionUsedThisRoom: true }),
      { type: "RUN" },
    );
    expect(next.ranLastRoom).toBe(true);
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.roomNumber).toBe(2);
  });

  it("logs the run and the replacement deal", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(next.log.slice(-2)).toEqual([
      { kind: "run", roomNumber: 1 },
      { kind: "deal", roomNumber: 2, cards: [c("spades", 6), c("spades", 7), c("spades", 8), c("spades", 9)] },
    ]);
  });

  it("refuses two runs in a row (rule 1)", () => {
    const afterRun = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    expect(() => applyAction(afterRun, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("allows running again after a room is resolved normally (rule 1)", () => {
    // deck cards must total <= 20 damage across 3 barehanded fights so the
    // player survives to trigger a normal deal (which resets ranLastRoom).
    const smallDeck = [c("spades", 2), c("spades", 3), c("spades", 4), c("spades", 5), c("spades", 6), c("spades", 7), c("spades", 8), c("spades", 9)];
    let next = applyAction(
      stateWith({ room: fullRoom, deck: smallDeck }),
      { type: "RUN" },
    );
    expect(next.ranLastRoom).toBe(true);
    for (const id of ["S2", "S3", "S4"]) {
      next = applyAction(next, { type: "FIGHT", cardId: id, useWeapon: false });
    }
    expect(next.ranLastRoom).toBe(false);
    expect(() => applyAction(next, { type: "RUN" })).not.toThrow();
  });

  it("refuses once a card has been resolved this room (rule 1)", () => {
    const started = applyAction(
      stateWith({ room: fullRoom, deck: deckOf6 }),
      { type: "FIGHT", cardId: "C2", useWeapon: false },
    );
    expect(started.room).toHaveLength(3);
    expect(() => applyAction(started, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("refuses in a short final room", () => {
    const state = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4)], deck: [] });
    expect(() => applyAction(state, { type: "RUN" })).toThrow(IllegalActionError);
  });

  it("never changes health or ends the game", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6, health: 7 }), { type: "RUN" });
    expect(next.health).toBe(7);
    expect(next.status).toBe("playing");
  });
});

describe("new game", () => {
  it("starts a fresh dungeon from the given seed", () => {
    const next = applyAction(stateWith({ room: fullRoom, health: 3 }), {
      type: "NEW_GAME",
      seed: "4F2A9C",
    });
    expect(next.seed).toBe("4F2A9C");
    expect(next.health).toBe(20);
    expect(next.room).toHaveLength(4);
    expect(next.deck).toHaveLength(40);
    expect(next.status).toBe("playing");
  });

  it("works from a finished game", () => {
    const dead = applyAction(
      stateWith({ room: [c("clubs", 14), c("hearts", 2), c("hearts", 3), c("hearts", 4)], health: 2 }),
      { type: "FIGHT", cardId: "C14", useWeapon: false },
    );
    expect(dead.status).toBe("lost");
    expect(applyAction(dead, { type: "NEW_GAME", seed: "000123" }).status).toBe("playing");
  });

  it("rejects an invalid seed", () => {
    expect(() => applyAction(stateWith({}), { type: "NEW_GAME", seed: "zzz" })).toThrow(/seed/i);
  });
});

describe("run-away log aliasing", () => {
  it("does not share the dealt array between room and log", () => {
    const next = applyAction(stateWith({ room: fullRoom, deck: deckOf6 }), { type: "RUN" });
    const dealLog = next.log.at(-1);
    if (dealLog === undefined || dealLog.kind !== "deal") throw new Error("expected deal log");
    expect(next.room).not.toBe(dealLog.cards);
  });
});
