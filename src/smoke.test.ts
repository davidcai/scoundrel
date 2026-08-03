import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("has a live DOM, not just a defined global", () => {
    expect(document.createElement("div")).toBeInstanceOf(HTMLElement);
  });

  // Locks in setupFiles: this matcher only exists if test-setup.ts ran.
  it("has jest-dom matchers from setupFiles", () => {
    expect(document.createElement("div")).toBeEmptyDOMElement();
  });
});
