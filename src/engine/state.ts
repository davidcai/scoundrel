/**
 * State construction and room dealing for the Scoundrel rules engine.
 *
 * All randomness for a run is resolved here and in seed.ts: `createInitialState`
 * shuffles the dungeon once, and every later deal is a deterministic slice of
 * that order. The reducer never consults a clock or a random source.
 */

import { ROOM_SIZE, STARTING_HEALTH } from './constants';
import { cardValue, type CardId } from './cards';
import { DEFAULT_RULE_CONFIG, isRuleConfig, type RuleConfig } from './config';
import { createDungeon, requireSeed } from './seed';
import type { GameState, Room, RoomCard, RoomSnapshot, RunHighlights, Weapon } from './types';

/** Result of filling a room from the dungeon. */
export interface DealResult {
  readonly room: Room;
  readonly dungeon: readonly CardId[];
  readonly finalRoom: boolean;
}

/** Build the room object from dealt cards, preserving left-to-right order. */
export function roomFromCards(cards: readonly RoomCard[]): Room {
  return { cards };
}

/**
 * Deal until the room holds four cards, including any carried card. If the
 * dungeon runs out first, deal every remaining card; once the draw pile is
 * empty after dealing, the room is the final room (rules.md, "Playing a Room").
 */
export function dealRoom(
  dungeon: readonly CardId[],
  carried: readonly RoomCard[] = [],
): DealResult {
  const needed = Math.max(0, ROOM_SIZE - carried.length);
  const dealt = dungeon.slice(0, needed);
  const remaining = dungeon.slice(dealt.length);

  const cards: RoomCard[] = [
    ...carried,
    ...dealt.map((card): RoomCard => ({ card, carried: false })),
  ];

  return { room: { cards }, dungeon: remaining, finalRoom: remaining.length === 0 };
}

/** The equipped-weapon shape for a newly picked-up diamond. */
export function createWeapon(card: CardId): Weapon {
  return { card, value: cardValue(card), kills: [], limit: null };
}

function startingHighlights(): RunHighlights {
  return { monstersDefeated: 0, potionsWasted: 0, roomsExplored: 1, roomsCleared: 0 };
}

/** Capture the room-start fields restored by "Undo to Room Start" (REQ-008). */
export function createRoomSnapshot(state: GameState): RoomSnapshot {
  return {
    health: state.health,
    dungeon: state.dungeon,
    room: state.room,
    weapon: state.weapon,
    potionUsedThisRoom: state.potionUsedThisRoom,
    resolvedThisRoom: state.resolvedThisRoom,
    escapedLastRoom: state.escapedLastRoom,
    finalRoom: state.finalRoom,
    roomCleared: state.roomCleared,
    highlights: state.highlights,
  };
}

/**
 * Create a run: validate the seed and rule options, shuffle the 44-card dungeon,
 * and deal the starting room.
 *
 * @throws RangeError when the seed is not 1–64 trimmed, NFC-normalized
 *   characters or the configuration mask is outside 0–7. Callers (the store)
 *   validate user input first; this guard protects engine invariants.
 */
export function createInitialState(
  seed: string,
  config: RuleConfig = DEFAULT_RULE_CONFIG,
): GameState {
  if (!isRuleConfig(config)) {
    throw new RangeError(`Invalid rule configuration mask: ${String(config)}`);
  }

  // Same validated, normalizing path as the exported seed builders (REQ-014).
  const normalizedSeed = requireSeed(seed);
  const dungeon = createDungeon(normalizedSeed);
  const { room, dungeon: remaining, finalRoom } = dealRoom(dungeon);

  const state: GameState = {
    seed: normalizedSeed,
    config,
    health: STARTING_HEALTH,
    dungeon: remaining,
    room,
    weapon: null,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    escapedLastRoom: false,
    finalRoom,
    roomCleared: false,
    highlights: startingHighlights(),
    status: 'playing',
    result: null,
    undo: null,
  };

  // The starting room is its own undo starting point.
  return { ...state, undo: createRoomSnapshot(state) };
}
