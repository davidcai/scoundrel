import {
  canResolveMore,
  cardValue,
  isFinalRoom,
  previewFight,
  type CardId,
  type FightPreview,
  type GameState,
} from '../../engine';

/**
 * Pure view-models for the selected-card action panel.
 *
 * These helpers extract every decision the UI makes about WHICH actions to
 * offer and HOW they are labeled, so the React components (and later the Phaser
 * scene) only translate the returned data into widgets. No i18n, no store, no
 * rendering — just `(GameState, CardId) → plain data`.
 */

/** Fight options offered for a selected monster. */
export interface MonsterActionsViewModel {
  /** True when a weapon is equipped and fighting with it is legal. */
  withWeaponLegal: boolean;
  /** Damage taken when fighting with the weapon; null when that option is unavailable. */
  withWeaponDamage: number | null;
  /** Barehanded option — legal against any monster while the room is still open. */
  barehanded: FightPreview;
}

/** What the panel offers when a monster is selected. */
export function monsterActions(game: GameState, cardId: CardId): MonsterActionsViewModel {
  const withWeapon = game.weapon !== null ? previewFight(game, cardId, false) : null;
  return {
    withWeaponLegal: withWeapon !== null && withWeapon.legal,
    withWeaponDamage: withWeapon !== null && withWeapon.legal ? withWeapon.damage : null,
    barehanded: previewFight(game, cardId, true),
  };
}

/**
 * Structured data for the "weapon cannot" note shown when a weapon is equipped
 * but too weak for the selected monster. The component formats it with i18n;
 * `_cardId` is accepted for symmetry with the other panel helpers.
 */
export interface WeaponCannotNoteViewModel {
  /** Last monster slain by the current weapon, if any (drives the degradation wording). */
  lastKill: CardId | undefined;
  /** Currently equipped weapon; null when fighting barehanded. */
  weapon: CardId | null;
}

export function weaponCannotNote(game: GameState, _cardId: CardId): WeaponCannotNoteViewModel {
  return {
    lastKill: game.killStack[game.killStack.length - 1],
    weapon: game.weapon,
  };
}

/** Drink option offered for a selected potion. */
export interface PotionActionsViewModel {
  /** True when the one-potion-per-room house rule already spent this room's potion. */
  wasted: boolean;
  /** HP the potion would restore, clamped to missing HP (0 when wasted). */
  heal: number;
}

export function potionActions(game: GameState, cardId: CardId): PotionActionsViewModel {
  const wasted = game.config.potionsPerRoom === 'one' && game.potionsUsedThisRoom >= 1;
  return {
    wasted,
    heal: wasted ? 0 : Math.min(cardValue(cardId), game.maxHp - game.hp),
  };
}

/** Equip option offered for a selected weapon. */
export interface WeaponActionsViewModel {
  /** True when equipping discards an existing weapon (the swap warning applies). */
  swap: boolean;
}

/** `_cardId` is accepted for symmetry with the other panel helpers. */
export function weaponActions(game: GameState, _cardId: CardId): WeaponActionsViewModel {
  return { swap: game.weapon !== null };
}

/**
 * Gate between the carry note and the action buttons: true while actions may
 * still be offered, false once only the "this card carries over" note applies.
 */
export function carryNoteState(game: GameState): boolean {
  return !canResolveMore(game);
}

/** Which carry-hint message applies to the current room state. */
export type RoomProgressKey = 'carrySingle' | 'carryNone' | 'carryDefault';

export function roomProgressKey(game: GameState): RoomProgressKey {
  const final = isFinalRoom(game);
  if (!final && game.room.length === 1) return 'carrySingle';
  if (final) return 'carryNone';
  return 'carryDefault';
}
