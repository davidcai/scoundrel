/**
 * Shared rule decisions for the Scoundrel rules engine.
 *
 * Every action is decided exactly once, here. The reducer applies the returned
 * plan, previews report the same plan's event or rejection, and legal-action
 * enumeration asks the same planners. That is what keeps previews and confirmed
 * outcomes in agreement (REQ-005) and keeps the interface from reimplementing
 * combat or action eligibility.
 */

import { MAX_HEALTH } from './constants';
import { cardKind, cardValue, isMonster, type CardId, type CardKind } from './cards';
import { ruleOptions } from './config';
import { calculateLossScore } from './scoring';
import { createRoomSnapshot, createWeapon, dealRoom } from './state';
import type {
  ActionPreview,
  AttackMode,
  CardResolvedEvent,
  GameAction,
  GameEvent,
  GameState,
  MonsterPreview,
  MonsterPreviewResult,
  RejectionReason,
  RoomCard,
  RoomSnapshot,
  RunHighlights,
  RunOutcome,
  RunResult,
  Weapon,
} from './types';

export type Plan =
  | { readonly ok: true; readonly state: GameState; readonly event: GameEvent }
  | { readonly ok: false; readonly reason: RejectionReason };

function reject(reason: RejectionReason): Plan {
  return { ok: false, reason };
}

/** True while the run is still being played. */
export function isRunActive(state: GameState): boolean {
  return state.status === 'playing';
}

/**
 * Whether the current room still has cards the player may resolve: three of four
 * in a normal room, all of them in the final room (rules.md, "Playing a Room").
 */
export function canResolveAnyCard(state: GameState): boolean {
  if (!isRunActive(state) || state.roomCleared) return false;
  if (state.finalRoom) return state.room.cards.length > 0;
  return state.room.cards.length > 1;
}

/**
 * Weapon degradation (rules.md, "Weapon Degradation", REQ-011): after a kill,
 * only strictly lower monsters are eligible. A fresh weapon has no limit, and
 * the degradation-off option removes the restriction entirely.
 */
function isWeaponEligible(state: GameState, monsterValue: number): boolean {
  if (state.weapon === null) return false;
  if (ruleOptions(state.config).degradationOff) return true;
  if (state.weapon.limit === null) return true;
  return monsterValue < state.weapon.limit;
}

/** Public form of the degradation check for interface previews (REQ-004/REQ-005). */
export function canWeaponFightMonster(state: GameState, monster: CardId): boolean {
  return isMonster(monster) && isWeaponEligible(state, cardValue(monster));
}

function buildResult(
  state: GameState,
  outcome: RunOutcome,
  health: number,
  highlights: RunHighlights,
): RunResult {
  const score = outcome === 'won' ? health : calculateLossScore(state.dungeon);
  return { outcome, health, score, seed: state.seed, config: state.config, highlights };
}

interface CardResolutionEffect {
  readonly health: number;
  readonly healing: number;
  readonly damage: number;
  readonly potionWasted: boolean;
  readonly potionUsedThisRoom: boolean;
  readonly weapon: Weapon | null;
  readonly weaponEquipped: boolean;
  readonly weaponReplaced: CardId | null;
  readonly weaponReplacedKills: readonly CardId[];
  readonly monsterDefeated: boolean;
  readonly addedToWeaponStack: boolean;
  readonly highlights: RunHighlights;
  readonly roomCleared: boolean;
}

/**
 * Rulings recorded for the "monsters defeated" run highlight:
 *
 * 1. A monster counts as defeated only when the player survives that resolution.
 *    When the monster's damage ends the run, the player was defeated, not the
 *    monster, so the result screen does not add it to the highlight or to a
 *    weapon's kill stack.
 * 2. The highlight is run-level: swapping or discarding a weapon does not remove
 *    earlier defeats, and the degradation-off option still records kills on the
 *    weapon's stack (REQ-011).
 */
