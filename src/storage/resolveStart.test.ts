import { describe, expect, it } from "vitest";
import { createGame } from "../engine";
import { SCHEMA, type SavedRun } from "./persistence";
import { resolveStart } from "./resolveStart";

const savedRun = (seed: string): SavedRun => ({
  schema: SCHEMA,
  state: createGame(seed),
  statsRecorded: false,
});

const never = () => {
  throw new Error("makeSeed should not have been called");
};

describe("resolveStart", () => {
  it("resumes when the URL seed matches the saved run (the refresh case)", () => {
    const saved = savedRun("4F2A9C");
    expect(resolveStart("4F2A9C", saved, never)).toEqual({ kind: "resume", run: saved });
  });

  it("starts fresh when the URL seed differs (the shared-link case)", () => {
    expect(resolveStart("000123", savedRun("4F2A9C"), never)).toEqual({ kind: "fresh", seed: "000123" });
  });

  it("starts fresh on a URL seed with no saved run", () => {
    expect(resolveStart("000123", null, never)).toEqual({ kind: "fresh", seed: "000123" });
  });

  it("resumes a saved run when the URL has no seed", () => {
    const saved = savedRun("4F2A9C");
    expect(resolveStart(null, saved, never)).toEqual({ kind: "resume", run: saved });
  });

  it("generates a seed when there is neither a URL seed nor a saved run", () => {
    expect(resolveStart(null, null, () => "ABCDEF")).toEqual({ kind: "fresh", seed: "ABCDEF" });
  });

  it("resumes a finished run rather than restarting it", () => {
    const saved: SavedRun = { schema: SCHEMA, state: { ...createGame("4F2A9C"), status: "won" }, statsRecorded: true };
    expect(resolveStart(null, saved, never)).toEqual({ kind: "resume", run: saved });
  });
});
