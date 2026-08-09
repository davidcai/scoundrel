export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export type CardRole = 'monster' | 'weapon' | 'potion';

export interface Weapon {
  card: Card;
  lastKilledValue: number | null;
  stack: Card[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type LogKind = 'fight' | 'weapon' | 'potion' | 'run' | 'room' | 'win' | 'lose' | 'info';

export interface LogEntry {
  id: number;
  text: string;
  kind: LogKind;
}

export interface GameState {
  deck: Card[];
  room: Card[];
  health: number;
  weapon: Weapon | null;
  resolvedThisRoom: number;
  potionsUsedThisRoom: number;
  enteredByRun: boolean;
  isFinalRoom: boolean;
  roomSize: number;
  status: GameStatus;
  score: number | null;
  roomId: number;
  log: LogEntry[];
}

export type Action =
  | { type: 'fight'; cardId: string; useWeapon: boolean }
  | { type: 'equip'; cardId: string }
  | { type: 'drink'; cardId: string }
  | { type: 'run' }
  | { type: 'newGame'; seed?: number };