function applyMonsterEffect(
  state: GameState,
  card: CardId,
  attack: AttackMode,
): CardResolutionEffect {
  const monsterValue = cardValue(card);
  let health = state.health;
  let weapon = state.weapon;
  let highlights = state.highlights;
  let monsterDefeated = false;
  let addedToWeaponStack = false;
  let damage: number;

  if (attack === 'weapon' && weapon !== null) {
    damage = Math.max(0, monsterValue - weapon.value);
    health -= damage;
    if (health > 0) {
      // rules.md: the defeated monster is placed on top of the weapon and
      // restricts future fights to lower-valued monsters.
      weapon = { ...weapon, kills: [...weapon.kills, card], limit: monsterValue };
      addedToWeaponStack = true;
      monsterDefeated = true;
    }
  } else {
    damage = monsterValue;
    health -= damage;
    if (health > 0) {
      monsterDefeated = true;
    }
  }

  if (monsterDefeated) {
    highlights = {
      ...highlights,
      monstersDefeated: highlights.monstersDefeated + 1,
    };
  }

  return {
    health,
    healing: 0,
    damage,
    potionWasted: false,
    potionUsedThisRoom: state.potionUsedThisRoom,
    weapon,
    weaponEquipped: false,
    weaponReplaced: null,
    weaponReplacedKills: [],
    monsterDefeated,
    addedToWeaponStack,
    highlights,
    roomCleared: false,
  };
}

function applyWeaponEffect(state: GameState, card: CardId): CardResolutionEffect {
  // rules.md: picking up a diamond equips it and automatically discards the old
  // weapon together with every monster it defeated (REQ-006).
  return {
    health: state.health,
    healing: 0,
    damage: 0,
    potionWasted: false,
    potionUsedThisRoom: state.potionUsedThisRoom,
    weapon: createWeapon(card),
    weaponEquipped: true,
    weaponReplaced: state.weapon?.card ?? null,
    weaponReplacedKills: state.weapon?.kills ?? [],
    monsterDefeated: false,
    addedToWeaponStack: false,
    highlights: state.highlights,
    roomCleared: false,
  };
}

function applyPotionEffect(state: GameState, card: CardId): CardResolutionEffect {
  const options = ruleOptions(state.config);
  const potionAllowed = options.unlimitedPotions || !state.potionUsedThisRoom;
  const healing = potionAllowed ? Math.min(cardValue(card), MAX_HEALTH - state.health) : 0;
  const potionWasted = healing === 0;
  const health = state.health + healing;
  const highlights: RunHighlights = potionWasted
    ? { ...state.highlights, potionsWasted: state.highlights.potionsWasted + 1 }
    : state.highlights;

  return {
    health,
    healing,
    damage: 0,
    potionWasted,
    // Drinking a potion at full health still counts as the room's potion
    // (ruling recorded in phase 2: the allowance is about consuming, not
    // healing), and a discarded second potion leaves the allowance used.
    potionUsedThisRoom: true,
    weapon: state.weapon,
    weaponEquipped: false,
    weaponReplaced: null,
    weaponReplacedKills: [],
    monsterDefeated: false,
    addedToWeaponStack: false,
    highlights,
    roomCleared: false,
  };
}

function planResolveCard(state: GameState, card: CardId, requestedAttack?: AttackMode): Plan {
  if (!isRunActive(state)) return reject('run-over');

  const cardIndex = state.room.cards.findIndex((roomCard) => roomCard.card === card);
  if (cardIndex === -1) return reject('card-not-in-room');
  if (!canResolveAnyCard(state)) return reject('card-not-resolvable');

  const kind: CardKind = cardKind(card);
  let attack: AttackMode | null = null;
  if (kind === 'monster') {
    if (requestedAttack === undefined) return reject('attack-mode-required');
    if (requestedAttack === 'weapon') {
      if (state.weapon === null) return reject('no-weapon');
      if (!isWeaponEligible(state, cardValue(card))) return reject('weapon-ineligible');
    }
    attack = requestedAttack;
  }

  const effect =
    kind === 'monster' && attack !== null
      ? applyMonsterEffect(state, card, attack)
      : kind === 'weapon'
        ? applyWeaponEffect(state, card)
        : applyPotionEffect(state, card);

  const roomCards = state.room.cards.filter((_roomCard, index) => index !== cardIndex);
  const resolvedThisRoom = state.resolvedThisRoom + 1;

  // Clearing is decided by the required-card counts: three resolutions leave a
  // carry in a normal room; the final room empties entirely.
  const roomRequirementMet = state.finalRoom ? roomCards.length === 0 : roomCards.length === 1;

  const health = effect.health;
  let highlights = effect.highlights;
  let roomCleared = state.roomCleared;
  let status = state.status;
  let result: RunResult | null = null;

  if (health <= 0) {
    // Death takes precedence even when the lethal resolution was the last
    // required card (implementation plan phase 2 acceptance): the room stays
    // explored but is not cleared, and the monster that killed the player is
    // not counted as defeated.
    status = 'lost';
    result = buildResult(state, 'lost', health, highlights);
  } else if (roomRequirementMet) {
    roomCleared = true;
    highlights = { ...highlights, roomsCleared: highlights.roomsCleared + 1 };
    if (state.finalRoom) {
      status = 'won';
      result = buildResult(state, 'won', health, highlights);
    }
  }

  const event: CardResolvedEvent = {
    type: 'cardResolved',
    card,
    cardKind: kind,
    attack,
    monsterValue: kind === 'monster' ? cardValue(card) : null,
    damage: effect.damage,
    healthBefore: state.health,
    healthAfter: health,
    healing: effect.healing,
    potionWasted: effect.potionWasted,
    monsterDefeated: effect.monsterDefeated,
    addedToWeaponStack: effect.addedToWeaponStack,
    weaponEquipped: effect.weaponEquipped,
    weaponReplaced: effect.weaponReplaced,
    weaponReplacedKills: effect.weaponReplacedKills,
    weapon: effect.weapon,
    roomCleared: roomRequirementMet && health > 0,
    runOutcome: result?.outcome ?? null,
    score: result?.score ?? null,
  };

  const nextState: GameState = {
    ...state,
    health,
    room: { cards: roomCards },
    weapon: effect.weapon,
    potionUsedThisRoom: effect.potionUsedThisRoom,
    resolvedThisRoom,
    roomCleared,
    highlights,
    status,
    result,
    // Undo is unavailable once the run ends (REQ-008).
    undo: status === 'playing' ? state.undo : null,
  };

  return { ok: true, state: nextState, event };
}

