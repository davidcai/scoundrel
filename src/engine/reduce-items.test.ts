import { describe, expect, it } from "vitest";
import { applyAction } from "./reduce";
import { c, stateWith, weaponOf } from "./test-fixtures";

const room = (...ids: ReturnType<typeof c>[]) => ids;

describe("drink", () => {
  it("heals the card value and discards the card", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 10 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.health).toBe(17);
    expect(next.discard).toEqual([c("hearts", 7)]);
    expect(next.room.map((x) => x.id)).toEqual(["C2", "C3", "C4"]);
  });

  it("caps healing at 20", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 15 }),
      { type: "DRINK", cardId: "H9" },
    );
    expect(next.health).toBe(20);
  });

  it("sets the potion flag", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 10 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.potionUsedThisRoom).toBe(true);
  });

  it("consumes the potion slot even at full health", () => {
    const next = applyAction(
      stateWith({ room: room(c("hearts", 7), c("clubs", 2), c("clubs", 3), c("clubs", 4)), health: 20 }),
      { type: "DRINK", cardId: "H7" },
    );
    expect(next.health).toBe(20);
    expect(next.potionUsedThisRoom).toBe(true);
    expect(next.log.at(-1)).toEqual({
      kind: "potion", card: c("hearts", 7), healed: 0, blocked: false, healthAfter: 20,
    });
  });

  it("resolves a second potion in the same room without healing (rule 7)", () => {
    const state = stateWith({
      room: room(c("hearts", 7), c("hearts", 8), c("clubs", 2), c("clubs", 3)),
      health: 5,
    });
    const afterFirst = applyAction(state, { type: "DRINK", cardId: "H7" });
    expect(afterFirst.health).toBe(12);

    const afterSecond = applyAction(afterFirst, { type: "DRINK", cardId: "H8" });
    expect(afterSecond.health).toBe(12);
    expect(afterSecond.discard.map((x) => x.id)).toEqual(["H7", "H8"]);
    expect(afterSecond.log.at(-1)).toEqual({
      kind: "potion", card: c("hearts", 8), healed: 0, blocked: true, healthAfter: 12,
    });
  });

  it("lets a carried potion heal in the next room (rule 7)", () => {
    const state = stateWith({
      room: room(c("hearts", 7), c("hearts", 8), c("clubs", 2), c("clubs", 3)),
      deck: [c("clubs", 5), c("clubs", 6), c("clubs", 7)],
      health: 5,
    });
    let next = applyAction(state, { type: "DRINK", cardId: "H7" });   // heals to 12
    next = applyAction(next, { type: "FIGHT", cardId: "C2", useWeapon: false });  // 10
    next = applyAction(next, { type: "FIGHT", cardId: "C3", useWeapon: false });  // 7, deals room 2
    expect(next.potionUsedThisRoom).toBe(false);
    expect(next.room[0]?.id).toBe("H8");

    next = applyAction(next, { type: "DRINK", cardId: "H8" });
    expect(next.health).toBe(15);
  });
});

describe("equip", () => {
  it("equips a fresh weapon with no kills", () => {
    const next = applyAction(
      stateWith({ room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)) }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.weapon).toEqual({ card: c("diamonds", 9), kills: [] });
    expect(next.room.map((x) => x.id)).toEqual(["C2", "C3", "C4"]);
    expect(next.discard).toEqual([]);
  });

  it("discards the old weapon and its whole kill stack (rule 5)", () => {
    const old = weaponOf(4, [11, 7]);
    const next = applyAction(
      stateWith({ room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)), weapon: old }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.weapon).toEqual({ card: c("diamonds", 9), kills: [] });
    expect(next.discard.map((x) => x.id)).toEqual(["D4", "S11", "S7"]);
  });

  it("resets the threshold so the new weapon can kill anything", () => {
    let next = applyAction(
      stateWith({
        room: room(c("diamonds", 9), c("clubs", 13), c("clubs", 3), c("clubs", 4)),
        weapon: weaponOf(4, [2]),
      }),
      { type: "EQUIP", cardId: "D9" },
    );
    next = applyAction(next, { type: "FIGHT", cardId: "C13", useWeapon: true });
    expect(next.health).toBe(16);
    expect(next.weapon?.kills.map((x) => x.id)).toEqual(["C13"]);
  });

  it("logs what was discarded", () => {
    const next = applyAction(
      stateWith({
        room: room(c("diamonds", 9), c("clubs", 2), c("clubs", 3), c("clubs", 4)),
        weapon: weaponOf(4),
      }),
      { type: "EQUIP", cardId: "D9" },
    );
    expect(next.log.at(-1)).toEqual({
      kind: "equip", weapon: c("diamonds", 9), discarded: c("diamonds", 4),
    });
  });
});
