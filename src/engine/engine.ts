import { buildDeck, cardKind, cardValue, monsterSum } from './cards';
import { mulberry32, seedToUint32, shuffle } from './rng';
import type {
  CardId,
  GameAction,
  GameConfig,
  GameResult,
  GameState,
  InvalidActionReason,
  ReducerOutput,
  RunAwayBlockReason,
} from './types';

export const STARTING_HP = 20;

/** Create the initial (undealt) state for a run. All randomness is resolved here: the dungeon is pre-shuffled. */
export function createInitialState(seed: string, config: GameConfig, startedAt = 0): GameState {
  const normalizedSeed = seed.trim().toLowerCase();
  const dungeon = shuffle(buildDeck(), mulberry32(seedToUint32(normalizedSeed)));
  return {
    seed: normalizedSeed,
    config,
    phase: 'playing',
    hp: STARTING_HP,
    maxHp: STARTING_HP,
    dungeon,
    room: [],
    resolvedCount: 0,
    carriedCardId: null,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 0,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
    startedAt,
    roomSnapshot: null,
  };
}

// ---------------------------------------------------------------------------
// Derived queries (pure) — the "available actions" surface the UI greys on.
// ---------------------------------------------------------------------------

/** A room is final when the Dungeon is empty after the deal: every card in it must be resolved. */
export function isFinalRoom(state: GameState): boolean {
  return state.room.length > 0 && state.dungeon.length === 0;
}

/** How many cards must be resolved in the current room: all of them (final) or all but one. */
export function roomResolveTarget(state: GameState): number {
  return isFinalRoom(state) ? state.resolvedCount + state.room.length : 3;
}

/** True while the player may still resolve cards in the current room. */
export function canResolveMore(state: GameState): boolean {
  return isFinalRoom(state) ? state.room.length > 0 : state.room.length > 1;
}

/** True once 3 of 4 are resolved and the carry card is waiting (non-final rooms only). */
export function canEnterNextRoom(state: GameState): boolean {
  return state.phase === 'playing' && !isFinalRoom(state) && state.room.length === 1;
}

export function canUndo(state: GameState): boolean {
  return state.phase === 'playing' && state.roomSnapshot !== null;
}

export interface RunAwayStatus {
  legal: boolean;
  reason?: RunAwayBlockReason;
}

/** Run-away legality: blocked in the final room, after engaging, or twice in a row (per config). */
export function runAwayStatus(state: GameState): RunAwayStatus {
  if (state.phase !== 'playing' || state.room.length === 0) {
    return { legal: false, reason: 'final-room' };
  }
  if (isFinalRoom(state)) return { legal: false, reason: 'final-room' };
  if (state.resolvedCount > 0) return { legal: false, reason: 'already-engaged' };
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
    return { legal: false, reason: 'twice-in-a-row' };
  }
  return { legal: true };
}

export interface FightPreview {
  legal: boolean;
  reason?: InvalidActionReason;
  usesWeapon: boolean;
  damage: number;
}

/** Damage preview for the confirm step. Mirrors FightMonster's logic without applying it. */
export function previewFight(state: GameState, cardId: CardId, barehanded: boolean): FightPreview {
  if (state.phase !== 'playing')
    return { legal: false, reason: 'game-over', usesWeapon: false, damage: 0 };
  if (!state.room.includes(cardId))
    return { legal: false, reason: 'not-in-room', usesWeapon: false, damage: 0 };
  if (cardKind(cardId) !== 'monster') {
    return { legal: false, reason: 'not-a-monster', usesWeapon: false, damage: 0 };
  }
  if (!canResolveMore(state))
    return { legal: false, reason: 'room-complete', usesWeapon: false, damage: 0 };

  const usesWeapon = !barehanded && state.weapon !== null;
  const monsterValue = cardValue(cardId);
  if (usesWeapon) {
    const lastKill = state.killStack[state.killStack.length - 1];
    if (
      state.config.weaponDegradation &&
      lastKill !== undefined &&
      monsterValue >= cardValue(lastKill)
    ) {
      return { legal: false, reason: 'weapon-too-weak', usesWeapon: true, damage: 0 };
    }
    const weaponValue = state.weapon !== null ? cardValue(state.weapon) : 0;
    return { legal: true, usesWeapon: true, damage: Math.max(0, monsterValue - weaponValue) };
  }
  return { legal: true, usesWeapon: false, damage: monsterValue };
}

