import { buildDeck, mulberry32, rankLabel, shuffle } from './deck';
import type { Card, CardKind, EngineApi, GameState, LogKind, Suit } from './types';

// -----------------------------------------------------------------------------
// Card classification helpers
// -----------------------------------------------------------------------------

/** Derive the gameplay kind of a card from its suit. */
export function getKind(card: Card): CardKind {
  switch (card.suit) {
    case 'clubs':
    case 'spades':
      return 'monster';
    case 'diamonds':
      return 'weapon';
    case 'hearts':
      return 'potion';
  }
}

/** Human-readable suit name for logs. */
function suitName(suit: Suit): string {
  switch (suit) {
    case 'clubs':
      return 'Clubs';
    case 'spades':
      return 'Spades';
    case 'diamonds':
      return 'Diamonds';
    case 'hearts':
      return 'Hearts';
  }
}

// -----------------------------------------------------------------------------
// Logging
// -----------------------------------------------------------------------------

/** Append a log entry to the (bounded) event log. Mutates state. */
function pushLog(state: GameState, kind: LogKind, text: string): void {
  state._logId += 1;
  state.log.push({ id: state._logId, text, kind });
  if (state.log.length > 40) state.log.shift();
}

// -----------------------------------------------------------------------------
// Room dealing / room resolution bookkeeping
// -----------------------------------------------------------------------------

/**
 * Deal a new room from the top of the deck. Mutates the passed state clone.
 * `_ranAway` is reserved for signature parity: `ranLastRoom` is intentionally
 * NOT touched here — the caller sets it based on the action that caused the deal.
 */
function dealRoom(state: GameState, _ranAway = false): void {
  const room: Card[] = [];
  // The card carried over from the previous room leads the new room.
  if (state.carriedOver !== null) {
    room.push(state.carriedOver);
    state.carriedOver = null;
  }
  const draw = state.deck.splice(0, Math.min(4 - room.length, state.deck.length));
  room.push(...draw);

  state.room = room;
  state.roomSize = room.length;
  state.isFinalRoom = room.length < 4;
  state.resolvedThisRoom = 0;
  state.potionsUsedThisRoom = 0;
  state.deckCount = state.deck.length;

  if (state.isFinalRoom) {
    pushLog(state, 'system', 'Final room — clear the remaining cards to win.');
  }
}

/**
 * Post-resolution bookkeeping. Called after every successful resolve while the
 * game is still playing: decides win / carry-over / next-room.
 */
function afterResolve(state: GameState): void {
  if (state.status !== 'playing') return;

  if (state.isFinalRoom) {
    if (state.resolvedThisRoom === state.roomSize) {
      state.status = 'won';
      state.score = state.health;
      pushLog(state, 'system', `Dungeon cleared! Final score: ${state.health}.`);
    }
    return;
  }

  // Normal room (roomSize === 4): resolving 3 of 4 carries the leftover over.
  if (state.resolvedThisRoom === 3) {
    state.carriedOver = state.room[0];
    state.ranLastRoom = false; // the player faced this room
    pushLog(
      state,
      'info',
      `Room cleared. ${rankLabel(state.carriedOver.rank)} of ${suitName(state.carriedOver.suit)} carries over.`,
    );
    dealRoom(state);
  }
}

/**
 * Loss score: 0 minus the sum of the values of all unresolved monsters
 * (monsters still in the deck plus monsters in the current room).
 */
