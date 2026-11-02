/**
 * Rule constants for the Scoundrel rules engine.
 *
 * Sources: docs/rules.md (setup, rooms, combat) and docs/prd.md (REQ-011 house
 * rules). Values here must not be duplicated in presentation code.
 */

/** Starting health and the maximum health a player can have (rules.md, "Health"). */
export const MAX_HEALTH = 20;
export const STARTING_HEALTH = MAX_HEALTH;

/** A room is dealt until it contains this many cards, including a carried card. */
export const ROOM_SIZE = 4;

/** Cards a player must resolve in a normal room; the fourth card carries over. */
export const NORMAL_ROOM_RESOLUTIONS = ROOM_SIZE - 1;

/** Longest accepted seed value, in characters after trimming and NFC normalization. */
export const MAX_SEED_LENGTH = 64;
