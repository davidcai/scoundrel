import { buildDeck, cardValue, isMonster, isPotion, isWeapon } from './cards';
import { mulberry32, seedToUint32, shuffledDeck } from './rng';
import type { Action, CardId, GameConfig, GameState, ReducerOutput, Result } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  runAwayMode: 'once',
  potionsPerRoom: 1,
  weaponDegradation: true,
};

/** A room is "final" (resolve-all, no carryover) once the dungeon is empty. */
export function isFinalRoom(state: GameState): boolean {
  return state.dungeon.length === 0;
}

/**
 * How many cards must be resolved in total for this room: 3 for a normal
 * room, and every card for a final room. `resolvedCount + room.length` is the
 * invariant total (it never changes as cards leave the room).
 */
export function resolveLimit(state: GameState): number {
  if (isFinalRoom(state)) return state.resolvedCount + state.room.length;
  return 3;
}

function takeSnapshot(state: GameState): GameState {
  return {
    ...state,
    dungeon: [...state.dungeon],
    room: [...state.room],
    killStack: [...state.killStack],
    runHighlights: { ...state.runHighlights },
    roomSnapshot: null,
  };
}

function restoreFromSnapshot(state: GameState): GameState {
  const snap = state.roomSnapshot as GameState;
  const restored: GameState = { ...snap };
  restored.roomSnapshot = takeSnapshot(snap);
  return restored;
}

function dealNextRoom(state: GameState, carried: CardId[]): GameState {
  const slots = 4 - carried.length;
  const dealCount = Math.min(slots, state.dungeon.length);
  const room = [...carried, ...state.dungeon.slice(0, dealCount)];
  const dungeon = state.dungeon.slice(dealCount);
  const next: GameState = {
    ...state,
    dungeon,
    room,
    resolvedCount: 0,
    potionsUsedThisRoom: 0,
    turnCount: state.turnCount + 1,
    runHighlights: {
      ...state.runHighlights,
      roomsExplored: state.runHighlights.roomsExplored + 1,
    },
    roomSnapshot: null,
  };
  next.roomSnapshot = takeSnapshot(next);
  return next;
}

/** Lose score = 0 minus the value of every monster still in the draw pile. */
function lossScore(state: GameState): number {
  let sum = 0;
  for (const id of state.dungeon) {
    if (isMonster(id)) sum += cardValue(id);
  }
  return -sum;
}

function invalid(state: GameState, reason: string): ReducerOutput {
  return { state, result: { type: 'InvalidAction', reason } };
}

/** After a resolution, transition to won/lost when the run has ended. */
function maybeEnd(state: GameState, otherwise: Result): ReducerOutput {
  if (state.hp <= 0) {
    const next: GameState = { ...state, phase: 'lost' };
    return {
      state: next,
      result: { type: 'GameLost', score: lossScore(next), seed: next.seed, config: next.config },
    };
  }
  if (isFinalRoom(state) && state.room.length === 0) {
    const next: GameState = { ...state, phase: 'won' };
    return {
      state: next,
      result: { type: 'GameWon', score: next.hp, seed: next.seed, config: next.config },
    };
  }
  return { state, result: otherwise };
}

/** Build a fresh state with a shuffled dungeon and the first room dealt. */
export function createInitialState(
  seed: string,
  config: GameConfig = DEFAULT_CONFIG,
  startedAt?: number,
): GameState {
  const rand = mulberry32(seedToUint32(seed));
  const dungeon = shuffledDeck(buildDeck(), rand);
  const base: GameState = {
    seed,
    config: { ...config },
    phase: 'playing',
    hp: 20,
    maxHp: 20,
    dungeon,
    room: [],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 0,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
    startedAt: startedAt ?? Date.now(),
    roomSnapshot: null,
  };
  return dealNextRoom(base, []);
}