/** Highest monster value the current weapon may fight (null = unrestricted). */
export function weaponThreshold(state: GameState): number | null {
  if (!state.config.weaponDegradation || state.weapon === null) return null;
  const lastKill = state.killStack[state.killStack.length - 1];
  return lastKill !== undefined ? cardValue(lastKill) - 1 : null;
}

/** Score for a terminal state (source for the stats RunRecord). */
export function finalScore(state: GameState): number {
  if (state.phase === 'won') return state.hp;
  if (state.phase === 'lost') {
    const deficit = monsterSum(state.dungeon);
    return deficit === 0 ? 0 : -deficit;
  }
  throw new Error('finalScore called on a non-terminal state');
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function invalid(state: GameState, reason: InvalidActionReason): ReducerOutput {
  return { state, result: { type: 'InvalidAction', reason } };
}

/** Room-start snapshot: the state itself with the snapshot field nulled (no cycles, JSON-safe). */
function snapshotOf(state: GameState): GameState {
  return { ...state, roomSnapshot: null };
}

function resolveCard(state: GameState, cardId: CardId): Pick<GameState, 'room' | 'resolvedCount'> {
  return { room: state.room.filter((c) => c !== cardId), resolvedCount: state.resolvedCount + 1 };
}

/**
 * Terminal check after a resolve action: defeat at ≤0 HP, victory when the
 * final room is fully resolved. Returns the terminal result (with phase set on
 * the state) or falls through to the per-action result.
 */
function withTerminal(state: GameState, baseResult: GameResult): ReducerOutput {
  if (state.hp <= 0) {
    const deficit = monsterSum(state.dungeon);
    return {
      state: { ...state, phase: 'lost' },
      result: {
        type: 'GameLost',
        score: deficit === 0 ? 0 : -deficit,
        seed: state.seed,
        config: state.config,
      },
    };
  }
  if (state.dungeon.length === 0 && state.room.length === 0) {
    return {
      state: { ...state, phase: 'won' },
      result: { type: 'GameWon', score: state.hp, seed: state.seed, config: state.config },
    };
  }
  return { state, result: baseResult };
}

function deal(state: GameState, carriedCardId: CardId | null): GameState {
  const carried = carriedCardId !== null ? [carriedCardId] : [];
  const roomSize = 4 - carried.length;
  const drawn = state.dungeon.slice(0, roomSize);
  const next: GameState = {
    ...state,
    dungeon: state.dungeon.slice(drawn.length),
    room: [...carried, ...drawn],
    resolvedCount: 0,
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: state.turnCount + 1,
    carriedCardId,
  };
  next.roomSnapshot = snapshotOf(next);
  return next;
}

export function reducer(state: GameState, action: GameAction): ReducerOutput {
  switch (action.type) {
    case 'StartNewRun':
      return {
        state: createInitialState(action.seed, action.config, action.startedAt ?? 0),
        result: {
          type: 'RunStarted',
          seed: action.seed.trim().toLowerCase(),
          config: action.config,
        },
      };

    case 'DealRoom': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (state.room.length > 0) return invalid(state, 'room-active');
      const next = deal(state, null);
      return { state: next, result: { type: 'RoomDealt', cards: next.room, carriedFrom: null } };
    }

    case 'EnterNextRoom': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (state.room.length === 0) return invalid(state, 'not-dealt');
      if (isFinalRoom(state)) return invalid(state, 'final-room');
      if (state.room.length > 1) return invalid(state, 'room-not-resolved');
      const carried = state.room[0];
      if (carried === undefined) return invalid(state, 'not-dealt');
      // The just-cleared room counts as explored before the snapshot captures the new room.
      const explored: GameState = {
        ...state,
        runHighlights: {
          ...state.runHighlights,
          roomsExplored: state.runHighlights.roomsExplored + 1,
        },
      };
      const next = deal(explored, carried);
      return { state: next, result: { type: 'RoomDealt', cards: next.room, carriedFrom: carried } };
    }

    case 'FightMonster': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (!state.room.includes(action.cardId)) return invalid(state, 'not-in-room');
      if (cardKind(action.cardId) !== 'monster') return invalid(state, 'not-a-monster');
      if (!canResolveMore(state)) return invalid(state, 'room-complete');

      const preview = previewFight(state, action.cardId, action.barehanded === true);
      if (!preview.legal) return invalid(state, preview.reason ?? 'not-a-monster');

      const usesWeapon = preview.usesWeapon;
      const next: GameState = {
        ...state,
        ...resolveCard(state, action.cardId),
        hp: state.hp - preview.damage,
        killStack: usesWeapon ? [...state.killStack, action.cardId] : state.killStack,
        runHighlights: {
          ...state.runHighlights,
          monstersKilled: state.runHighlights.monstersKilled + 1,
        },
      };
      return withTerminal(next, {
        type: 'MonsterDefeated',
        cardId: action.cardId,
        damage: preview.damage,
        usedWeaponId: usesWeapon ? state.weapon : null,
        weaponBroke: false,
      });
    }

    case 'EquipWeapon': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (!state.room.includes(action.cardId)) return invalid(state, 'not-in-room');
      if (cardKind(action.cardId) !== 'weapon') return invalid(state, 'not-a-weapon');
      if (!canResolveMore(state)) return invalid(state, 'room-complete');
      const next: GameState = {
        ...state,
        ...resolveCard(state, action.cardId),
        weapon: action.cardId,
        killStack: [],
      };
      return withTerminal(next, {
        type: 'WeaponEquipped',
        cardId: action.cardId,
        discardedWeaponId: state.weapon,
        discardedMonsterIds: state.killStack,
      });
    }

    case 'DrinkPotion': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (!state.room.includes(action.cardId)) return invalid(state, 'not-in-room');
      if (cardKind(action.cardId) !== 'potion') return invalid(state, 'not-a-potion');
      if (!canResolveMore(state)) return invalid(state, 'room-complete');
      const cap = state.config.potionsPerRoom === 'one' ? 1 : Infinity;
      const wasted = state.potionsUsedThisRoom >= cap;
      const healed = wasted ? 0 : Math.min(cardValue(action.cardId), state.maxHp - state.hp);
      const next: GameState = {
        ...state,
        ...resolveCard(state, action.cardId),
        hp: state.hp + healed,
        potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
        runHighlights: {
          ...state.runHighlights,
          potionsWasted: state.runHighlights.potionsWasted + (wasted ? 1 : 0),
        },
      };
      return withTerminal(next, {
        type: 'PotionQuaffed',
        cardId: action.cardId,
        healed,
        wasted,
      });
    }

    case 'RunAway': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      if (state.room.length === 0) return invalid(state, 'not-dealt');
      const status = runAwayStatus(state);
      if (!status.legal) {
        return { state, result: { type: 'RunAwayBlocked', reason: status.reason ?? 'final-room' } };
      }
      // All four room cards go to the bottom of the Dungeon, then a fresh room is dealt.
      const dungeon = [...state.dungeon, ...state.room];
      const dealt = dungeon.slice(0, 4);
      const next: GameState = {
        ...state,
        dungeon: dungeon.slice(dealt.length),
        room: dealt,
        resolvedCount: 0,
        potionsUsedThisRoom: 0,
        ranAwayLastRoom: true,
        turnCount: state.turnCount + 1,
        carriedCardId: null,
      };
      next.roomSnapshot = snapshotOf(next);
      return { state: next, result: { type: 'RanAway', newCards: dealt } };
    }

    case 'UndoToRoomStart': {
      if (state.phase !== 'playing') return invalid(state, 'game-over');
      const snapshot = state.roomSnapshot;
      if (snapshot === null) return invalid(state, 'no-snapshot');
      // Restore the room-start truth but keep the snapshot handle so undo stays repeatable.
      const restored: GameState = { ...snapshot, roomSnapshot: snapshot };
      return { state: restored, result: { type: 'UndoDone' } };
    }
  }
}
