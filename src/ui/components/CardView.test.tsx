import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { offersFor } from "../../engine";
import { c, stateWith, weaponOf } from "../../engine/test-fixtures";
import { CardView } from "./CardView";

const show = (state: Parameters<typeof offersFor>[0], card: Parameters<typeof offersFor>[1]) => {
  const onAction = vi.fn();
  render(<CardView card={card} offers={offersFor(state, card)} state={state} onAction={onAction} />);
  return onAction;
};

describe("CardView faces", () => {
  it("shows the rank and suit", () => {
    show(stateWith({}), c("spades", 8));
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("\u2660")).toBeInTheDocument();
  });

  it("labels face ranks", () => {
    show(stateWith({}), c("clubs", 13));
    expect(screen.getByText("K")).toBeInTheDocument();
  });

  it("carries an accessible name including the role", () => {
    show(stateWith({}), c("hearts", 10));
    expect(screen.getByRole("group", { name: "Ten of Hearts, potion" })).toBeInTheDocument();
  });
});

describe("CardView offers", () => {
  it("renders both monster offers as buttons", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    show(state, c("clubs", 8));
    expect(screen.getByRole("button", { name: /Use 9♦ — 0 dmg/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Barehanded — 8 dmg/ })).toBeEnabled();
  });

  it("disables the weapon offer and shows the reason", () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    show(state, c("clubs", 13));
    expect(screen.getByRole("button", { name: /Use 9♦/ })).toBeDisabled();
    expect(screen.getByText("9♦ only kills below 10")).toBeInTheDocument();
  });

  it("shows the unarmed reason", () => {
    show(stateWith({}), c("clubs", 8));
    expect(screen.getByRole("button", { name: /Use weapon/ })).toBeDisabled();
    expect(screen.getByText("No weapon equipped")).toBeInTheDocument();
  });

  it("renders a single potion offer with the heal amount", () => {
    show(stateWith({ health: 10 }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Drink — \+7 health/ })).toBeEnabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("tags every offer button with a stable test id for end-to-end selection", () => {
    const state = stateWith({ weapon: weaponOf(9) });
    show(state, c("clubs", 8));
    expect(screen.getAllByTestId("offer")).toHaveLength(2);
  });

  it("keeps a blocked potion clickable and explains it", () => {
    show(stateWith({ health: 10, potionUsedThisRoom: true }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Discard/ })).toBeEnabled();
    expect(screen.getByText("Already drank this room")).toBeInTheDocument();
  });

  it("notes drinking at full health", () => {
    show(stateWith({ health: 20 }), c("hearts", 7));
    expect(screen.getByRole("button", { name: /Drink — no effect/ })).toBeEnabled();
    expect(screen.getByText("Already at full health")).toBeInTheDocument();
  });

  it("names what equipping discards", () => {
    show(stateWith({ weapon: weaponOf(4) }), c("diamonds", 9));
    expect(screen.getByRole("button", { name: /Equip — discards 4♦/ })).toBeEnabled();
  });
});

describe("CardView dispatch", () => {
  it("sends the exact action for the clicked offer", async () => {
    const state = stateWith({ weapon: weaponOf(9) });
    const onAction = show(state, c("clubs", 8));

    await userEvent.click(screen.getByRole("button", { name: /Use 9♦/ }));
    expect(onAction).toHaveBeenCalledWith({ type: "FIGHT", cardId: "C8", useWeapon: true });

    await userEvent.click(screen.getByRole("button", { name: /Barehanded/ }));
    expect(onAction).toHaveBeenCalledWith({ type: "FIGHT", cardId: "C8", useWeapon: false });
  });

  it("never dispatches from a disabled offer", async () => {
    const state = stateWith({ weapon: weaponOf(9, [10]) });
    const onAction = show(state, c("clubs", 13));
    await userEvent.click(screen.getByRole("button", { name: /Use 9♦/ }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("is keyboard operable", async () => {
    const onAction = show(stateWith({ health: 10 }), c("hearts", 7));
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith({ type: "DRINK", cardId: "H7" });
  });
});
