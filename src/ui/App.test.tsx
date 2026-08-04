import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/?seed=4F2A9C");
});

describe("App", () => {
  it("renders the HUD, a four-card room, the weapon slot, and the log", () => {
    render(<App />);
    expect(screen.getByLabelText(/^Health/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /^Room/ })).getAllByRole("group")).toHaveLength(4);
    expect(screen.getByRole("region", { name: "Equipped weapon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run away" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run log/i })).toBeInTheDocument();
  });

  it("resolves a card and reflects it in the log", async () => {
    render(<App />);
    const before = screen.getByTestId("log-live").textContent;
    const firstOffer = screen.getAllByTestId("offer").find((b) => !b.hasAttribute("disabled"));
    if (firstOffer === undefined) throw new Error("no enabled offer button rendered");
    await userEvent.click(firstOffer);
    expect(screen.getByTestId("log-live").textContent).not.toBe(before);
  });

  it("plays a whole dungeon to a terminal state and shows the overlay", async () => {
    render(<App />);

    for (let step = 0; step < 200; step += 1) {
      const dialog = screen.queryByRole("dialog");
      if (dialog !== null) {
        expect(within(dialog).getByTestId("score")).toBeInTheDocument();
        return;
      }
      const offer = screen.getAllByTestId("offer").find((b) => !b.hasAttribute("disabled"));
      if (offer === undefined) throw new Error("no enabled offer: the game deadlocked");
      await userEvent.click(offer);
    }

    throw new Error("game did not finish within 200 actions");
  });
});
