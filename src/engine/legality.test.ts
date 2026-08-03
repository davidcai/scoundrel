import { describe, expect, it } from "vitest";
import { makeCard } from "./cards";
import { isOffered, offersFor, runOffer } from "./legality";
import { c, stateWith, weaponOf } from "./test-fixtures";

const base = stateWith({ room: [c("clubs", 8), c("hearts", 7), c("diamonds", 5), c("spades", 13)] });
const withState = (patch: Parameters<typeof stateWith>[0]) => ({ ...base, ...patch });
const weaponWith = weaponOf;

describe("offersFor a monster", () => {
  const monster = makeCard("clubs", 8);

  it("always returns weapon offer then barehanded offer", () => {
    const offers = offersFor(withState({ weapon: null }), monster);
    expect(offers).toHaveLength(2);
    expect(offers[0]?.action).toEqual({ type: "FIGHT", cardId: "C8", useWeapon: true });
    expect(offers[1]?.action).toEqual({ type: "FIGHT", cardId: "C8", useWeapon: false });
  });

  it("disables the weapon offer with NO_WEAPON when unarmed", () => {
    const [weaponOffer] = offersFor(withState({ weapon: null }), monster);
    expect(weaponOffer?.enabled).toBe(false);
    expect(weaponOffer?.reason).toBe("NO_WEAPON");
    expect(weaponOffer?.effect).toEqual({ kind: "damage", amount: 8 });
  });

  it("reports the would-be damage on the WEAPON_THRESHOLD offer", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    const offer = offersFor(state, makeCard("clubs", 13))[0];
    expect(offer?.effect).toEqual({ kind: "damage", amount: 4 });
  });

  it("exposes the threshold on an enabled-below-threshold offer", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    expect(offersFor(state, makeCard("clubs", 9))[0]?.threshold).toBe(10);
  });

  it("omits threshold on a fresh weapon with no kills", () => {
    const state = withState({ weapon: weaponWith(5, []) });
    const offer = offersFor(state, makeCard("clubs", 14))[0];
    if (offer === undefined) throw new Error("fixture");
    expect("threshold" in offer).toBe(false);
    expect(offer.threshold).toBeUndefined();
  });

  it("enables a fresh weapon against any monster (rule 6)", () => {
    const state = withState({ weapon: weaponWith(5, []) });
    const [weaponOffer] = offersFor(state, makeCard("clubs", 14));
    expect(weaponOffer?.enabled).toBe(true);
    expect(weaponOffer?.effect).toEqual({ kind: "damage", amount: 9 });
  });

  it("disables the weapon offer at or above the threshold (rule 6)", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    const atThreshold = offersFor(state, makeCard("clubs", 10))[0];
    const above = offersFor(state, makeCard("clubs", 13))[0];
    const below = offersFor(state, makeCard("clubs", 9))[0];
    expect(atThreshold?.enabled).toBe(false);
    expect(atThreshold?.reason).toBe("WEAPON_THRESHOLD");
    expect(above?.enabled).toBe(false);
    expect(below?.enabled).toBe(true);
  });

  it("exposes the threshold for wording", () => {
    const state = withState({ weapon: weaponWith(9, [10]) });
    expect(offersFor(state, makeCard("clubs", 13))[0]?.threshold).toBe(10);
  });

  it("floors weapon damage at zero but still offers the fight", () => {
    const state = withState({ weapon: weaponWith(9, []) });
    const [weaponOffer] = offersFor(state, makeCard("spades", 8));
    expect(weaponOffer?.enabled).toBe(true);
    expect(weaponOffer?.effect).toEqual({ kind: "damage", amount: 0 });
  });

  it("always enables barehanded at full monster value (rule 4)", () => {
    const state = withState({ weapon: weaponWith(10, []) });
    const bare = offersFor(state, makeCard("clubs", 3))[1];
    expect(bare?.enabled).toBe(true);
    expect(bare?.effect).toEqual({ kind: "damage", amount: 3 });
  });
});

