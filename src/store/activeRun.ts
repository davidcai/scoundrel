/**
 * The persisted active-run payload (REQ-001, REQ-008, REQ-009, REQ-010).
 *
 * One saved run at a time. The payload keeps the complete rules-engine state,
 * including the room-start undo snapshot, so reloading restores the room and
 * the undo affordance exactly. A completed result stays in the payload (with
 * the same shape) so reloading restores the result screen; `completedAt` and
 * `outcomeRecorded` support once-only statistics recording.
 *
 * Persisted data is untrusted input: `isPersistedRun` validates the whole
 * engine state before the store resumes it.
 */
import {
  MAX_HEALTH,
  ROOM_SIZE,
  cardValue,
  isCardId,
  isMonster,
  isRuleConfig,
  isWeaponCard,
  parseSeed,
  type CardId,
  type GameState,
  type Room,
  type RoomSnapshot,
  type RuleConfig,
  type RunHighlights,
  type RunResult,
  type Weapon,
} from '../engine';
import { isIsoTimestamp, isNonEmptyString, isRecord } from './validation';

export interface PersistedRun {
  readonly runId: string;
  /** Normalized seed; matches `state.seed`. */
  readonly seed: string;
  readonly config: RuleConfig;
  readonly startedAt: string;
  readonly updatedAt: string;
  /** Null while the run is unfinished; set once the run has a final result. */
  readonly completedAt: string | null;
  /** True once the final outcome has been applied to statistics. */
  readonly outcomeRecorded: boolean;
  readonly state: GameState;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isHighlights(value: unknown): value is RunHighlights {
  if (!isRecord(value)) return false;
  return (
    isCount(value.monstersDefeated) &&
    isCount(value.potionsWasted) &&
    isCount(value.roomsExplored) &&
    isCount(value.roomsCleared)
  );
}

function sameHighlights(a: RunHighlights, b: RunHighlights): boolean {
  return (
    a.monstersDefeated === b.monstersDefeated &&
    a.potionsWasted === b.potionsWasted &&
    a.roomsExplored === b.roomsExplored &&
    a.roomsCleared === b.roomsCleared
  );
}

function isCardList(value: unknown): value is readonly CardId[] {
  return Array.isArray(value) && value.every((card) => isCardId(card));
}

function isWeapon(value: unknown): value is Weapon {
  if (!isRecord(value)) return false;
  const card = value.card;
  if (typeof card !== 'string' || !isCardId(card) || !isWeaponCard(card)) return false;
  if (typeof value.value !== 'number' || value.value !== cardValue(card)) return false;
  if (!isCardList(value.kills) || value.kills.length > 44) return false;
  if (!value.kills.every((kill) => isMonster(kill))) return false;
  if (new Set(value.kills).size !== value.kills.length) return false;
  if (value.limit !== null && (!isCount(value.limit) || value.limit <= 0 || value.limit > 14)) {
    return false;
  }
  return true;
}

function isRoom(value: unknown): value is Room {
  if (!isRecord(value) || !Array.isArray(value.cards)) return false;
  if (value.cards.length > ROOM_SIZE) return false;
  const seen = new Set<string>();
  for (let index = 0; index < value.cards.length; index += 1) {
    const roomCard: unknown = value.cards[index];
    if (!isRecord(roomCard)) return false;
    const card = roomCard.card;
    if (typeof card !== 'string' || !isCardId(card)) return false;
    if (typeof roomCard.carried !== 'boolean') return false;
    // Only the leftmost card can be the carried card from the previous room.
    if (roomCard.carried && index !== 0) return false;
    if (seen.has(card)) return false;
    seen.add(card);
  }
  return true;
}

function isCardSetUnique(parts: readonly (readonly CardId[])[]): boolean {
  const seen = new Set<CardId>();
  for (const part of parts) {
    for (const card of part) {
      if (seen.has(card)) return false;
      seen.add(card);
    }
  }
  return seen.size <= 44;
}

function weaponCards(weapon: Weapon | null): readonly CardId[] {
  if (weapon === null) return [];
  return [weapon.card, ...weapon.kills];
}

function isRunResult(value: unknown): value is RunResult {
  if (!isRecord(value)) return false;
  // A fatal hit can take health below zero; the engine keeps the overkill
  // value in the final result.
  const health = value.health;
  if (typeof health !== 'number' || !Number.isInteger(health) || health > MAX_HEALTH) return false;
  if (
    (value.outcome === 'won' || value.outcome === 'lost') &&
    value.outcome !== 'lost' &&
    health < 0
  ) {
    return false;
  }
  return (
    (value.outcome === 'won' || value.outcome === 'lost') &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    Number.isInteger(value.score) &&
    typeof value.seed === 'string' &&
    parseSeed(value.seed) === value.seed &&
    typeof value.config === 'number' &&
    isRuleConfig(value.config) &&
    isHighlights(value.highlights)
  );
}

function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!isRecord(value)) return false;
  if (!isCount(value.health) || value.health > MAX_HEALTH) return false;
  if (!isCardList(value.dungeon)) return false;
  if (!isRoom(value.room)) return false;
  if (!(value.weapon === null || isWeapon(value.weapon))) return false;
  if (
    !isCardSetUnique([
      value.dungeon,
      value.room.cards.map((roomCard) => roomCard.card),
      weaponCards(value.weapon),
    ])
  ) {
    return false;
  }
  return (
    typeof value.potionUsedThisRoom === 'boolean' &&
    isCount(value.resolvedThisRoom) &&
    value.resolvedThisRoom <= ROOM_SIZE &&
    typeof value.escapedLastRoom === 'boolean' &&
    typeof value.finalRoom === 'boolean' &&
    typeof value.roomCleared === 'boolean' &&
    isHighlights(value.highlights)
  );
}

