import { describe, expect, it } from "vitest";
import { buildDungeon, makeCard, roleOf, type Suit } from "./cards";

describe("makeCard", () => {
  it("builds a stable id from suit letter and rank", () => {
    expect(makeCard("spades", 8).id).toBe("S8");
    expect(makeCard("clubs", 14).id).toBe("C14");
    expect(makeCard("diamonds", 5).id).toBe("D5");
    expect(makeCard("hearts", 10).id).toBe("H10");
  });
});

describe("roleOf", () => {
  it("maps suits to roles", () => {
    expect(roleOf(makeCard("clubs", 7))).toBe("monster");
    expect(roleOf(makeCard("spades", 7))).toBe("monster");
    expect(roleOf(makeCard("diamonds", 7))).toBe("weapon");
    expect(roleOf(makeCard("hearts", 7))).toBe("potion");
  });
});

describe("buildDungeon", () => {
  const deck = buildDungeon();
  const countOf = (suit: Suit) => deck.filter((c) => c.suit === suit).length;

  it("has exactly 44 cards", () => {
    expect(deck).toHaveLength(44);
  });

  it("has 13 clubs, 13 spades, 9 diamonds, 9 hearts", () => {
    expect(countOf("clubs")).toBe(13);
    expect(countOf("spades")).toBe(13);
    expect(countOf("diamonds")).toBe(9);
    expect(countOf("hearts")).toBe(9);
  });

  it("excludes red face cards and red aces", () => {
    const red = deck.filter((c) => c.suit === "diamonds" || c.suit === "hearts");
    expect(red.every((c) => c.rank >= 2 && c.rank <= 10)).toBe(true);
  });

  it("includes black ranks 2 through 14", () => {
    const clubRanks = deck.filter((c) => c.suit === "clubs").map((c) => c.rank).sort((a, b) => a - b);
    expect(clubRanks).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("has unique ids", () => {
    expect(new Set(deck.map((c) => c.id)).size).toBe(44);
  });

  it("totals 208 monster value", () => {
    const monsterValue = deck.filter((c) => roleOf(c) === "monster").reduce((sum, c) => sum + c.rank, 0);
    expect(monsterValue).toBe(208);
  });

  it("returns a fresh array each call", () => {
    expect(buildDungeon()).not.toBe(buildDungeon());
  });
});
