import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { runOffer } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { EMPTY_STATS, SCHEMA, type Stats } from "../../storage/persistence";
import { Hud } from "./Hud";

const fullRoom = [c("clubs", 2), c("clubs", 3), c("clubs", 4), c("clubs", 5)];

const renderHud = (
  patch: Parameters<typeof stateWith>[0],
  stats: Stats = EMPTY_STATS,
) => {
  const state = stateWith({ room: fullRoom, ...patch });
  const onAction = vi.fn();
  render(<Hud state={state} stats={stats} runOffer={runOffer(state)} onAction={onAction} />);
  return onAction;
};

describe("Hud readouts", () => {
  it("shows health against the maximum", () => {
    renderHud({ health: 13 });
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByLabelText("Health 13 of 20")).toBeInTheDocument();
  });

  it("shows deck count, room number, and seed", () => {
    renderHud({ deck: [c("spades", 6), c("spades", 7)], roomNumber: 5, seed: "4F2A9C" });
    expect(screen.getByText(/Deck/)).toHaveTextContent("2");
    expect(screen.getByText(/Room/)).toHaveTextContent("5");
    expect(screen.getByText(/Seed/)).toHaveTextContent("4F2A9C");
  });

  it("shows an em dash when there is no best score", () => {
    renderHud({}, EMPTY_STATS);
    expect(screen.getByText(/Best/)).toHaveTextContent("—");
  });

  it("shows a best score once one exists, including a negative one", () => {
    renderHud({}, { schema: SCHEMA, best: 14, played: 3, won: 1 });
    expect(screen.getByText(/Best/)).toHaveTextContent("14");

    render(<Hud state={stateWith({ room: fullRoom })} stats={{ schema: SCHEMA, best: -37, played: 1, won: 0 }} runOffer={runOffer(stateWith({ room: fullRoom }))} onAction={vi.fn()} />);
    expect(screen.getAllByText(/Best/).at(-1)).toHaveTextContent("-37");
  });
});

describe("Hud run button", () => {
  it("is enabled on an untouched room and dispatches RUN", async () => {
    const onAction = renderHud({});
    const button = screen.getByRole("button", { name: /Run away/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onAction).toHaveBeenCalledWith({ type: "RUN" });
  });

  it("is disabled mid-room with the reason", () => {
    renderHud({ room: fullRoom.slice(1) });
    expect(screen.getByRole("button", { name: /Run away/ })).toBeDisabled();
    expect(screen.getByText("Only before you resolve a card")).toBeInTheDocument();
  });

  it("is disabled after running last room with the reason", () => {
    renderHud({ ranLastRoom: true });
    expect(screen.getByRole("button", { name: /Run away/ })).toBeDisabled();
    expect(screen.getByText("You ran from the last room")).toBeInTheDocument();
  });

  it("never dispatches when disabled", async () => {
    const onAction = renderHud({ ranLastRoom: true });
    await userEvent.click(screen.getByRole("button", { name: /Run away/ }));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("Hud damage feedback", () => {
  it("shows the damage from the most recent fight", () => {
    renderHud({
      health: 12,
      log: [{ kind: "fight", monster: c("clubs", 8), weapon: null, damage: 8, healthAfter: 12 }],
    });
    expect(screen.getByText("-8")).toBeInTheDocument();
  });

  it("shows nothing after a fight that dealt no damage", () => {
    renderHud({
      log: [{ kind: "fight", monster: c("clubs", 8), weapon: c("diamonds", 9), damage: 0, healthAfter: 20 }],
    });
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("shows nothing when the last entry is not a fight", () => {
    renderHud({ log: [{ kind: "run", roomNumber: 1 }] });
    expect(screen.queryByText(/^-\d+$/)).not.toBeInTheDocument();
  });
});
