import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { buildDungeon } from "../../engine";
import { c, stateWith } from "../../engine/test-fixtures";
import { GameOverOverlay } from "./GameOverOverlay";

const won = stateWith({ status: "won", health: 9, discard: buildDungeon() });
const lost = stateWith({
  status: "lost",
  health: 0,
  deck: buildDungeon().filter((card) => card.id !== "C14"),
  discard: [c("clubs", 14)],
});

describe("GameOverOverlay", () => {
  it("renders nothing while the game is in progress", () => {
    const { container } = render(
      <GameOverOverlay state={stateWith({ deck: buildDungeon() })} onNewGame={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announces a win with the score", () => {
    render(<GameOverOverlay state={won} onNewGame={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("You escaped the dungeon")).toBeInTheDocument();
    expect(screen.getByTestId("score")).toHaveTextContent("9");
  });

  it("announces a loss with the negative score", () => {
    render(<GameOverOverlay state={lost} onNewGame={vi.fn()} />);
    expect(screen.getByText("You died in the dungeon")).toBeInTheDocument();
    expect(screen.getByTestId("score")).toHaveTextContent("-194");
  });

  it("starts a new random game", async () => {
    const onNewGame = vi.fn();
    render(<GameOverOverlay state={won} onNewGame={onNewGame} />);
    await userEvent.click(screen.getByRole("button", { name: "New game" }));
    expect(onNewGame).toHaveBeenCalledWith();
  });

  it("replays the same seed", async () => {
    const onNewGame = vi.fn();
    render(<GameOverOverlay state={won} onNewGame={onNewGame} />);
    await userEvent.click(screen.getByRole("button", { name: /Replay/ }));
    expect(onNewGame).toHaveBeenCalledWith(won.seed);
  });

  it("shows the seed so a run is reportable", () => {
    render(<GameOverOverlay state={won} onNewGame={vi.fn()} />);
    expect(screen.getByText(new RegExp(won.seed))).toBeInTheDocument();
  });
});
