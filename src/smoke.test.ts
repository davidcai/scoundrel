import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("has a DOM available", () => {
    expect(typeof document).toBe("object");
  });
});
