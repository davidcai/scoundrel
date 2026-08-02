export type Suit = 'clubs' | 'spades' | 'diamonds' | 'hearts';

export interface Card {
  id: string;
  suit: Suit;
  value: number;
}

export type CardKind = 'monster' | 'weapon' | 'potion';

export interface Weapon {
  card: Card;
  defeated: Card[];
}

export type LogTone = 'info' | 'damage' | 'heal' | 'good' | 'bad';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
}

export type Phase = 'playing' | 'won' | 'lost';

export interface GameState {
  phase: Phase;
  dungeon: Card[];
  room: Card[];
  health: number;
  weapon: Weapon | null;
  potionUsed: boolean;
  resolved: number;
  carried: boolean;
  ranLastRoom: boolean;
  log: LogEntry[];
  score: number | null;
}
