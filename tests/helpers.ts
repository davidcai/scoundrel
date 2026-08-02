import { type Card, buildDeck } from '../src/game/cards.js';
import { type GameState, MAX_HEALTH } from '../src/game/engine.js';

const BY_ID = new Map(buildDeck().map((card) => [card.id, card]));

/** Look a card up by id, e.g. `card('s14')` for the Ace of Spades. */
export function card(id: string): Card {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`No such card: ${id}`);
  return found;
}

export function cards(...ids: string[]): Card[] {
  return ids.map(card);
}

/** Builds a game state directly, so rules can be tested against exact setups. */
export function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    dungeon: [],
    room: [],
    discard: [],
    health: MAX_HEALTH,
    weapon: null,
    potionUsedThisRoom: false,
    avoidedLastRoom: false,
    roomNumber: 1,
    status: 'playing',
    log: [],
    nextLogId: 1,
    ...overrides,
  };
}

/** Every card lives in exactly one zone; the total must always be 44. */
export function totalCards(state: GameState): number {
  const onWeapon = state.weapon ? 1 + state.weapon.slain.length : 0;
  return state.dungeon.length + state.room.length + state.discard.length + onWeapon;
}