/** Validates a rules-engine state loaded from storage. */
export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (typeof value.seed !== 'string' || parseSeed(value.seed) !== value.seed) return false;
  if (typeof value.config !== 'number' || !isRuleConfig(value.config)) return false;
  const health = value.health;
  if (typeof health !== 'number' || !Number.isInteger(health) || health > MAX_HEALTH) return false;
  if (typeof value.status !== 'string') return false;
  if (value.status !== 'lost' && health < 0) return false;
  if (!isCardList(value.dungeon)) return false;
  if (!isRoom(value.room)) return false;
  if (!(value.weapon === null || isWeapon(value.weapon))) return false;
  if (
    !isCardSetUnique([
      value.dungeon,
      value.room.cards.map((roomCard) => roomCard.card),
      weaponCards(value.weapon),
    ])
  ) {
    return false;
  }
  if (typeof value.potionUsedThisRoom !== 'boolean') return false;
  if (!isCount(value.resolvedThisRoom) || value.resolvedThisRoom > ROOM_SIZE) return false;
  if (typeof value.escapedLastRoom !== 'boolean') return false;
  if (typeof value.finalRoom !== 'boolean') return false;
  if (typeof value.roomCleared !== 'boolean') return false;
  if (!isHighlights(value.highlights)) return false;
  if (value.status !== 'playing' && value.status !== 'won' && value.status !== 'lost') return false;
  if (value.result !== null && !isRunResult(value.result)) return false;
  if (value.undo !== null && !isRoomSnapshot(value.undo)) return false;

  if (value.status === 'playing') {
    return value.result === null;
  }
  const result = value.result;
  if (result === null || !isRunResult(result)) return false;
  return (
    result.outcome === value.status &&
    result.health === value.health &&
    result.seed === value.seed &&
    result.config === value.config &&
    sameHighlights(result.highlights, value.highlights)
  );
}

/** Validates one persisted-run payload; used before resuming or restoring a result. */
export function isPersistedRun(value: unknown): value is PersistedRun {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.runId)) return false;
  if (typeof value.seed !== 'string' || parseSeed(value.seed) !== value.seed) return false;
  if (typeof value.config !== 'number' || !isRuleConfig(value.config)) return false;
  if (!isIsoTimestamp(value.startedAt) || !isIsoTimestamp(value.updatedAt)) return false;
  if (Date.parse(value.updatedAt) < Date.parse(value.startedAt)) return false;
  if (!isGameState(value.state)) return false;
  if (value.state.seed !== value.seed || value.state.config !== value.config) return false;
  if (typeof value.outcomeRecorded !== 'boolean') return false;

  if (value.state.status === 'playing') {
    return value.completedAt === null && value.outcomeRecorded === false;
  }
  if (!isIsoTimestamp(value.completedAt)) return false;
  if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) return false;
  return value.state.result !== null;
}

/** Build a fresh playing-run payload from a rules-engine state. */
export function createPersistedRun(
  runId: string,
  state: GameState,
  startedAt: string,
  updatedAt: string,
): PersistedRun {
  return {
    runId,
    seed: state.seed,
    config: state.config,
    startedAt,
    updatedAt,
    completedAt: state.status === 'playing' ? null : updatedAt,
    outcomeRecorded: false,
    state,
  };
}

/** True when the payload still holds an unfinished, resumable run. */
export function isRunInProgress(run: PersistedRun | null): run is PersistedRun {
  return run !== null && run.state.status === 'playing';
}
