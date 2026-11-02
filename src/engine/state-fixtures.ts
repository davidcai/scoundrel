/**
 * State fixtures shared by the rules-engine tests.
 *
 * These helpers build valid `GameState` values directly so tests can pin exact
 * board situations (final rooms of one to four cards, a degraded weapon, and so
 * on) instead of hunting for one through a shuffled dungeon. They are test-only
 * and are not exported from the engine's public API.
 */

import { cardValue, type CardId } from './cards';
import { DEFAULT_RULE_CONFIG } from './config';
import type { GameState, Room, RoomCard, RunHighlights, Weapon } from './types';

export const EMPTY_HIGHLIGHTS: RunHighlights = {
  monstersDefeated: 0,
  potionsWasted: 0,
  roomsExplored: 1,
  roomsCleared: 0,
};

/**
 * Build a room in left-to-right order. Cards listed in `carried` are marked as
 * the card carried over from the previous room.
 */
export function roomOf(cards: readonly CardId[], carried: readonly CardId[] = []): Room {
  const cardsInRoom: RoomCard[] = cards.map((card) => ({
    card,
    carried: carried.includes(card),
  }));
  return { cards: cardsInRoom };
}

/** Build an equipped weapon. The limit follows the most recent kill, like play does. */
export function weaponOf(card: CardId, kills: readonly CardId[] = []): Weapon {
  const lastKill = kills[kills.length - 1];
  return {
    card,
    value: cardValue(card),
    kills,
    limit: lastKill === undefined ? null : cardValue(lastKill),
  };
}

/** A valid playing state; override any fields to pin a scenario. */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    seed: 'fixture-seed',
    config: DEFAULT_RULE_CONFIG,
    health: 20,
    dungeon: [],
    room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
    weapon: null,
    potionUsedThisRoom: false,
    resolvedThisRoom: 0,
    escapedLastRoom: false,
    finalRoom: false,
    roomCleared: false,
    highlights: EMPTY_HIGHLIGHTS,
    status: 'playing',
    result: null,
    undo: null,
  };
  return { ...base, ...overrides };
}
