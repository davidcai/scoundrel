import { describe, expect, it } from "vitest";
import { mulberry32, normalizeSeed, seedToInt, shuffle } from "./rng";

describe("normalizeSeed", () => {
  it("uppercases valid six-hex seeds", () => {
    expect(normalizeSeed("4f2a9c")).toBe("4F2A9C");
    expect(normalizeSeed("000000")).toBe("000000");
    expect(normalizeSeed("FFFFFF")).toBe("FFFFFF");
  });

  // Pins .trim(). Without this, deleting it passes the whole suite, and a seed
  // pasted from a URL or a chat message with surrounding whitespace would be
  // rejected as malformed instead of normalized.
  it("tolerates surrounding whitespace", () => {
    expect(normalizeSeed("  4f2a9c  ")).toBe("4F2A9C");
    expect(normalizeSeed("\t4F2A9C\n")).toBe("4F2A9C");
  });

  it("rejects anything else", () => {
    for (const bad of ["", "4F2A9", "4F2A9C0", "GGGGGG", "4F 2A9C", "-4F2A9", "4F2A9Z"]) {
      expect(normalizeSeed(bad)).toBeNull();
    }
  });
});

describe("seedToInt", () => {
  it("parses hex", () => {
    expect(seedToInt("000000")).toBe(0);
    expect(seedToInt("FFFFFF")).toBe(16777215);
    expect(seedToInt("4F2A9C")).toBe(0x4f2a9c);
  });
});

describe("mulberry32", () => {
  it("produces values in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  // Kills the non-advancing mutant. A generator returning one constant forever
  // satisfies every other assertion here: the range check accepts a constant,
  // the cross-instance check compares [x,x,x] to [x,x,x], and the cross-seed
  // check only compares first draws. Downstream that mutant yields a deck in
  // near-build order — a visibly unshuffled dungeon with a green suite.
  it("advances its state, so successive draws from one instance differ", () => {
    const rng = mulberry32(999);
    expect(new Set([rng(), rng(), rng()]).size).toBe(3);
  });

  it("is deterministic for a given seed", () => {
    const a = mulberry32(999);
    const b = mulberry32(999);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("differs across seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  // Localizes a constant change to this file. Task 4 pins the whole
  // seed -> dungeon contract, but that test cannot say WHICH layer moved:
  // PRNG constants, buildDungeon's order, and shuffle's bounds all fail it
  // identically. This one fingers the PRNG specifically.
  //
  // These constants are a compatibility contract. Seeds appear in shared URLs
  // and inside saved games, so changing them silently remaps every existing
  // run. If this fails and you did not intend that, do not update the value.
  it("emits a pinned first draw for a known seed", () => {
    expect(mulberry32(seedToInt("4F2A9C"))()).toBe(0.07600133842788637);
  });
});

describe("shuffle", () => {
  const source = Array.from({ length: 44 }, (_, i) => i);

  it("does not mutate the input", () => {
    const input = [...source];
    shuffle(input, mulberry32(7));
    expect(input).toEqual(source);
  });

  it("preserves every element exactly once", () => {
    const out = shuffle(source, mulberry32(7));
    expect([...out].sort((a, b) => a - b)).toEqual(source);
  });

  it("is deterministic for a given seed", () => {
    expect(shuffle(source, mulberry32(42))).toEqual(shuffle(source, mulberry32(42)));
  });

  it("actually reorders", () => {
    expect(shuffle(source, mulberry32(42))).not.toEqual(source);
  });
});
