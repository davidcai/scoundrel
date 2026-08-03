import { makeCard, type Card, type Suit } from "./cards";
import type { GameState, Weapon } from "./state";

/** Shorthand card builder for tests. */
export const c = (suit: Suit, rank: number): Card => makeCard(suit, rank);

/** A minimal playing state. Override only what a test cares about. */
export function stateWith(patch: Partial<GameState>): GameState {
  return {
    seed: "000001",
    deck: [],
    room: [],
    discard: [],
    weapon: null,
    health: 20,
    potionUsedThisRoom: false,
    ranLastRoom: false,
    roomNumber: 1,
    status: "playing",
    log: [],
    ...patch,
  };
}

/** A diamond of `rank` that has already killed the given spade ranks, oldest first. */
export function weaponOf(rank: number, killRanks: number[] = []): Weapon {
  return { card: makeCard("diamonds", rank), kills: killRanks.map((r) => makeCard("spades", r)) };
}
