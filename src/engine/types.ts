// =============================================================================
// Scoundrel — Engine Type Contract
// -----------------------------------------------------------------------------
// This file is the shared contract between the pure game engine (src/engine/)
// and the UI (src/components/, src/App.tsx). The engine implements the action
// functions declared at the bottom; the UI consumes GameState + those actions.
// Source of truth for gameplay: docs/rules.md
// =============================================================================

/** A card suit. Clubs & Spades are monsters, Diamonds are weapons, Hearts are potions. */
export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';

/**
 * Numeric rank / face value. Number cards equal their face value.
 * Jack = 11, Queen = 12, King = 13, Ace = 14.
 */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** A single playing card. */
export interface Card {
  /** Stable unique id, e.g. "C7" (clubs 7), "H14" (hearts ace), "D11" (diamond jack). */
  id: string;
  suit: Suit;
  /** Numeric face value (J=11, Q=12, K=13, A=14). */
  rank: Rank;
  /** Game value — always equal to rank. Convenience field. */
  value: number;
}

/** The gameplay role of a card, derived from its suit. */
export type CardKind = 'monster' | 'weapon' | 'potion';

/** The weapon currently equipped, including the stack of monsters it has defeated. */
export interface EquippedWeapon {
  /** The diamond card that is equipped. */
  card: Card;
  /** Monsters defeated by this weapon, in the order they were killed (oldest first). */
  killed: Card[];
  /**
   * Value of the most recently killed monster, or null if the weapon has not
   * killed anything yet. The weapon may only fight monsters with a strictly
   * lower value than this (weapon degradation rule).
   */
  lastKilledValue: number | null;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type LogKind = 'info' | 'damage' | 'heal' | 'combat' | 'system';

/** A single entry in the event log, used for UI feedback. */
export interface LogEntry {
  id: number;
  text: string;
  kind: LogKind;
}

/**
 * The complete, serializable game state. All engine action functions are pure:
 * they take a GameState and return a NEW GameState (they never mutate in place).
 */
export interface GameState {
  /** Current player health (0..maxHealth). At or below 0 means the game is lost. */
  health: number;
  /** Maximum health (20). Health can never exceed this. */
  maxHealth: number;

  /**
   * The draw pile ("Dungeon"). deck[0] is the TOP (the next card to be drawn).
   * Dealing a room draws from the front; running away sends cards to the back.
   */
  deck: Card[];
  /** Number of cards remaining in the deck (== deck.length). Convenience. */
  deckCount: number;

  /**
   * The current room: the unresolved cards still face up. Resolved cards are
   * removed from this array. When dealt, a room has `roomSize` cards.
   */
  room: Card[];
  /** Size of the room when it was dealt (4 normally; fewer for the final room). */
  roomSize: number;
  /** True when the deck is empty and this is the last room (resolve ALL cards). */
  isFinalRoom: boolean;

  /** The card carried over into this room from the previous room (if any). */
  carriedOver: Card | null;

  /** The currently equipped weapon, or null if fighting barehanded. */
  equippedWeapon: EquippedWeapon | null;

  /** Number of health potions used in the current room (0 or 1; max one per room). */
  potionsUsedThisRoom: number;

  /** Number of cards resolved in the current room so far. */
  resolvedThisRoom: number;

  /** True if the player ran away from the previous room (prevents running twice in a row). */
  ranLastRoom: boolean;

  /** Current game status. */
  status: GameStatus;

  /** Final score, set only when status is 'won' or 'lost'. Null while playing. */
  score: number | null;

  /** Recent event log entries (most recent last). Bounded by the engine. */
  log: LogEntry[];

  /** Internal counter for generating unique log ids. */
  _logId: number;
}

// -----------------------------------------------------------------------------
// Engine action API (implemented in src/engine/game.ts as `export const api`).
// All actions are pure: they return a NEW GameState and never mutate in place.
// Invalid actions (e.g. fighting a card not in the room) throw an Error.
// -----------------------------------------------------------------------------
export interface EngineApi {
  /** Create a fresh, shuffled game in its initial state. Optional seed for deterministic tests. */
  createGame(seed?: number): GameState;

  /** Derive the gameplay kind of a card from its suit. */
  getKind(card: Card): CardKind;

  /** True if the player is allowed to run away from the current room right now. */
  canRun(state: GameState): boolean;

  /** True if the monster with `cardId` can be fought with the equipped weapon (degradation rule). */
  canFightWithWeapon(state: GameState, cardId: string): boolean;

  /** Equip the diamond weapon with `cardId` from the room. Discards any previous weapon. */
  equipWeapon(state: GameState, cardId: string): GameState;

  /** Drink the heart potion with `cardId` from the room. Only one potion per room; extras heal nothing. */
  drinkPotion(state: GameState, cardId: string): GameState;

  /** Fight the monster with `cardId` from the room, barehanded or with the equipped weapon. */
  fightMonster(state: GameState, cardId: string, mode: 'barehanded' | 'weapon'): GameState;

  /** Run away: send all current room cards to the bottom of the deck and deal a new room. */
  runAway(state: GameState): GameState;
}