function computeLossScore(state: GameState): void {
  let total = 0;
  for (const card of [...state.deck, ...state.room]) {
    if (getKind(card) === 'monster') total += card.value;
  }
  state.score = -total;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

/** Create a fresh, shuffled game in its initial state. Optional seed for deterministic tests. */
export function createGame(seed?: number): GameState {
  const rng = seed !== undefined ? mulberry32(seed) : () => Math.random();
  const deck = shuffle(buildDeck(), rng);

  const state: GameState = {
    health: 20,
    maxHealth: 20,
    deck,
    deckCount: deck.length,
    room: [],
    roomSize: 0,
    isFinalRoom: false,
    carriedOver: null,
    equippedWeapon: null,
    potionsUsedThisRoom: 0,
    resolvedThisRoom: 0,
    ranLastRoom: false,
    status: 'playing',
    score: null,
    log: [],
    _logId: 0,
  };

  dealRoom(state);
  pushLog(state, 'system', 'You enter the dungeon. 20 health, 44 cards await.');
  return state;
}

/** True if the player is allowed to run away from the current room right now. */
export function canRun(state: GameState): boolean {
  return (
    state.status === 'playing' &&
    state.resolvedThisRoom === 0 &&
    !state.ranLastRoom &&
    state.deckCount >= 4 &&
    !state.isFinalRoom
  );
}

/** True if the monster with `cardId` can be fought with the equipped weapon (degradation rule). */
export function canFightWithWeapon(state: GameState, cardId: string): boolean {
  if (!state.equippedWeapon) return false;
  const card = state.room.find((c) => c.id === cardId);
  if (!card || getKind(card) !== 'monster') return false;
  if (state.equippedWeapon.lastKilledValue === null) return true;
  return card.value < state.equippedWeapon.lastKilledValue;
}

/** Equip the diamond weapon with `cardId` from the room. Discards any previous weapon. */
export function equipWeapon(state: GameState, cardId: string): GameState {
  const next = structuredClone(state);
  const card = next.room.find((c) => c.id === cardId);
  if (!card || getKind(card) !== 'weapon') {
    throw new Error('Not a weapon in the room: ' + cardId);
  }

  next.room = next.room.filter((c) => c.id !== cardId);
  next.equippedWeapon = { card, killed: [], lastKilledValue: null };
  next.resolvedThisRoom += 1;

  pushLog(next, 'info', `Equipped ${rankLabel(card.rank)} of Diamonds.`);
  afterResolve(next);
  return next;
}

/** Drink the heart potion with `cardId` from the room. Only one potion per room; extras heal nothing. */
export function drinkPotion(state: GameState, cardId: string): GameState {
  const next = structuredClone(state);
  const card = next.room.find((c) => c.id === cardId);
  if (!card || getKind(card) !== 'potion') {
    throw new Error('Not a potion in the room: ' + cardId);
  }

  next.room = next.room.filter((c) => c.id !== cardId);
  if (next.potionsUsedThisRoom === 0) {
    const heal = card.value;
    next.health = Math.min(next.maxHealth, next.health + heal);
    next.potionsUsedThisRoom = 1;
    pushLog(
      next,
      'heal',
      `Drank ${rankLabel(card.rank)} of Hearts. +${heal} health (now ${next.health}).`,
    );
  } else {
    pushLog(
      next,
      'info',
      `Extra potion (${rankLabel(card.rank)} of Hearts) discarded — already used one this room.`,
    );
  }

  next.resolvedThisRoom += 1;
  afterResolve(next);
  return next;
}

/** Fight the monster with `cardId` from the room, barehanded or with the equipped weapon. */
export function fightMonster(
  state: GameState,
  cardId: string,
  mode: 'barehanded' | 'weapon',
): GameState {
  const next = structuredClone(state);
  const card = next.room.find((c) => c.id === cardId);
  if (!card || getKind(card) !== 'monster') {
    throw new Error('Not a monster in the room: ' + cardId);
  }

  if (mode === 'weapon') {
    if (!next.equippedWeapon) {
      throw new Error('No weapon equipped');
    }
    if (!canFightWithWeapon(next, cardId)) {
      throw new Error('Weapon cannot fight this monster (degradation rule).');
    }
    const weapon = next.equippedWeapon;
    const monsterValue = card.value;
    const weaponValue = weapon.card.value;
    const damage = Math.max(0, monsterValue - weaponValue);

    next.health -= damage;
    weapon.killed.push(card);
    weapon.lastKilledValue = monsterValue;

    pushLog(
      next,
      'combat',
      `Slew ${rankLabel(card.rank)} of ${suitName(card.suit)} with ${rankLabel(weapon.card.rank)} of Diamonds. Took ${damage} damage (health ${next.health}).`,
    );
  } else {
    const damage = card.value;
    next.health -= damage;
    pushLog(
      next,
      'combat',
      `Fought ${rankLabel(card.rank)} of ${suitName(card.suit)} barehanded. Took ${damage} damage (health ${next.health}).`,
    );
  }

  next.room = next.room.filter((c) => c.id !== cardId);
  next.resolvedThisRoom += 1;

  if (next.health <= 0) {
    next.status = 'lost';
    computeLossScore(next);
    pushLog(next, 'system', `You have fallen. Final score: ${next.score}.`);
    return next;
  }

  afterResolve(next);
  return next;
}

/** Run away: send all current room cards to the bottom of the deck and deal a new room. */
export function runAway(state: GameState): GameState {
  if (!canRun(state)) {
    throw new Error('Cannot run away right now');
  }

  const next = structuredClone(state);
  next.deck = [...next.deck, ...next.room];
  next.room = [];
  next.ranLastRoom = true;
  next.carriedOver = null;

  pushLog(next, 'system', "Ran away! The room's cards sink to the bottom of the dungeon.");
  dealRoom(next);
  return next;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** The full engine API, as declared in types.ts. */
export const api: EngineApi = {
  createGame,
  getKind,
  canRun,
  canFightWithWeapon,
  equipWeapon,
  drinkPotion,
  fightMonster,
  runAway,
};
