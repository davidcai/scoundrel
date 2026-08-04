import { describe, expect, it } from "vitest";
import { makeCard, offersFor, runOffer, type GameState } from "../engine";
import { c, stateWith, weaponOf } from "../engine/test-fixtures";
import {
  cardName, cardShort, logLine, offerLabel, offerNote, offerReason, outcomeHeadline, rankLabel,
} from "./format";

const monsterOffers = (state: GameState, rank: number) => offersFor(state, makeCard("clubs", rank));

describe("card wording", () => {
  it("labels ranks", () => {
    expect(rankLabel(2)).toBe("2");
    expect(rankLabel(10)).toBe("10");
    expect(rankLabel(11)).toBe("J");
    expect(rankLabel(12)).toBe("Q");
    expect(rankLabel(13)).toBe("K");
    expect(rankLabel(14)).toBe("A");
  });

  it("renders a short card", () => {
    expect(cardShort(c("spades", 8))).toBe("8\u2660");
    expect(cardShort(c("diamonds", 14))).toBe("A\u2666");
  });

  it("renders an accessible name including the role", () => {
    expect(cardName(c("spades", 8))).toBe("Eight of Spades, monster");
    expect(cardName(c("hearts", 10))).toBe("Ten of Hearts, potion");
    expect(cardName(c("diamonds", 5))).toBe("Five of Diamonds, weapon");
    expect(cardName(c("clubs", 14))).toBe("Ace of Clubs, monster");
  });
});

describe("offerLabel", () => {
  it("names the weapon and the damage", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    expect(offerLabel(monsterOffers(state, 8)[0]!, state)).toBe("Use 9\u2666 \u2014 0 dmg");
    expect(offerLabel(monsterOffers(state, 13)[0]!, state)).toBe("Use 9\u2666 \u2014 4 dmg");
  });

  it("says Use weapon when unarmed", () => {
    const state = stateWith({});
    expect(offerLabel(monsterOffers(state, 8)[0]!, state)).toBe("Use weapon");
  });

  it("labels barehanded with full monster value", () => {
    const state = stateWith({});
    expect(offerLabel(monsterOffers(state, 8)[1]!, state)).toBe("Barehanded \u2014 8 dmg");
  });

  it("labels drinking", () => {
    const healing = stateWith({ health: 10 });
    expect(offerLabel(offersFor(healing, c("hearts", 7))[0]!, healing)).toBe("Drink \u2014 +7 health");
  });

  it("labels a blocked potion as a discard", () => {
    const blocked = stateWith({ health: 10, potionUsedThisRoom: true });
    expect(offerLabel(offersFor(blocked, c("hearts", 7))[0]!, blocked)).toBe("Discard");
  });

  it("labels drinking at full health without promising healing", () => {
    const full = stateWith({ health: 20 });
    expect(offerLabel(offersFor(full, c("hearts", 7))[0]!, full)).toBe("Drink \u2014 no effect");
  });

  it("labels equipping, naming what it discards", () => {
    const armed = stateWith({ weapon: weaponOf(4) });
    expect(offerLabel(offersFor(armed, c("diamonds", 9))[0]!, armed)).toBe("Equip \u2014 discards 4\u2666");

    const unarmed = stateWith({});
    expect(offerLabel(offersFor(unarmed, c("diamonds", 9))[0]!, unarmed)).toBe("Equip");
  });

  it("labels running", () => {
    const state = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)] });
    expect(offerLabel(runOffer(state), state)).toBe("Run away");
  });
});

describe("offerReason", () => {
  it("is null for an enabled offer", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    expect(offerReason(monsterOffers(state, 8)[0]!, state)).toBeNull();
  });

  it("explains an unarmed weapon offer", () => {
    const state = stateWith({});
    expect(offerReason(monsterOffers(state, 8)[0]!, state)).toBe("No weapon equipped");
  });

  it("explains the threshold with the weapon and the number", () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    expect(offerReason(monsterOffers(state, 13)[0]!, state)).toBe("9\u2666 only kills below 10");
  });

  it("explains both run refusals", () => {
    const ran = stateWith({ room: [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)], ranLastRoom: true });
    expect(offerReason(runOffer(ran), ran)).toBe("You ran from the last room");

    const started = stateWith({ room: [c("clubs", 2), c("clubs", 3)] });
    expect(offerReason(runOffer(started), started)).toBe("Only before you resolve a card");
  });
});

describe("offerNote", () => {
  it("is null when there is nothing to caveat", () => {
    const state = stateWith({ health: 10 });
    expect(offerNote(offersFor(state, c("hearts", 7))[0]!)).toBeNull();
  });

  it("flags a blocked potion", () => {
    const blocked = stateWith({ health: 10, potionUsedThisRoom: true });
    expect(offerNote(offersFor(blocked, c("hearts", 7))[0]!)).toBe("Already drank this room");
  });

  it("flags full health", () => {
    const full = stateWith({ health: 20 });
    expect(offerNote(offersFor(full, c("hearts", 7))[0]!)).toBe("Already at full health");
  });
});

describe("logLine", () => {
  it("renders every entry kind", () => {
    expect(logLine({ kind: "deal", roomNumber: 3, cards: [c("clubs", 2), c("hearts", 9)] })).toBe(
      "Room 3 \u2014 dealt 2\u2663 9\u2665",
    );
    expect(
      logLine({ kind: "fight", monster: c("spades", 8), weapon: c("diamonds", 5), damage: 3, healthAfter: 17 }),
    ).toBe("5\u2666 vs 8\u2660 \u2014 3 damage, 17 health");
    expect(logLine({ kind: "fight", monster: c("clubs", 9), weapon: null, damage: 9, healthAfter: 8 })).toBe(
      "Barehanded vs 9\u2663 \u2014 9 damage, 8 health",
    );
    expect(logLine({ kind: "equip", weapon: c("diamonds", 9), discarded: c("diamonds", 4) })).toBe(
      "Equipped 9\u2666, discarding 4\u2666",
    );
    expect(logLine({ kind: "equip", weapon: c("diamonds", 9), discarded: null })).toBe("Equipped 9\u2666");
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 6, blocked: false, healthAfter: 14 })).toBe(
      "Drank 6\u2665 \u2014 +6 health, 14 total",
    );
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 0, blocked: true, healthAfter: 14 })).toBe(
      "Discarded 6\u2665 \u2014 already drank this room",
    );
    expect(logLine({ kind: "potion", card: c("hearts", 6), healed: 0, blocked: false, healthAfter: 20 })).toBe(
      "Drank 6\u2665 \u2014 no effect at full health",
    );
    expect(logLine({ kind: "run", roomNumber: 4 })).toBe("Ran from room 4");
    expect(logLine({ kind: "gameOver", outcome: "won", score: 14 })).toBe("Escaped the dungeon \u2014 score 14");
    expect(logLine({ kind: "gameOver", outcome: "lost", score: -37 })).toBe("Died in the dungeon \u2014 score -37");
  });
});

describe("outcomeHeadline", () => {
  it("distinguishes a zero-score loss from a win", () => {
    expect(outcomeHeadline(stateWith({ status: "won", health: 1 }))).toBe("You escaped the dungeon");
    expect(outcomeHeadline(stateWith({ status: "lost", health: 0 }))).toBe("You died in the dungeon");
  });
});
