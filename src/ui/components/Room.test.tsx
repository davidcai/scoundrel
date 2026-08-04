import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { offersFor } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { Room } from "./Room";

const renderRoom = (state: Parameters<typeof offersFor>[0]) =>
  render(<Room state={state} offersFor={(card) => offersFor(state, card)} onAction={vi.fn()} />);

describe("Room", () => {
  it("renders every face-up card as a group", () => {
    renderRoom(stateWith({ room: [c("clubs", 8), c("hearts", 7), c("diamonds", 5), c("spades", 13)] }));
    expect(screen.getByRole("group", { name: "Eight of Clubs, monster" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Seven of Hearts, potion" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Five of Diamonds, weapon" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "King of Spades, monster" })).toBeInTheDocument();
  });

  it("renders a short final room without padding it out", () => {
    renderRoom(stateWith({ room: [c("clubs", 8), c("hearts", 7)] }));
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("is labelled with the room number", () => {
    renderRoom(stateWith({ room: [c("clubs", 8)], roomNumber: 7 }));
    expect(screen.getByRole("region", { name: "Room 7" })).toBeInTheDocument();
  });

  it("renders nothing when the room is empty", () => {
    renderRoom(stateWith({ room: [] }));
    expect(screen.queryAllByRole("group")).toHaveLength(0);
  });
});
