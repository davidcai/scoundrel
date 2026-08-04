import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../engine";
import { c } from "../../engine/test-fixtures";
import { LogDrawer } from "./LogDrawer";

const log: LogEntry[] = [
  { kind: "deal", roomNumber: 1, cards: [c("clubs", 2)] },
  { kind: "equip", weapon: c("diamonds", 9), discarded: null },
  { kind: "fight", monster: c("clubs", 8), weapon: c("diamonds", 9), damage: 0, healthAfter: 20 },
  { kind: "potion", card: c("hearts", 6), healed: 6, blocked: false, healthAfter: 20 },
];

describe("LogDrawer collapsed", () => {
  it("shows only the newest entry", () => {
    render(<LogDrawer log={log} />);
    expect(screen.getByText("Drank 6♥ — +6 health, 20 total")).toBeInTheDocument();
    expect(screen.queryByText("Equipped 9♦")).not.toBeInTheDocument();
  });

  it("announces the newest entry politely", () => {
    render(<LogDrawer log={log} />);
    const live = screen.getByTestId("log-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Drank 6♥ — +6 health, 20 total");
  });

  it("handles an empty log", () => {
    render(<LogDrawer log={[]} />);
    expect(screen.getByRole("button", { name: /run log/i })).toBeInTheDocument();
  });
});

describe("LogDrawer expanded", () => {
  it("shows every entry newest first once expanded", async () => {
    render(<LogDrawer log={log} />);
    await userEvent.click(screen.getByRole("button", { name: /run log/i }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Drank 6♥");
    expect(items[3]).toHaveTextContent("Room 1 — dealt 2♣");
  });

  it("collapses again on a second click", async () => {
    render(<LogDrawer log={log} />);
    const toggle = screen.getByRole("button", { name: /run log/i });
    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    await userEvent.click(toggle);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("reports expansion state to assistive tech", async () => {
    render(<LogDrawer log={log} />);
    const toggle = screen.getByRole("button", { name: /run log/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
