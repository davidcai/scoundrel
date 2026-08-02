export type Suit = 'spades' | 'clubs' | 'diamonds' | 'hearts';

/** 2..10, 11 = Jack, 12 = Queen, 13 = King, 14 = Ace */
export type Rank = number;

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Face value used for damage / weapon strength / healing. */
  value: number;
  /** Unique id, e.g. "ace_of_spades" — matches the SVG filename. */
  id: string;
}

export interface EquippedWeapon {
  card: Card;
  /** Monsters this weapon has defeated, oldest first; last element is on top. */
  kills: Card[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  /** Draw pile ("the Dungeon"). Index 0 is the top of the deck. */
  deck: Card[];
  /** Cards currently in the room. */
  room: Card[];
  health: number;
  weapon: EquippedWeapon | null;
  discard: Card[];
  /** True once a health potion has been used in the current room. */
  potionUsed: boolean;
  /** True if the previous room was run away from (no two runs in a row). */
  ranLastRoom: boolean;
  status: GameStatus;
  /** Remaining health on a win; 0 - remaining deck monsters on a loss; null while playing. */
  score: number | null;
  /** Human-readable action feed, newest last. */
  log: string[];
  /** Seed used to shuffle, so a game can be replayed. */
  seed: number;
}

export type GameAction =
  | { type: 'fight'; cardId: string; useWeapon: boolean }
  | { type: 'drink'; cardId: string }
  | { type: 'equip'; cardId: string }
  | { type: 'run' }
  | { type: 'restart'; seed?: number };

export const MAX_HEALTH = 20;