describe("offersFor a potion", () => {
  const potion = makeCard("hearts", 7);

  it("offers a single always-enabled drink", () => {
    const offers = offersFor(withState({ health: 10 }), potion);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.action).toEqual({ type: "DRINK", cardId: "H7" });
    expect(offers[0]?.enabled).toBe(true);
  });

  it("heals the card value capped by missing health", () => {
    expect(offersFor(withState({ health: 10 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 7,
      blocked: false,
    });
    expect(offersFor(withState({ health: 15 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 5,
      blocked: false,
    });
  });

  it("heals zero at full health but is not blocked", () => {
    expect(offersFor(withState({ health: 20 }), potion)[0]?.effect).toEqual({
      kind: "heal",
      amount: 0,
      blocked: false,
    });
  });

  it("stays enabled but blocked after a potion this room (rule 7)", () => {
    const offer = offersFor(withState({ health: 10, potionUsedThisRoom: true }), potion)[0];
    expect(offer?.enabled).toBe(true);
    expect(offer?.effect).toEqual({ kind: "heal", amount: 0, blocked: true });
  });
});

describe("offersFor a weapon card", () => {
  it("offers a single always-enabled equip naming what it discards (rule 5)", () => {
    const current = weaponWith(4, [6]);
    const offers = offersFor(withState({ weapon: current }), makeCard("diamonds", 9));
    expect(offers).toHaveLength(1);
    expect(offers[0]?.action).toEqual({ type: "EQUIP", cardId: "D9" });
    expect(offers[0]?.enabled).toBe(true);
    expect(offers[0]?.effect).toEqual({ kind: "equip", discards: current.card });
  });

  it("discards nothing when unarmed", () => {
    const offers = offersFor(withState({ weapon: null }), makeCard("diamonds", 9));
    expect(offers[0]?.effect).toEqual({ kind: "equip", discards: null });
  });
});

describe("runOffer", () => {
  it("is enabled on an untouched four-card room (rule 1)", () => {
    const offer = runOffer(base);
    expect(offer.enabled).toBe(true);
    expect(offer.action).toEqual({ type: "RUN" });
    expect(offer.effect).toEqual({ kind: "run" });
  });

  it("is disabled once a card has been resolved (rule 1)", () => {
    const offer = runOffer(withState({ room: base.room.slice(1) }));
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toBe("ROOM_IN_PROGRESS");
  });

  it("is disabled after running from the previous room (rule 1)", () => {
    const offer = runOffer(withState({ ranLastRoom: true }));
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toBe("RAN_LAST_ROOM");
  });

  it("is disabled once the game is over", () => {
    expect(runOffer(withState({ status: "lost" })).enabled).toBe(false);
    expect(runOffer(withState({ status: "lost" })).reason).toBe("ROOM_IN_PROGRESS");
  });
});

describe("isOffered", () => {
  it("accepts an offered action", () => {
    const offer = offersFor(base, c("clubs", 8))[0];
    expect(offer).toBeDefined();
    if (offer === undefined) return;
    expect(isOffered(base, offer.action)).toBe(offer.enabled);
  });

  it("rejects a disabled offer's action", () => {
    expect(isOffered(base, { type: "FIGHT", cardId: "C8", useWeapon: true })).toBe(false);
  });

  it("rejects an action for a card not in the room", () => {
    expect(isOffered(base, { type: "DRINK", cardId: "H2" })).toBe(
      base.room.some((c) => c.id === "H2"),
    );
    expect(isOffered(base, { type: "FIGHT", cardId: "NOPE", useWeapon: false })).toBe(false);
  });

  it("rejects a mismatched action for a card in the room", () => {
    expect(isOffered(base, { type: "DRINK", cardId: "C8" })).toBe(false);
  });

  it("rejects DRINK on a weapon card and EQUIP on a potion card", () => {
    expect(isOffered(base, { type: "DRINK", cardId: "D5" })).toBe(false);
    expect(isOffered(base, { type: "EQUIP", cardId: "H7" })).toBe(false);
  });

  it("always accepts NEW_GAME", () => {
    expect(isOffered(withState({ status: "lost" }), { type: "NEW_GAME", seed: "4F2A9C" })).toBe(true);
  });
});
