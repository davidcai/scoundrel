/**
 * Derived presentation state. Everything here is computed from the engine state
 * or the engine's own preview functions; the interface never reimplements a
 * game rule.
 */
import {
  MAX_HEALTH,
  RULE_OPTION_BITS,
  canResolveAnyCard,
  cardKind,
  cardValue,
  previewAction,
  previewCardResolution,
  ruleOptions,
  type CardId,
  type CardKind,
  type GameState,
  type RejectionReason,
  type RuleConfig,
  type RuleOptions,
  type Weapon,
} from '../engine';

export interface CardView {
  readonly card: CardId;
  /** 1-based position in the room, left to right (carried card is first). */
  readonly index: number;
  readonly total: number;
  readonly kind: CardKind;
  readonly value: number;
  readonly carried: boolean;
  readonly selected: boolean;
  /** Reason the card cannot be resolved right now, if any. */
  readonly reason: RejectionReason | null;
}

/**
 * Room-card presentation. A card is marked not-usable only when the engine says
 * nothing can be resolved in the room right now (or the run is over); a monster
 * whose weapon attack is ineligible is still resolvable barehanded, so it stays
 * usable and its preview explains the weapon restriction.
 */
export function getCardViews(state: GameState, selectedCard: CardId | null): CardView[] {
  const resolvable = canResolveAnyCard(state);
  return state.room.cards.map((roomCard, position) => {
    let reason: RejectionReason | null = null;
    if (!resolvable) {
      const preview = previewCardResolution(state, roomCard.card);
      reason = preview.ok ? null : preview.reason;
    }
    return {
      card: roomCard.card,
      index: position + 1,
      total: state.room.cards.length,
      kind: cardKind(roomCard.card),
      value: cardValue(roomCard.card),
      carried: roomCard.carried,
      selected: selectedCard === roomCard.card,
      reason,
    };
  });
}

export interface Availability {
  readonly enabled: boolean;
  readonly reason: RejectionReason | null;
}

export interface ActionAvailability {
  readonly runAway: Availability;
  readonly enterNextRoom: Availability;
  readonly undoRoom: Availability;
}

function availability(state: GameState, action: Parameters<typeof previewAction>[1]): Availability {
  const preview = previewAction(state, action);
  return preview.ok ? { enabled: true, reason: null } : { enabled: false, reason: preview.reason };
}

/** Reasons come from the same planners the reducer uses (REQ-004/REQ-005). */
export function getActionAvailability(state: GameState): ActionAvailability {
  return {
    runAway: availability(state, { type: 'runAway' }),
    enterNextRoom: availability(state, { type: 'enterNextRoom' }),
    undoRoom: availability(state, { type: 'undoRoom' }),
  };
}

export interface PotionStatus {
  readonly available: boolean;
  readonly usedThisRoom: boolean;
  readonly unlimited: boolean;
}

export function getPotionStatus(state: GameState): PotionStatus {
  const unlimited = ruleOptions(state.config).unlimitedPotions;
  return {
    available: unlimited || !state.potionUsedThisRoom,
    usedThisRoom: state.potionUsedThisRoom,
    unlimited,
  };
}

export interface WeaponView {
  readonly weapon: Weapon | null;
  /** True when weapon degradation restricts this weapon's next targets. */
  readonly broken: boolean;
  readonly brokenLimit: number | null;
  readonly kills: readonly CardId[];
}

export function getWeaponView(state: GameState): WeaponView {
  const weapon = state.weapon;
  const degradationOff = ruleOptions(state.config).degradationOff;
  const limit = weapon?.limit ?? null;
  return {
    weapon,
    broken: weapon !== null && limit !== null && !degradationOff,
    brokenLimit: limit,
    kills: weapon?.kills ?? [],
  };
}

export function getRoomNumber(state: GameState): number {
  return state.highlights.roomsExplored;
}

export function getDungeonCount(state: GameState): number {
  return state.dungeon.length;
}

export function getDefeatedTotal(state: GameState): number {
  return state.highlights.monstersDefeated;
}

export function getHealthView(state: GameState): { health: number; max: number } {
  return { health: state.health, max: MAX_HEALTH };
}

/** Compose the 3-bit house-rule mask from the title-screen checkboxes. */
export function configFromOptions(options: RuleOptions): RuleConfig {
  let mask = 0;
  if (options.consecutiveEscapesAllowed) mask |= RULE_OPTION_BITS.consecutiveEscapesAllowed;
  if (options.unlimitedPotions) mask |= RULE_OPTION_BITS.unlimitedPotions;
  if (options.degradationOff) mask |= RULE_OPTION_BITS.degradationOff;
  return mask as RuleConfig;
}
