import { describe, expect, it } from "vitest";
import { SEED_PATTERN } from "../engine";
import { randomSeed, readSeedFromUrl, writeSeedToUrl } from "./seedUrl";

describe("randomSeed", () => {
  it("produces a valid six-hex seed", () => {
    for (let i = 0; i < 200; i += 1) expect(randomSeed()).toMatch(SEED_PATTERN);
  });

  it("varies", () => {
    expect(new Set(Array.from({ length: 50 }, randomSeed)).size).toBeGreaterThan(1);
  });
});

describe("readSeedFromUrl", () => {
  it("reads and uppercases a valid seed", () => {
    expect(readSeedFromUrl("?seed=4f2a9c")).toBe("4F2A9C");
    expect(readSeedFromUrl("?other=1&seed=000001")).toBe("000001");
  });

  it("returns null when absent or malformed", () => {
    expect(readSeedFromUrl("")).toBeNull();
    expect(readSeedFromUrl("?other=1")).toBeNull();
    expect(readSeedFromUrl("?seed=")).toBeNull();
    expect(readSeedFromUrl("?seed=zzzzzz")).toBeNull();
    expect(readSeedFromUrl("?seed=4F2A9")).toBeNull();
    expect(readSeedFromUrl("?seed=4F2A9C0")).toBeNull();
  });
});

describe("writeSeedToUrl", () => {
  it("puts the seed in the query string without navigating", () => {
    writeSeedToUrl("4F2A9C");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("4F2A9C");
  });

  it("replaces an existing seed", () => {
    writeSeedToUrl("4F2A9C");
    writeSeedToUrl("000123");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("000123");
  });
});
