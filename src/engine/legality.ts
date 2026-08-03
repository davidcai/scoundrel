import type { Action } from "./actions";
import { roleOf, type Card } from "./cards";
import { MAX_HEALTH, ROOM_SIZE, weaponThreshold, type GameState } from "./state";

export type ReasonCode = "NO_WEAPON" | "WEAPON_THRESHOLD" | "RAN_LAST_ROOM" | "ROOM_IN_PROGRESS";

export type Effect =
  | { kind: "damage"; amount: number }
  | { kind: "heal"; amount: number; blocked: boolean }
  | { kind: "equip"; discards: Card | null }
  | { kind: "run" };

export type Offer = {
  readonly action: Action;
  readonly enabled: boolean;
  readonly reason?: ReasonCode;
  readonly effect: Effect;
  readonly threshold?: number;
};

/**
 * Offers for one face-up card. Monsters always yield exactly two offers,
 * weapon-first then barehanded, whether or not the weapon offer is enabled.
 */
export function offersFor(state: GameState, card: Card): readonly Offer[] {
  switch (roleOf(card)) {
    case "monster":
      return [monsterWeaponOffer(state, card), monsterBarehandedOffer(card)];
    case "potion":
      return [potionOffer(state, card)];
    case "weapon":
      return [equipOffer(state, card)];
  }
}

function monsterWeaponOffer(state: GameState, card: Card): Offer {
  const action: Action = { type: "FIGHT", cardId: card.id, useWeapon: true };
  const { weapon } = state;

  if (weapon === null) {
    return {
      action,
      enabled: false,
      reason: "NO_WEAPON",
      effect: { kind: "damage", amount: card.rank },
    };
  }

  const threshold = weaponThreshold(weapon);
  const damage = Math.max(0, card.rank - weapon.card.rank);

  if (threshold !== null && card.rank >= threshold) {
    return {
      action,
      enabled: false,
      reason: "WEAPON_THRESHOLD",
      effect: { kind: "damage", amount: damage },
      threshold,
    };
  }

  // Two shapes rather than `threshold: undefined`: `exactOptionalPropertyTypes`
  // forbids handing an optional property an explicit undefined.
  return threshold === null
    ? { action, enabled: true, effect: { kind: "damage", amount: damage } }
    : { action, enabled: true, effect: { kind: "damage", amount: damage }, threshold };
}

function monsterBarehandedOffer(card: Card): Offer {
  return {
    action: { type: "FIGHT", cardId: card.id, useWeapon: false },
    enabled: true,
    effect: { kind: "damage", amount: card.rank },
  };
}

function potionOffer(state: GameState, card: Card): Offer {
  const blocked = state.potionUsedThisRoom;
  const amount = blocked ? 0 : Math.min(card.rank, MAX_HEALTH - state.health);
  return {
    action: { type: "DRINK", cardId: card.id },
    enabled: true,
    effect: { kind: "heal", amount, blocked },
  };
}

function equipOffer(state: GameState, card: Card): Offer {
  return {
    action: { type: "EQUIP", cardId: card.id },
    enabled: true,
    effect: { kind: "equip", discards: state.weapon?.card ?? null },
  };
}

export function runOffer(state: GameState): Offer {
  const action: Action = { type: "RUN" };
  const effect: Effect = { kind: "run" };

  if (state.status !== "playing") {
    return { action, enabled: false, reason: "ROOM_IN_PROGRESS", effect };
  }
  if (state.ranLastRoom) {
    return { action, enabled: false, reason: "RAN_LAST_ROOM", effect };
  }
  if (state.room.length !== ROOM_SIZE) {
    return { action, enabled: false, reason: "ROOM_IN_PROGRESS", effect };
  }
  return { action, enabled: true, effect };
}

/** True when `action` is currently offered and enabled. Backs the reducer guard. */
export function isOffered(state: GameState, action: Action): boolean {
  if (action.type === "NEW_GAME") return true;
  if (state.status !== "playing") return false;
  if (action.type === "RUN") return runOffer(state).enabled;

  const card = state.room.find((c) => c.id === action.cardId);
  if (card === undefined) return false;

  return offersFor(state, card).some((offer) => offer.enabled && sameAction(offer.action, action));
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "FIGHT" && b.type === "FIGHT") {
    return a.cardId === b.cardId && a.useWeapon === b.useWeapon;
  }
  if ((a.type === "DRINK" || a.type === "EQUIP") && (b.type === "DRINK" || b.type === "EQUIP")) {
    return a.cardId === b.cardId;
  }
  return true;
}
