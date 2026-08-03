import { buildDungeon, type Card } from "./cards";
import type { LogEntry } from "./log";
import { mulberry32, normalizeSeed, seedToInt, shuffle } from "./rng";

export const MAX_HEALTH = 20;
export const ROOM_SIZE = 4;

export type GameStatus = "playing" | "won" | "lost";

export type Weapon = {
  readonly card: Card;
  /** Defeated monsters, oldest first. The last element sets the threshold. */
  readonly kills: readonly Card[];
};

export type GameState = {
  readonly seed: string;
  readonly deck: readonly Card[];
  readonly room: readonly Card[];
  readonly discard: readonly Card[];
  readonly weapon: Weapon | null;
  readonly health: number;
  readonly potionUsedThisRoom: boolean;
  readonly ranLastRoom: boolean;
  readonly roomNumber: number;
  readonly status: GameStatus;
  readonly log: readonly LogEntry[];
};

/**
 * The highest monster value this weapon may still be used on is
 * strictly below the returned threshold. Null means no limit.
 */
export function weaponThreshold(weapon: Weapon | null): number | null {
  if (weapon === null || weapon.kills.length === 0) return null;
  return (weapon.kills[weapon.kills.length - 1] as Card).rank;
}

export function createGame(seed: string): GameState {
  const normalized = normalizeSeed(seed);
  if (normalized === null) throw new Error(`Invalid seed: ${JSON.stringify(seed)}`);

  const shuffled = shuffle(buildDungeon(), mulberry32(seedToInt(normalized)));
  const room = shuffled.slice(0, ROOM_SIZE);

  return {
    seed: normalized,
    deck: shuffled.slice(ROOM_SIZE),
    room,
    discard: [],
    weapon: null,
    health: MAX_HEALTH,
    potionUsedThisRoom: false,
    ranLastRoom: false,
    roomNumber: 1,
    status: "playing",
    // Copied, not aliased: `readonly` is compile-time only, so sharing the
    // array would let a future in-place room mutation silently rewrite history.
    log: [{ kind: "deal", roomNumber: 1, cards: [...room] }],
  };
}
