/**
 * Data types for the Scoundrel rules engine.
 *
 * Everything here is plain serializable data: no classes, no functions, and no
 * references to the DOM, browser storage, or presentation frameworks. The
 * reducer produces new states from old states instead of mutating them.
 */

import type { CardId, CardKind } from './cards';
import type { RuleConfig } from './config';

/** How a player fights a monster (rules.md, "Combat & Item Rules"). */
export const ATTACK_MODES = ['barehanded', 'weapon'] as const;
export type AttackMode = (typeof ATTACK_MODES)[number];

/** A run either continues or has finished in exactly one way. */
export type RunOutcome = 'won' | 'lost';
export type RunStatus = 'playing' | RunOutcome;

/** A face-up card in the current room. `carried` marks the card dealt from the previous room. */
export interface RoomCard {
  readonly card: CardId;
  readonly carried: boolean;
}

export interface Room {
  readonly cards: readonly RoomCard[];
}

/** The equipped diamond and the monsters it has defeated, most recent last (on top). */
export interface Weapon {
  readonly card: CardId;
  readonly value: number;
  readonly kills: readonly CardId[];
  /** Value of the last monster this weapon killed; later eligible monsters must be lower. */
  readonly limit: number | null;
}

/** Run highlights reported on the result screen (REQ-009) and restored by undo (REQ-008). */
export interface RunHighlights {
  readonly monstersDefeated: number;
  readonly potionsWasted: number;
  readonly roomsExplored: number;
  readonly roomsCleared: number;
}

/** The final, immutable outcome of a completed run. */
export interface RunResult {
  readonly outcome: RunOutcome;
  readonly health: number;
  readonly score: number;
  readonly seed: string;
  readonly config: RuleConfig;
  readonly highlights: RunHighlights;
}

/**
 * Fields captured when a room is dealt. "Undo to Room Start" (REQ-008) restores
 * exactly this snapshot: health, equipment and its kill stack, room cards and
 * their order, draw-pile order, potion allowance, escape eligibility, and
 * run-highlight counters.
 */
export interface RoomSnapshot {
  readonly health: number;
  readonly dungeon: readonly CardId[];
  readonly room: Room;
  readonly weapon: Weapon | null;
  readonly potionUsedThisRoom: boolean;
  readonly resolvedThisRoom: number;
  readonly escapedLastRoom: boolean;
  readonly finalRoom: boolean;
  readonly roomCleared: boolean;
  readonly highlights: RunHighlights;
}

export interface GameState {
  /** Trimmed, NFC-normalized seed string (1–64 characters). */
  readonly seed: string;
  readonly config: RuleConfig;
  readonly health: number;
  /** Face-down draw pile; index 0 is dealt next. */
  readonly dungeon: readonly CardId[];
  readonly room: Room;
  readonly weapon: Weapon | null;
  /** The default rule allows one potion per room; unlimited potions ignores this. */
  readonly potionUsedThisRoom: boolean;
  readonly resolvedThisRoom: number;
  /** True when the previous room was escaped; default rules block escaping again. */
  readonly escapedLastRoom: boolean;
  /** True when the draw pile was empty after this room was dealt. */
  readonly finalRoom: boolean;
  readonly roomCleared: boolean;
  readonly highlights: RunHighlights;
  readonly status: RunStatus;
  /** Immutable completed-run result; `null` while the run is still active. */
  readonly result: RunResult | null;
  /** Room-start snapshot for undo; replaced when a new room is dealt. */
  readonly undo: RoomSnapshot | null;
}

/** Actions accepted by the rules reducer. */
export type GameAction =
  | { readonly type: 'resolveCard'; readonly card: CardId; readonly attack?: AttackMode }
  | { readonly type: 'enterNextRoom' }
  | { readonly type: 'runAway' }
  | { readonly type: 'undoRoom' };

/**
 * Reasons an action is currently unavailable. The interface translates these
 * codes (REQ-004: unavailable actions explain their restrictions); the engine
 * deliberately returns no display strings.
 */
export type RejectionReason =
  | 'run-over'
  | 'card-not-in-room'
  | 'card-not-resolvable'
  | 'not-a-monster'
  | 'attack-mode-required'
  | 'no-weapon'
  | 'weapon-ineligible'
  | 'escape-final-room'
  | 'escape-after-resolution'
  | 'escape-consecutive-blocked'
  | 'room-not-cleared'
  | 'undo-unavailable';

export interface CardResolvedEvent {
  readonly type: 'cardResolved';
  readonly card: CardId;
  readonly cardKind: CardKind;
  /** The chosen attack for a monster; `null` for weapons and potions. */
  readonly attack: AttackMode | null;
  readonly monsterValue: number | null;
  /** Damage dealt to the player by this resolution. */
  readonly damage: number;
  readonly healthBefore: number;
  readonly healthAfter: number;
  /** Health actually restored by a potion (0 when the potion was wasted). */
  readonly healing: number;
  readonly potionWasted: boolean;
  readonly monsterDefeated: boolean;
  readonly addedToWeaponStack: boolean;
  readonly weaponEquipped: boolean;
  /** Previously equipped weapon discarded by picking up a new one. */
  readonly weaponReplaced: CardId | null;
  /** Monsters that were on the discarded weapon; they leave play with it (REQ-006). */
  readonly weaponReplacedKills: readonly CardId[];
  /** Equipped weapon after the resolution, including its updated kill stack. */
  readonly weapon: Weapon | null;
  /** True when this resolution cleared the current room's required cards. */
  readonly roomCleared: boolean;
  readonly runOutcome: RunOutcome | null;
  readonly score: number | null;
}

export interface RunAwayEvent {
  readonly type: 'runAway';
  /** The escaped room's cards, returned to the bottom of the dungeon in this order. */
  readonly returnedCards: readonly CardId[];
  readonly dealtCards: readonly CardId[];
  readonly finalRoom: boolean;
}

export interface EnterNextRoomEvent {
  readonly type: 'enterNextRoom';
  readonly carriedCard: CardId;
  readonly dealtCards: readonly CardId[];
  readonly finalRoom: boolean;
}

export interface UndoRoomEvent {
  readonly type: 'undoRoom';
}

export type GameEvent = CardResolvedEvent | RunAwayEvent | EnterNextRoomEvent | UndoRoomEvent;

/** Preview of a monster resolution: both choices and the weapon's current restriction. */
export interface MonsterPreview {
  readonly card: CardId;
  readonly monsterValue: number;
  readonly barehanded: {
    readonly damage: number;
    readonly healthAfter: number;
  };
  /** `null` when no weapon is equipped, so no weapon choice exists (REQ-005). */
  readonly weapon: {
    readonly eligible: boolean;
    /** Value of the last monster killed by the weapon; `null` means unrestricted. */
    readonly limit: number | null;
    /** Damage the player would take using the weapon if it is eligible. */
    readonly damage: number;
    readonly healthAfter: number;
  } | null;
}

export type MonsterPreviewResult =
  | { readonly ok: true; readonly preview: MonsterPreview }
  | { readonly ok: false; readonly reason: RejectionReason };

export type ActionPreview =
  | { readonly ok: true; readonly event: GameEvent }
  | { readonly ok: false; readonly reason: RejectionReason };

export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly event: GameEvent }
  | { readonly ok: false; readonly state: GameState; readonly reason: RejectionReason };
