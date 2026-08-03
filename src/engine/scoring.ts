import { roleOf, type Card } from "./cards";
import type { GameState } from "./state";

/** Monster value still unresolved: the deck plus the face-up room, nothing else. */
export function remainingMonsterValue(state: GameState): number {
  return [...state.deck, ...state.room]
    .filter((card: Card) => roleOf(card) === "monster")
    .reduce((sum, card) => sum + card.rank, 0);
}

export function finalScore(state: GameState): number {
  if (state.status === "won") return state.health;
  if (state.status === "lost") return 0 - remainingMonsterValue(state);
  throw new Error("finalScore called on a game still in progress");
}
