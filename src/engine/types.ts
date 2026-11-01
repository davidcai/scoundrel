export type NumberRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
export type BlackRank = NumberRank | 'j' | 'q' | 'k' | 'a';
export type CardId = `${'club' | 'spade'}-${BlackRank}` | `${'diamond' | 'heart'}-${NumberRank}`;
export type CardKind = 'monster' | 'weapon' | 'potion';
export interface Card {
  readonly id: CardId;
  readonly kind: CardKind;
  readonly value: number;
}
export interface GameConfig {
  readonly allowConsecutiveEscapes: boolean;
  readonly unlimitedPotions: boolean;
  readonly weaponDegradation: boolean;
}
export interface Highlights {
  readonly roomsExplored: number;
  readonly roomsCleared: number;
  readonly monstersDefeated: number;
  readonly potionsWasted: number;
}
export interface RoomState {
  readonly health: number;
  readonly dungeon: readonly CardId[];
  readonly room: readonly CardId[];
  readonly carriedCard: CardId | null;
  readonly weapon: CardId | null;
  readonly kills: readonly CardId[];
  readonly discard: readonly CardId[];
  readonly potionsUsed: number;
  readonly resolved: number;
  readonly previousRoomEscaped: boolean;
  readonly highlights: Highlights;
}
interface Run {
  readonly seed: string;
  readonly config: GameConfig;
  readonly board: RoomState;
}
export interface PlayingState extends Run {
  readonly status: 'playing';
  readonly roomStart: RoomState;
}
export type GameState =
  | PlayingState
  | (Run & { readonly status: 'won'; readonly score: number; readonly reason: 'cleared' })
  | (Run & {
      readonly status: 'lost';
      readonly score: number;
      readonly reason: 'death' | 'abandoned';
    });
export type Action =
  | { readonly type: 'fight'; readonly cardId: CardId; readonly mode: 'weapon' | 'barehanded' }
  | { readonly type: 'equip' | 'drink'; readonly cardId: CardId }
  | { readonly type: 'escape' }
  | { readonly type: 'next-room' }
  | { readonly type: 'undo' }
  | { readonly type: 'abandon' };
export type InvalidReason =
  | 'run-ended'
  | 'card-not-in-room'
  | 'wrong-card-type'
  | 'weapon-required'
  | 'weapon-degraded'
  | 'room-complete'
  | 'room-incomplete'
  | 'escape-after-resolution'
  | 'consecutive-escape'
  | 'final-room'
  | 'nothing-to-undo';
export type ActionResult =
  | { readonly type: 'invalid'; readonly reason: InvalidReason }
  | {
      readonly type: 'fought';
      readonly cardId: CardId;
      readonly mode: 'weapon' | 'barehanded';
      readonly damage: number;
      readonly healthAfter: number;
    }
  | { readonly type: 'equipped'; readonly cardId: CardId; readonly discarded: readonly CardId[] }
  | {
      readonly type: 'drank';
      readonly cardId: CardId;
      readonly healed: number;
      readonly wasted: boolean;
      readonly healthAfter: number;
    }
  | { readonly type: 'escaped' | 'entered-room' | 'undone' | 'abandoned' };
export interface Transition {
  readonly state: GameState;
  readonly result: ActionResult;
}