export function reducer(state: GameState, action: Action): ReducerOutput {
  switch (action.type) {
    case 'StartNewRun': {
      const fresh = createInitialState(action.seed, action.config ?? DEFAULT_CONFIG);
      return { state: fresh, result: { type: 'RoomDealt', cards: fresh.room } };
    }

    case 'DealRoom': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      if (state.room.length > 0 || state.resolvedCount > 0) return invalid(state, 'room-in-progress');
      const next = dealNextRoom(state, []);
      return { state: next, result: { type: 'RoomDealt', cards: next.room } };
    }

    case 'FightMonster': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      const { cardId } = action;
      if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room');
      if (!isMonster(cardId)) return invalid(state, 'not-a-monster');
      if (state.resolvedCount >= resolveLimit(state)) return invalid(state, 'room-resolved');

      const barehanded = action.barehanded === true || state.weapon === null;
      const monsterValue = cardValue(cardId);
      let damage: number;
      let usedWeaponId: CardId | undefined;

      if (!barehanded) {
        const weapon = state.weapon as CardId;
        if (state.config.weaponDegradation && state.killStack.length > 0) {
          const lastKill = cardValue(state.killStack[state.killStack.length - 1]);
          if (monsterValue >= lastKill) return invalid(state, 'weapon-degraded');
        }
        damage = Math.max(0, monsterValue - cardValue(weapon));
        usedWeaponId = weapon;
      } else {
        damage = monsterValue;
      }

      const next: GameState = {
        ...state,
        room: state.room.filter((id) => id !== cardId),
        resolvedCount: state.resolvedCount + 1,
        hp: state.hp - damage,
        killStack: barehanded ? state.killStack : [...state.killStack, cardId],
        runHighlights: {
          ...state.runHighlights,
          monstersKilled: state.runHighlights.monstersKilled + 1,
        },
      };

      return maybeEnd(next, {
        type: 'MonsterDefeated',
        cardId,
        damage,
        weaponBroke: false,
        usedWeaponId,
      });
    }

    case 'DrinkPotion': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      const { cardId } = action;
      if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room');
      if (!isPotion(cardId)) return invalid(state, 'not-a-potion');
      if (state.resolvedCount >= resolveLimit(state)) return invalid(state, 'room-resolved');

      const canHeal = state.potionsUsedThisRoom < state.config.potionsPerRoom;
      const healed = canHeal ? Math.min(cardValue(cardId), state.maxHp - state.hp) : 0;
      const wasted = !canHeal;

      const next: GameState = {
        ...state,
        room: state.room.filter((id) => id !== cardId),
        resolvedCount: state.resolvedCount + 1,
        hp: state.hp + healed,
        potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
        runHighlights: wasted
          ? { ...state.runHighlights, potionsWasted: state.runHighlights.potionsWasted + 1 }
          : state.runHighlights,
      };

      return maybeEnd(next, { type: 'PotionQuaffed', cardId, healed, wasted });
    }

    case 'EquipWeapon': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      const { cardId } = action;
      if (!state.room.includes(cardId)) return invalid(state, 'card-not-in-room');
      if (!isWeapon(cardId)) return invalid(state, 'not-a-weapon');
      if (state.resolvedCount >= resolveLimit(state)) return invalid(state, 'room-resolved');

      const discardedWeaponId = state.weapon ?? undefined;
      const discardedMonsterIds = state.killStack;

      const next: GameState = {
        ...state,
        room: state.room.filter((id) => id !== cardId),
        resolvedCount: state.resolvedCount + 1,
        weapon: cardId,
        killStack: [],
      };

      return maybeEnd(next, {
        type: 'WeaponEquipped',
        cardId,
        discardedWeaponId,
        discardedMonsterIds,
      });
    }

    case 'RunAway': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      if (state.resolvedCount !== 0) return invalid(state, 'room-started');
      if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
        return { state, result: { type: 'RunAwayBlocked', reason: 'twice-in-row' } };
      }
      if (state.dungeon.length < 4) {
        return { state, result: { type: 'RunAwayBlocked', reason: 'no-cards' } };
      }
      const withRoomAtBottom: GameState = {
        ...state,
        dungeon: [...state.dungeon, ...state.room],
        ranAwayLastRoom: true,
      };
      const next = dealNextRoom(withRoomAtBottom, []);
      return { state: next, result: { type: 'RanAway', newCards: next.room } };
    }

    case 'UndoToRoomStart': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      if (!state.roomSnapshot) return { state, result: { type: 'UndoDone' } };
      return { state: restoreFromSnapshot(state), result: { type: 'UndoDone' } };
    }

    case 'EnterNextRoom': {
      if (state.phase !== 'playing') return invalid(state, 'game-ended');
      if (isFinalRoom(state)) return invalid(state, 'no-next-room');
      if (state.resolvedCount !== 3) return invalid(state, 'not-resolved');
      const carried = state.room.slice(state.resolvedCount);
      const prepared: GameState = { ...state, ranAwayLastRoom: false };
      const next = dealNextRoom(prepared, carried);
      return { state: next, result: { type: 'RoomDealt', cards: next.room, carriedFrom: carried } };
    }

    default:
      return invalid(state, 'unknown-action');
  }
}

// ---------------------------------------------------------------------------
// UI-facing pure queries (still zero React; used for previews and gating)
// ---------------------------------------------------------------------------

/** Damage a fight would deal. */
export function fightDamage(state: GameState, cardId: CardId, barehanded: boolean): number {
  const monsterValue = cardValue(cardId);
  if (barehanded || state.weapon === null) return monsterValue;
  return Math.max(0, monsterValue - cardValue(state.weapon as CardId));
}

/** Whether fighting this monster with the equipped weapon is legal. */
export function canFightWithWeapon(state: GameState, cardId: CardId): boolean {
  if (state.weapon === null) return false;
  if (!state.config.weaponDegradation || state.killStack.length === 0) return true;
  const lastKill = cardValue(state.killStack[state.killStack.length - 1]);
  return cardValue(cardId) < lastKill;
}

export type RunAwayBlockReason = 'twice-in-row' | 'no-cards' | 'room-started';

export function canRunAway(state: GameState): { can: boolean; reason?: RunAwayBlockReason } {
  if (state.phase !== 'playing') return { can: false };
  if (state.resolvedCount !== 0) return { can: false, reason: 'room-started' };
  if (state.config.runAwayMode === 'once' && state.ranAwayLastRoom) {
    return { can: false, reason: 'twice-in-row' };
  }
  if (state.dungeon.length < 4) return { can: false, reason: 'no-cards' };
  return { can: true };
}

export function canEnterNextRoom(state: GameState): boolean {
  return state.phase === 'playing' && !isFinalRoom(state) && state.resolvedCount === 3;
}

export function canUndo(state: GameState): boolean {
  return state.phase === 'playing' && state.roomSnapshot !== null;
}

/** Final score: remaining HP on a win, 0 minus remaining monster values on a loss. */
export function finalScore(state: GameState): number {
  if (state.phase === 'won') return state.hp;
  let sum = 0;
  for (const id of state.dungeon) {
    if (isMonster(id)) sum += cardValue(id);
  }
  return -sum;
}
