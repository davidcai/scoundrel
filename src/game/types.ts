export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type CardId = string;

export interface Card {
  id: CardId;
  suit: Suit;
  rank: Rank;
}

export type CardType = 'monster' | 'weapon' | 'potion';

export type GamePhase = 'start' | 'playing' | 'won' | 'lost';

export type CardStatus = 'unresolved' | 'resolved' | 'carried-over';

export interface RoomCard {
  card: Card;
  status: CardStatus;
}

export interface WeaponState {
  card: Card;
  lastKilledValue: Rank | null;
  defeatedMonsters: Card[];
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  room: RoomCard[];
  health: number;
  weapon: WeaponState | null;
  canRunAway: boolean;
  potionUsedThisRoom: boolean;
  carriedOverCardId: CardId | null;
  cardsResolvedThisRoom: number;
  score: number;
  log: string[];
}

export interface CombatResult {
  damage: number;
  monsterDefeated: boolean;
  usedWeapon: boolean;
}
