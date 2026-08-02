export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export type CardKind = 'monster' | 'weapon' | 'potion';

export interface EquippedWeapon {
  card: Card;
  slain: Card[];
  lastKilledValue: number | null;
}

export type Phase = 'playing' | 'won' | 'lost';

export interface GameState {
  phase: Phase;
  health: number;
  maxHealth: number;
  dungeon: Card[];
  room: Card[];
  carryover: Card | null;
  weapon: EquippedWeapon | null;
  discard: Card[];
  resolvedCount: number;
  requiredResolves: number;
  dealtSize: number;
  potionUsedThisRoom: boolean;
  ranLastRoom: boolean;
  roomComplete: boolean;
  score: number | null;
  log: string[];
  seed: number;
}

export type Action =
  | { type: 'NEW_GAME'; seed?: number }
  | { type: 'RUN' }
  | { type: 'DEAL_NEXT_ROOM' }
  | { type: 'FIGHT_BAREHANDED'; cardId: string }
  | { type: 'FIGHT_WITH_WEAPON'; cardId: string }
  | { type: 'EQUIP_WEAPON'; cardId: string }
  | { type: 'DRINK_POTION'; cardId: string };