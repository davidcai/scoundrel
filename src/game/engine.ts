/**
 * Scoundrel rules engine.
 *
 * Pure and DOM-free: every action takes a state and returns a new state, so
 * the whole rule set is unit-testable and the UI is just a projection of it.
 * `docs/rules.md` is the source of truth; rule text is quoted at the point it
 * is implemented.
 */

import {
  type Card,
  buildDeck,
  cardName,
  isMonster,
  isPotion,
  isWeapon,
} from './cards.js';
import { type Rng, mulberry32, randomSeed, shuffle } from './rng.js';

/** "Start with 20 Health […] Health can never go above 20." */
export const MAX_HEALTH = 20;

/** "Flip the top 4 cards from the Dungeon face up to form a Room." */
export const ROOM_SIZE = 4;

/**
 * "You must interact with and resolve 3 of the 4 cards in any order you
 * choose. The 4th remaining card carries over into the next room."
 */
export const CARDS_PER_ROOM = 3;
const CARRYOVER = ROOM_SIZE - CARDS_PER_ROOM;

export interface Weapon {
  /** The equipped Diamond. */
  readonly card: Card;
  /**
   * "The monster card is placed on top of your weapon." Ordered oldest to
   * newest, so the last entry is the weapon's most recent kill.
   */
  readonly slain: readonly Card[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type LogKind =
  | 'info'
  | 'combat'
  | 'heal'
  | 'equip'
  | 'avoid'
  | 'discard'
  | 'win'
  | 'lose';

export interface LogEntry {
  readonly id: number;
  readonly room: number;
  readonly kind: LogKind;
  readonly text: string;
}

export interface GameState {
  readonly seed: number;
  /** The draw pile. Index 0 is the top of the deck. */
  readonly dungeon: readonly Card[];
  /** Face-up cards of the current room. */
  readonly room: readonly Card[];
  readonly discard: readonly Card[];
  readonly health: number;
  readonly weapon: Weapon | null;
  /** "You may only use one health potion per room." */
  readonly potionUsedThisRoom: boolean;
  /** "You cannot run from two rooms in a row." */
  readonly avoidedLastRoom: boolean;
  readonly roomNumber: number;
  readonly status: GameStatus;
  readonly log: readonly LogEntry[];
  readonly nextLogId: number;
}

export type Action =
  | { readonly type: 'avoid' }
  | { readonly type: 'fight'; readonly cardId: string; readonly withWeapon: boolean }
  | { readonly type: 'drink'; readonly cardId: string }
  | { readonly type: 'equip'; readonly cardId: string };

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createGame(seed: number = randomSeed()): GameState {
  const rng: Rng = mulberry32(seed);
  const dungeon = shuffle(buildDeck(), rng);

  const base: GameState = {
    seed,
    dungeon,
    room: [],
    discard: [],
    health: MAX_HEALTH,
    weapon: null,
    potionUsedThisRoom: false,
    avoidedLastRoom: false,
    roomNumber: 0,
    status: 'playing',
    log: [],
    nextLogId: 1,
  };

  return beginNewRoom(base, { avoided: false });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * "After a weapon defeats a monster, it can only fight subsequent monsters
 * that have a lower value than the last monster it killed." A weapon that has
 * not yet killed anything is unrestricted.
 */
export function weaponCanFight(weapon: Weapon | null, monster: Card): boolean {
  if (!weapon) return false;
  const last = weapon.slain.at(-1);
  return last === undefined || monster.rank < last.rank;
}

/** The value the weapon is still allowed to fight *below*, or null if fresh. */
export function weaponLimit(weapon: Weapon | null): number | null {
  return weapon?.slain.at(-1)?.rank ?? null;
}

/**
 * "Once per turn, if you choose not to face a room, you can send all 4 cards
 * to the bottom of the Dungeon deck […] You cannot run from two rooms in a
 * row."
 *
 * Requires an untouched room: once you have resolved a card you are committed
 * to the room. Also requires a non-empty dungeon — with no cards left to draw,
 * sending the room to the bottom would just deal the same room straight back.
 */
export function canAvoidRoom(state: GameState): boolean {
  return (
    state.status === 'playing' &&
    !state.avoidedLastRoom &&
    state.room.length === ROOM_SIZE &&
    state.dungeon.length > 0
  );
}

export function findRoomCard(state: GameState, cardId: string): Card | undefined {
  return state.room.find((card) => card.id === cardId);
}

/** Total value of every monster not yet resolved — the basis of a losing score. */
export function remainingMonsterValue(state: GameState): number {
  const unplayed = [...state.dungeon, ...state.room];
  return unplayed.reduce((sum, card) => (isMonster(card) ? sum + card.rank : sum), 0);
}

/**
 * "Winning: […] Your final score is your remaining health (maximum of 20)."
 * "Losing: […] Your final negative score is calculated by subtracting the
 * values of all remaining unplayed monsters left in the dungeon deck from 0."
 */
export function score(state: GameState): number {
  if (state.status === 'lost') return -remainingMonsterValue(state);
  return Math.min(state.health, MAX_HEALTH);
}

export function isLegal(state: GameState, action: Action): boolean {
  if (state.status !== 'playing') return false;
  if (action.type === 'avoid') return canAvoidRoom(state);

  const card = findRoomCard(state, action.cardId);
  if (!card) return false;

  switch (action.type) {
    case 'fight':
      if (!isMonster(card)) return false;
      return action.withWeapon ? weaponCanFight(state.weapon, card) : true;
    case 'drink':
      return isPotion(card);
    case 'equip':
      return isWeapon(card);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export class IllegalActionError extends Error {}

export function applyAction(state: GameState, action: Action): GameState {
  if (!isLegal(state, action)) {
    throw new IllegalActionError(`Illegal action: ${JSON.stringify(action)}`);
  }
  switch (action.type) {
    case 'avoid':
      return avoidRoom(state);
    case 'fight':
      return fight(state, action.cardId, action.withWeapon);
    case 'drink':
      return drink(state, action.cardId);
    case 'equip':
      return equip(state, action.cardId);
  }
}

function avoidRoom(state: GameState): GameState {
  // "send all 4 cards to the bottom of the Dungeon deck and deal a new room"
  const next: GameState = {
    ...state,
    dungeon: [...state.dungeon, ...state.room],
    room: [],
  };
  const logged = log(next, 'avoid', `Fled room ${state.roomNumber}; 4 cards sent to the bottom.`);
  return beginNewRoom(logged, { avoided: true });
}

function fight(state: GameState, cardId: string, withWeapon: boolean): GameState {
  const monster = findRoomCard(state, cardId) as Card;
  const weapon = state.weapon;

  let damage: number;
  let next: GameState;

  if (withWeapon && weapon) {
    // "Subtract the weapon's value from the monster's value; you take the
    // remaining difference as damage. The monster card is placed on top of
    // your weapon."
    damage = Math.max(0, monster.rank - weapon.card.rank);
    next = {
      ...state,
      room: withoutCard(state.room, cardId),
      weapon: { card: weapon.card, slain: [...weapon.slain, monster] },
    };
    next = log(
      next,
      'combat',
      `Fought ${cardName(monster)} with ${cardName(weapon.card)} — took ${damage} damage.`,
    );
  } else {
    // "Fighting Barehanded: Take damage equal to the full value of the monster."
    damage = monster.rank;
    next = {
      ...state,
      room: withoutCard(state.room, cardId),
      discard: [...state.discard, monster],
    };
    next = log(next, 'combat', `Fought ${cardName(monster)} barehanded — took ${damage} damage.`);
  }

  next = { ...next, health: next.health - damage };
  return afterResolve(next);
}

function drink(state: GameState, cardId: string): GameState {
  const potion = findRoomCard(state, cardId) as Card;
  const next: GameState = {
    ...state,
    room: withoutCard(state.room, cardId),
    discard: [...state.discard, potion],
  };

  if (state.potionUsedThisRoom) {
    // "If a room contains multiple hearts, any extra potions are discarded
    // without healing you."
    return afterResolve(
      log(next, 'discard', `Discarded ${cardName(potion)} — already drank a potion this room.`),
    );
  }

  // "Restores health equal to the card's value, capped at 20."
  const healed = Math.min(MAX_HEALTH, state.health + potion.rank);
  const gained = healed - state.health;
  return afterResolve(
    log(
      { ...next, health: healed, potionUsedThisRoom: true },
      'heal',
      `Drank ${cardName(potion)} — healed ${gained}.`,
    ),
  );
}

function equip(state: GameState, cardId: string): GameState {
  const card = findRoomCard(state, cardId) as Card;
  // "picking up a new Diamond automatically discards your old weapon"
  const retired = state.weapon ? [state.weapon.card, ...state.weapon.slain] : [];

  const next: GameState = {
    ...state,
    room: withoutCard(state.room, cardId),
    discard: [...state.discard, ...retired],
    weapon: { card, slain: [] },
  };

  const note = state.weapon ? ` (discarded ${cardName(state.weapon.card)})` : '';
  return afterResolve(log(next, 'equip', `Equipped ${cardName(card)}${note}.`));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function withoutCard(cards: readonly Card[], cardId: string): Card[] {
  return cards.filter((card) => card.id !== cardId);
}

/** Resolves end-of-turn bookkeeping: death, victory, and dealing the next room. */
function afterResolve(state: GameState): GameState {
  // "If your health drops to 0 or below, you are defeated."
  if (state.health <= 0) {
    const dead: GameState = { ...state, health: Math.max(0, state.health), status: 'lost' };
    return log(
      dead,
      'lose',
      `You died in room ${state.roomNumber}. Score ${-remainingMonsterValue(dead)}.`,
    );
  }

  // The room refreshes once only the carryover card is left.
  if (state.room.length <= CARRYOVER && state.dungeon.length > 0) {
    return beginNewRoom(state, { avoided: false });
  }

  // "Winning: Successfully clear and navigate through every room of the
  // dungeon until the deck is empty."
  if (state.dungeon.length === 0 && state.room.length === 0) {
    const won: GameState = { ...state, status: 'won' };
    return log(won, 'win', `Dungeon cleared with ${won.health} health. Score ${score(won)}.`);
  }

  return state;
}

function beginNewRoom(state: GameState, opts: { avoided: boolean }): GameState {
  const needed = ROOM_SIZE - state.room.length;
  const drawn = state.dungeon.slice(0, needed);
  const roomNumber = state.roomNumber + 1;

  const dealt: GameState = {
    ...state,
    dungeon: state.dungeon.slice(drawn.length),
    room: [...state.room, ...drawn],
    potionUsedThisRoom: false,
    avoidedLastRoom: opts.avoided,
    roomNumber,
  };

  return log(dealt, 'info', `Room ${roomNumber} — ${dealt.room.length} cards face up.`);
}

function log(state: GameState, kind: LogKind, text: string): GameState {
  const entry: LogEntry = { id: state.nextLogId, room: state.roomNumber, kind, text };
  return { ...state, log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}