function planRunAway(state: GameState): Plan {
  if (!isRunActive(state)) return reject('run-over');
  if (state.finalRoom) return reject('escape-final-room');
  if (state.resolvedThisRoom > 0) return reject('escape-after-resolution');
  if (!ruleOptions(state.config).consecutiveEscapesAllowed && state.escapedLastRoom) {
    return reject('escape-consecutive-blocked');
  }

  // rules.md: return all four cards to the bottom of the dungeon as one block in
  // their current left-to-right order, then deal a new room.
  const returnedCards = state.room.cards.map((roomCard) => roomCard.card);
  const dungeon = [...state.dungeon, ...returnedCards];
  const dealt = dealRoom(dungeon);
  const highlights: RunHighlights = {
    ...state.highlights,
    roomsExplored: state.highlights.roomsExplored + 1,
  };

  const nextState: GameState = {
    ...state,
    dungeon: dealt.dungeon,
    room: dealt.room,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    escapedLastRoom: true,
    finalRoom: dealt.finalRoom,
    roomCleared: false,
    highlights,
    status: 'playing',
    result: null,
    undo: null,
  };

  return {
    ok: true,
    state: { ...nextState, undo: createRoomSnapshot(nextState) },
    event: {
      type: 'runAway',
      returnedCards,
      dealtCards: dealt.room.cards.map((roomCard) => roomCard.card),
      finalRoom: dealt.finalRoom,
    },
  };
}

function planEnterNextRoom(state: GameState): Plan {
  if (!isRunActive(state)) return reject('run-over');
  if (!state.roomCleared || state.finalRoom) return reject('room-not-cleared');

  // A cleared normal room holds exactly the carried card; anything else is not
  // a valid next-room starting point, so reject rather than dropping cards.
  if (state.room.cards.length !== 1) return reject('room-not-cleared');
  const remaining = state.room.cards[0];
  if (remaining === undefined) return reject('room-not-cleared');
  const carried: RoomCard = { card: remaining.card, carried: true };

  // rules.md: the fourth card carries into the next room, which is distinguishable
  // from newly dealt cards and keeps the potion allowance fresh. The rules leave
  // the carried card's position to the interface; this engine pins it leftmost,
  // followed by the newly dealt cards, so escape return order stays deterministic.
  const dealt = dealRoom(state.dungeon, [carried]);
  const highlights: RunHighlights = {
    ...state.highlights,
    roomsExplored: state.highlights.roomsExplored + 1,
  };

  const nextState: GameState = {
    ...state,
    dungeon: dealt.dungeon,
    room: dealt.room,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    escapedLastRoom: false,
    finalRoom: dealt.finalRoom,
    roomCleared: false,
    highlights,
    status: 'playing',
    result: null,
    undo: null,
  };

  return {
    ok: true,
    state: { ...nextState, undo: createRoomSnapshot(nextState) },
    event: {
      type: 'enterNextRoom',
      carriedCard: carried.card,
      dealtCards: dealt.room.cards.slice(1).map((roomCard) => roomCard.card),
      finalRoom: dealt.finalRoom,
    },
  };
}

