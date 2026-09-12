/** Card identity: `${suit}-${rank}` — matches the committed artwork filenames. */
export type Suit = 'club' | 'diamond' | 'heart' | 'spade';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'j' | 'q' | 'k' | 'a';
export type CardId = `${Suit}-${Rank}`;

export type CardKind = 'monster' | 'weapon' | 'potion';

/**
 * House-rule toggles. Defaults enforce docs/rules.md exactly.
 *
 * NOTE: `potionsPerRoom` uses `'one' | 'unlimited'` rather than the spec sketch's
 * `1 | Infinity` so the config is JSON-serializable (localStorage + share URLs).
 */
export interface GameConfig {
  runAwayMode: 'once' | 'unlimited';
  potionsPerRoom: 'one' | 'unlimited';
  weaponDegradation: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
  runAwayMode: 'once',
  potionsPerRoom: 'one',
  weaponDegradation: true,
};

export interface RunHighlights {
  monstersKilled: number;
  potionsWasted: number;
  roomsExplored: number;
}

/** Full engine truth. Flat, JSON-serializable; excludes transient UI state (selection). */
export interface GameState {
  seed: string;
  config: GameConfig;
  phase: 'playing' | 'won' | 'lost';
  hp: number;
  maxHp: number;
  /** Draw pile, index 0 = top. */
  dungeon: CardId[];
  /** Current room — unresolved cards only (resolved cards are removed). */
  room: CardId[];
  /** Cards resolved this room. */
  resolvedCount: number;
  /** Card carried into this room from the previous one (for the tint/badge), null if none. */
  carriedCardId: CardId | null;
  weapon: CardId | null;
  /** Monsters slain by the current weapon, last-killed at the end. */
  killStack: CardId[];
  potionsUsedThisRoom: number;
  /** True when the current room was entered by running away (blocks a second flee). */
  ranAwayLastRoom: boolean;
  turnCount: number;
  runHighlights: RunHighlights;
  startedAt: number;
  /** Single current-room snapshot for "Undo to Room Start". */
  roomSnapshot: GameState | null;
}

export type GameAction =
  | { type: 'StartNewRun'; seed: string; config: GameConfig; startedAt?: number }
  | { type: 'DealRoom' }
  | { type: 'FightMonster'; cardId: CardId; barehanded?: boolean }
  | { type: 'DrinkPotion'; cardId: CardId }
  | { type: 'EquipWeapon'; cardId: CardId }
  | { type: 'RunAway' }
  | { type: 'UndoToRoomStart' }
  | { type: 'EnterNextRoom' };

export type RunAwayBlockReason = 'twice-in-a-row' | 'final-room' | 'already-engaged';

export type InvalidActionReason =
  | 'game-over'
  | 'not-in-room'
  | 'not-a-monster'
  | 'not-a-weapon'
  | 'not-a-potion'
  | 'room-complete'
  | 'weapon-too-weak'
  | 'no-snapshot'
  | 'not-dealt'
  | 'room-active'
  | 'room-not-resolved'
  | 'final-room';

export type GameResult =
  | { type: 'RunStarted'; seed: string; config: GameConfig }
  | { type: 'RoomDealt'; cards: CardId[]; carriedFrom: CardId | null }
  | {
      type: 'MonsterDefeated';
      cardId: CardId;
      damage: number;
      usedWeaponId: CardId | null;
      weaponBroke: boolean;
    }
  | {
      type: 'WeaponEquipped';
      cardId: CardId;
      discardedWeaponId: CardId | null;
      discardedMonsterIds: CardId[];
    }
  | { type: 'PotionQuaffed'; cardId: CardId; healed: number; wasted: boolean }
  | { type: 'RanAway'; newCards: CardId[] }
  | { type: 'RunAwayBlocked'; reason: RunAwayBlockReason }
  | { type: 'UndoDone' }
  | { type: 'InvalidAction'; reason: InvalidActionReason }
  | { type: 'GameWon'; score: number; seed: string; config: GameConfig }
  | { type: 'GameLost'; score: number; seed: string; config: GameConfig };

/** The engine contract: pure `(state, action) → { state, result }`. */
export interface ReducerOutput {
  state: GameState;
  result: GameResult;
}
