import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createGame } from "../../engine";
import { SCHEMA, loadRun, loadStats, saveRun, saveStats } from "../../storage/persistence";
import { useGame } from "./useGame";

function Harness() {
  const game = useGame();
  const monster = game.state.room.find((c) => c.suit === "clubs" || c.suit === "spades");
  return (
    <div>
      <p data-testid="seed">{game.state.seed}</p>
      <p data-testid="health">{game.state.health}</p>
      <p data-testid="deck">{game.state.deck.length}</p>
      <p data-testid="status">{game.state.status}</p>
      <p data-testid="best">{String(game.stats.best)}</p>
      <p data-testid="played">{game.stats.played}</p>
      <p data-testid="run-enabled">{String(game.runOffer.enabled)}</p>
      {monster !== undefined && (
        <button
          onClick={() => game.dispatch({ type: "FIGHT", cardId: monster.id, useWeapon: false })}
        >
          fight
        </button>
      )}
      <button onClick={() => game.newGame("ABCDEF")}>new</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("useGame start resolution", () => {
  it("generates a seed and writes it to the URL when there is nothing to resume", () => {
    render(<Harness />);
    const seed = screen.getByTestId("seed").textContent ?? "";
    expect(seed).toMatch(/^[0-9A-F]{6}$/);
    expect(new URLSearchParams(window.location.search).get("seed")).toBe(seed);
  });

  it("resumes a saved run", () => {
    const state = { ...createGame("4F2A9C"), health: 11 };
    saveRun({ schema: SCHEMA, state, statsRecorded: false });
    render(<Harness />);
    expect(screen.getByTestId("seed")).toHaveTextContent("4F2A9C");
    expect(screen.getByTestId("health")).toHaveTextContent("11");
  });

  it("starts fresh when the URL seed differs from the saved run", () => {
    saveRun({ schema: SCHEMA, state: { ...createGame("4F2A9C"), health: 11 }, statsRecorded: false });
    window.history.replaceState(null, "", "/?seed=000123");
    render(<Harness />);
    expect(screen.getByTestId("seed")).toHaveTextContent("000123");
    expect(screen.getByTestId("health")).toHaveTextContent("20");
  });
});

describe("useGame dispatch and persistence", () => {
  it("applies an action and persists the result", async () => {
    render(<Harness />);
    const before = Number(screen.getByTestId("health").textContent);
    await userEvent.click(screen.getByRole("button", { name: "fight" }));
    const after = Number(screen.getByTestId("health").textContent);
    expect(after).toBeLessThanOrEqual(before);
    expect(loadRun()?.state.health).toBe(after);
  });

  it("disables running once a card is resolved", async () => {
    render(<Harness />);
    expect(screen.getByTestId("run-enabled")).toHaveTextContent("true");
    await userEvent.click(screen.getByRole("button", { name: "fight" }));
    expect(screen.getByTestId("run-enabled")).toHaveTextContent("false");
  });

  it("starts a new game on the given seed and rewrites the URL", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "new" }));
    expect(screen.getByTestId("seed")).toHaveTextContent("ABCDEF");
    expect(screen.getByTestId("deck")).toHaveTextContent("40");
    expect(new URLSearchParams(window.location.search).get("seed")).toBe("ABCDEF");
  });
});

describe("useGame stats", () => {
  it("records a finished run exactly once", () => {
    const won = { ...createGame("4F2A9C"), status: "won" as const, health: 9, deck: [], room: [], discard: [] };
    // A won state needs all 44 cards accounted for, so park them in discard.
    const full = { ...won, discard: createGame("4F2A9C").deck.concat(createGame("4F2A9C").room) };
    saveRun({ schema: SCHEMA, state: full, statsRecorded: false });

    const first = render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
    expect(screen.getByTestId("best")).toHaveTextContent("9");
    expect(loadRun()?.statsRecorded).toBe(true);
    first.unmount();

    render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
  });

  it("does not re-record on remount of an already-recorded run", () => {
    const base = createGame("4F2A9C");
    const full = {
      ...base, status: "won" as const, health: 9, deck: [], room: [],
      discard: base.deck.concat(base.room),
    };
    saveStats({ schema: SCHEMA, best: 9, played: 1, won: 1 });
    saveRun({ schema: SCHEMA, state: full, statsRecorded: true });

    render(<Harness />);
    expect(screen.getByTestId("played")).toHaveTextContent("1");
    expect(loadStats().played).toBe(1);
  });

  it("clears statsRecorded for a new game", async () => {
    render(<Harness />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "new" }));
    });
    expect(loadRun()?.statsRecorded).toBe(false);
  });
});