function planUndoRoom(state: GameState): Plan {
  if (!isRunActive(state)) return reject('run-over');
  if (state.undo === null || state.resolvedThisRoom === 0) return reject('undo-unavailable');

  const snapshot: RoomSnapshot = state.undo;
  const nextState: GameState = {
    ...state,
    ...snapshot,
    status: 'playing',
    result: null,
    // Keep the room-start snapshot so repeated resolve/undo cycles cannot
    // accumulate highlight counts (REQ-008).
    undo: snapshot,
  };

  return { ok: true, state: nextState, event: { type: 'undoRoom' } };
}

/** Decide one action against the current state. */
export function planAction(state: GameState, action: GameAction): Plan {
  switch (action.type) {
    case 'resolveCard':
      return planResolveCard(state, action.card, action.attack);
    case 'runAway':
      return planRunAway(state);
    case 'enterNextRoom':
      return planEnterNextRoom(state);
    case 'undoRoom':
      return planUndoRoom(state);
  }
}

/** List every legal action in the current state; empty once the run is over. */
export function getLegalActions(state: GameState): GameAction[] {
  if (!isRunActive(state)) return [];

  const actions: GameAction[] = [];
  if (planRunAway(state).ok) actions.push({ type: 'runAway' });
  if (planEnterNextRoom(state).ok) actions.push({ type: 'enterNextRoom' });
  if (planUndoRoom(state).ok) actions.push({ type: 'undoRoom' });

  if (canResolveAnyCard(state)) {
    for (const roomCard of state.room.cards) {
      if (!isMonster(roomCard.card)) {
        actions.push({ type: 'resolveCard', card: roomCard.card });
        continue;
      }
      // Barehanded is always available; the weapon choice only when eligible
      // (REQ-005: fighting barehanded remains an option when a weapon is equipped).
      actions.push({ type: 'resolveCard', card: roomCard.card, attack: 'barehanded' });
      if (isWeaponEligible(state, cardValue(roomCard.card))) {
        actions.push({ type: 'resolveCard', card: roomCard.card, attack: 'weapon' });
      }
    }
  }

  return actions;
}

/**
 * Preview both monster choices and the weapon's restriction. The confirmed
 * result uses the same weapon-eligibility decision through `planAction`.
 *
 * Preview contract (REQ-004/REQ-005, phase 2 ruling): previews are always pure —
 * they never mutate state — and they report unavailability with the same
 * `RejectionReason` codes the reducer returns. Escape eligibility therefore
 * surfaces as `escape-after-resolution`, `escape-consecutive-blocked`, or
 * `escape-final-room`, and a weapon-ineligible attack surfaces as
 * `weapon-ineligible` while `MonsterPreview.weapon` carries the current limit
 * and the damage/health the player would face. Selecting or previewing a card is
 * not a resolution, so it never disables running away.
 */
export function previewMonster(state: GameState, card: CardId): MonsterPreviewResult {
  if (!isRunActive(state)) return { ok: false, reason: 'run-over' };
  if (!state.room.cards.some((roomCard) => roomCard.card === card)) {
    return { ok: false, reason: 'card-not-in-room' };
  }
  if (!isMonster(card)) return { ok: false, reason: 'not-a-monster' };
  if (!canResolveAnyCard(state)) return { ok: false, reason: 'card-not-resolvable' };

  const monsterValue = cardValue(card);
  const barehandedDamage = monsterValue;
  const weapon = state.weapon;
  const preview: MonsterPreview = {
    card,
    monsterValue,
    barehanded: {
      damage: barehandedDamage,
      healthAfter: state.health - barehandedDamage,
    },
    weapon:
      weapon === null
        ? null
        : {
            eligible: isWeaponEligible(state, monsterValue),
            limit: weapon.limit,
            damage: Math.max(0, monsterValue - weapon.value),
            healthAfter: state.health - Math.max(0, monsterValue - weapon.value),
          },
  };

  return { ok: true, preview };
}

/** Preview a card resolution (including the chosen monster attack) without committing it. */
export function previewCardResolution(
  state: GameState,
  card: CardId,
  attack?: AttackMode,
): ActionPreview {
  const plan = planResolveCard(state, card, attack);
  return plan.ok ? { ok: true, event: plan.event } : { ok: false, reason: plan.reason };
}
