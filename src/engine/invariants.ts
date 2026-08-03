import { buildDungeon, roleOf, type Card, type Suit } from "./cards";
import { normalizeSeed } from "./rng";
import { MAX_HEALTH, ROOM_SIZE, type GameState, type GameStatus } from "./state";

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

const DECK_SIZE = buildDungeon().length;
const VALID_IDS = new Set(buildDungeon().map((card) => card.id));

function fail(message: string): never {
  throw new InvariantError(message);
}

/** Throws InvariantError if `state` is not a reachable Scoundrel position. */
export function assertInvariants(state: GameState): void {
  const all: Card[] = [
    ...state.deck,
    ...state.room,
    ...state.discard,
    ...(state.weapon === null ? [] : [state.weapon.card, ...state.weapon.kills]),
  ];

  if (all.length !== DECK_SIZE) fail(`Expected ${DECK_SIZE} cards, found ${all.length}`);

  const ids = new Set(all.map((card) => card.id));
  if (ids.size !== DECK_SIZE) fail("Duplicate card ids");
  for (const id of ids) if (!VALID_IDS.has(id)) fail(`Unknown card id: ${id}`);

  if (state.health < 0 || state.health > MAX_HEALTH) fail(`Health out of range: ${state.health}`);
  if (state.room.length > ROOM_SIZE) fail(`Room too large: ${state.room.length}`);
  if (state.roomNumber < 1) fail(`Room number out of range: ${state.roomNumber}`);
  if (normalizeSeed(state.seed) === null) fail(`Invalid seed: ${state.seed}`);

  if (state.weapon !== null) {
    if (roleOf(state.weapon.card) !== "weapon") fail("Equipped card is not a diamond");
    let previous = Number.POSITIVE_INFINITY;
    for (const kill of state.weapon.kills) {
      if (roleOf(kill) !== "monster") fail("Weapon stack holds a non-monster");
      if (kill.rank >= previous) fail("Weapon kills are not strictly descending");
      previous = kill.rank;
    }
  }

  if (state.status === "playing") {
    if (state.health === 0) fail("Playing at zero health");
    if (state.room.length === 0 && state.deck.length === 0) fail("Playing with nothing left");
  }
  if (state.status === "lost" && state.health !== 0) fail("Lost with health remaining");
  if (state.status === "won" && (state.room.length > 0 || state.deck.length > 0)) {
    fail("Won with cards remaining");
  }
}

const SUITS: readonly Suit[] = ["clubs", "spades", "diamonds", "hearts"];
const STATUSES: readonly GameStatus[] = ["playing", "won", "lost"];

function isCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card["id"] === "string" &&
    typeof card["rank"] === "number" &&
    typeof card["suit"] === "string" &&
    SUITS.includes(card["suit"] as Suit) &&
    VALID_IDS.has(card["id"])
  );
}

function isCardArray(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard);
}

/**
 * Validates untrusted input (a localStorage payload) into a GameState.
 * Returns null rather than throwing, because a bad save is expected, not exceptional.
 */
export function validateState(candidate: unknown): GameState | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const raw = candidate as Record<string, unknown>;

  if (typeof raw["seed"] !== "string") return null;
  if (typeof raw["health"] !== "number" || !Number.isInteger(raw["health"])) return null;
  if (typeof raw["potionUsedThisRoom"] !== "boolean") return null;
  if (typeof raw["ranLastRoom"] !== "boolean") return null;
  if (typeof raw["roomNumber"] !== "number" || !Number.isInteger(raw["roomNumber"])) return null;
  if (typeof raw["status"] !== "string" || !STATUSES.includes(raw["status"] as GameStatus)) return null;
  if (!isCardArray(raw["deck"]) || !isCardArray(raw["room"]) || !isCardArray(raw["discard"])) return null;
  if (!Array.isArray(raw["log"])) return null;

  const weaponRaw = raw["weapon"];
  if (weaponRaw !== null) {
    if (typeof weaponRaw !== "object" || weaponRaw === null) return null;
    const weapon = weaponRaw as Record<string, unknown>;
    if (!isCard(weapon["card"]) || !isCardArray(weapon["kills"])) return null;
  }

  const state = candidate as GameState;
  try {
    assertInvariants(state);
  } catch {
    return null;
  }
  return state;
}
