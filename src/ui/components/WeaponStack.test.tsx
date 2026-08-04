import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { weaponOf } from "../../engine/test-fixtures";
import { WeaponStack } from "./WeaponStack";

describe("WeaponStack", () => {
  it("says nothing is equipped when unarmed", () => {
    render(<WeaponStack weapon={null} />);
    expect(screen.getByText("No weapon")).toBeInTheDocument();
  });

  it("shows a fresh weapon as killing anything", () => {
    render(<WeaponStack weapon={weaponOf(9)} />);
    expect(screen.getByRole("region", { name: /weapon/i })).toBeInTheDocument();
    expect(screen.getByText("9♦")).toBeInTheDocument();
    expect(screen.getByText("kills anything")).toBeInTheDocument();
  });

  it("states the threshold explicitly", () => {
    render(<WeaponStack weapon={weaponOf(9, [12, 10])} />);
    expect(screen.getByText(/kills below/i)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("lists the kills newest first", () => {
    render(<WeaponStack weapon={weaponOf(9, [12, 10, 4])} />);
    const kills = screen.getAllByTestId("kill");
    expect(kills.map((node) => node.textContent)).toEqual(["4♠", "10♠", "Q♠"]);
  });
});
