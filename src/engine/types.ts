// Core engine types. Pure TypeScript — no React, no DOM, no Node imports.

export type Suit = 'club' | 'diamond' | 'heart' | 'spade';

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
  | 'j' | 'q' | 'k' | 'a';

/** Stable string id, also the asset filename base (e.g. "club-10", "spade-a"). */
export type CardId = string;

export type CardType = 'monster' | 'weapon' | 'potion';

export type Phase = 'playing' | 'won' | 'lost';

/**
 * House-rule configuration. Defaults enforce docs/rules.md exactly.
 * `potionsPerRoom` is `1` or `Infinity` (unlimited); Infinity is serialized
 * specially by the persistence/URL codecs (see src/store/configCodec.ts).
 */
export interface GameConfig {
  runAwayMode: 'once' | 'unlimited';
  potionsPerRoom: 1 | number;
  weaponDegradation: boolean;
}

export interface RunHighlights {
  monstersKilled: number;
  potionsWasted: number;
  roomsExplored: number;
}

/**
 * The whole game truth, JSON-serializable. Transient selection lives in the
 * Zustand store, NOT here (design-plan Q45b).
 */
export interface GameState {
  seed: string;
  config: GameConfig;
  phase: Phase;
  hp: number;
  maxHp: number;
  /** Remaining draw pile, top of deck = index 0. */
  dungeon: CardId[];
  /** Current room (4 or fewer cards). */
  room: CardId[];
  /** Number of cards resolved in the current room. */
  resolvedCount: number;
  weapon: CardId | null;
  /** Defeated monsters stacked on the weapon; last-killed at the end. */
  killStack: CardId[];
  potionsUsedThisRoom: number;
  ranAwayLastRoom: boolean;
  turnCount: number;
  runHighlights: RunHighlights;
  startedAt: number;
  /** Single current-room snapshot for per-room undo. */
  roomSnapshot: GameState | null;
}

export type Action =
  | { type: 'StartNewRun'; seed: string; config?: GameConfig }
  | { type: 'DealRoom' }
  | { type: 'FightMonster'; cardId: CardId; barehanded?: boolean }
  | { type: 'DrinkPotion'; cardId: CardId }
  | { type: 'EquipWeapon'; cardId: CardId }
  | { type: 'RunAway' }
  | { type: 'UndoToRoomStart' }
  | { type: 'EnterNextRoom' };

export interface RoomDealt { type: 'RoomDealt'; cards: CardId[]; carriedFrom?: CardId[]; }
export interface MonsterDefeated {
  type: 'MonsterDefeated';
  cardId: CardId;
  damage: number;
  /** Always false under canonical rules; reserved for future variants. */
  weaponBroke: boolean;
  usedWeaponId?: CardId;
}
export interface WeaponEquipped {
  type: 'WeaponEquipped';
  cardId: CardId;
  discardedWeaponId?: CardId;
  discardedMonsterIds: CardId[];
}
export interface PotionQuaffed { type: 'PotionQuaffed'; cardId: CardId; healed: number; wasted: boolean; }
export interface RanAway { type: 'RanAway'; newCards: CardId[]; }
export interface RunAwayBlocked { type: 'RunAwayBlocked'; reason: 'twice-in-row' | 'no-cards'; }
export interface UndoDone { type: 'UndoDone'; }
export interface GameWon { type: 'GameWon'; score: number; seed: string; config: GameConfig; }
export interface GameLost { type: 'GameLost'; score: number; seed: string; config: GameConfig; }
export interface InvalidAction { type: 'InvalidAction'; reason: string; }

export type Result =
  | RoomDealt
  | MonsterDefeated
  | WeaponEquipped
  | PotionQuaffed
  | RanAway
  | RunAwayBlocked
  | UndoDone
  | GameWon
  | GameLost
  | InvalidAction;

export interface ReducerOutput { state: GameState; result: Result; }
