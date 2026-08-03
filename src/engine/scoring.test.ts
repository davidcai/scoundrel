import { describe, expect, it } from "vitest";
import { buildDungeon } from "./cards";
import { finalScore, remainingMonsterValue } from "./scoring";
import { c, stateWith } from "./test-fixtures";

describe("remainingMonsterValue", () => {
  it("counts monsters in the deck and the room, ignoring hearts and diamonds", () => {
    const state = stateWith({
      deck: [c("clubs", 14), c("hearts", 9), c("diamonds", 8)],
      room: [c("spades", 13), c("hearts", 2)],
    });
    expect(remainingMonsterValue(state)).toBe(27);
  });

  it("is 208 for a whole unplayed dungeon", () => {
    expect(remainingMonsterValue(stateWith({ deck: buildDungeon() }))).toBe(208);
  });

  it("ignores the discard pile and the weapon stack", () => {
    const state = stateWith({
      deck: [c("clubs", 5)],
      discard: [c("clubs", 14)],
      weapon: { card: c("diamonds", 9), kills: [c("spades", 13)] },
    });
    expect(remainingMonsterValue(state)).toBe(5);
  });

  it("is 0 when nothing is left", () => {
    expect(remainingMonsterValue(stateWith({}))).toBe(0);
  });
});

describe("finalScore", () => {
  it("is the remaining health on a win", () => {
    expect(finalScore(stateWith({ status: "won", health: 14 }))).toBe(14);
  });

  it("is the negated remaining monster value on a loss (rule 10)", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [c("clubs", 14), c("clubs", 13)],
      room: [c("spades", 12), c("hearts", 5)],
    });
    expect(finalScore(state)).toBe(-39);
  });

  it("excludes the monster that killed you, since it was resolved into the discard", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [c("spades", 3)],
      room: [c("clubs", 5)],
      discard: [c("clubs", 14)],
    });
    expect(finalScore(state)).toBe(-8);
  });

  it("is 0 when you die on the dungeon's final card", () => {
    const state = stateWith({
      status: "lost",
      health: 0,
      deck: [],
      room: [],
      discard: [c("clubs", 14)],
    });
    expect(finalScore(state)).toBe(0);
  });

  it("throws while the game is still in progress", () => {
    expect(() => finalScore(stateWith({ status: "playing" }))).toThrow(/in progress/i);
  });
});
