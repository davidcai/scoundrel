/**
 * Store seam (spec seam 2): selection lives in the store, never GameState;
 * engine is injected (fake, scripted); undo mirrors restored state; terminal
 * results write stats exactly once; run record round-trips.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { StoreApi } from 'zustand';
import type { Action, GameState, Result } from '../engine';
import { loadRun } from '../persistence/run';
import { loadStats } from '../persistence/stats';
import { makeConfig, makeFakeEngine, makeState, FIXTURE_ROOM } from '../test/fixtures';
import { createGameStore, type GameStoreState } from './gameStore';

beforeEach(() => {
  localStorage.clear();
});

function gameOf(store: StoreApi<GameStoreState>): GameState {
  const game = store.getState().game;
  if (game === null) throw new Error('expected an active game');
  return game;
}

function fightResult(cardId: string, damage = 8): Result {
  return {
    type: 'MonsterDefeated',
    cardId: cardId as never,
    damage,
    weaponBroke: false,
  };
}

describe('selection slice', () => {
  it('selection lives in the store, never in GameState', () => {
    const engine = makeFakeEngine();
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());

    const game = gameOf(store);
    expect('selectedCardId' in game).toBe(false);
    expect('selected' in game).toBe(false);

    store.getState().selectCard('club-8');
    expect(store.getState().selected).toEqual({ cardId: 'club-8', barehanded: false });
    // Selecting touched no game truth: same reference, no extra reducer call.
    expect(store.getState().game).toBe(game);
    expect(engine.actions.map((a) => a.type)).toEqual(['StartNewRun']);
  });

  it('ignores selection of cards not in the room', () => {
    const engine = makeFakeEngine();
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('spade-a' as never);
    expect(store.getState().selected).toBeNull();
  });

  it('cancelSelection clears the armed card', () => {
    const store = createGameStore({ engine: makeFakeEngine() });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().cancelSelection();
    expect(store.getState().selected).toBeNull();
  });
});

describe('dispatch wiring', () => {
  it('select → confirm dispatches FightMonster and marks the slot resolved', () => {
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'FightMonster') {
          const room = state.room.filter((id) => id !== action.cardId);
          return {
            state: { ...state, room, resolvedCount: state.resolvedCount + 1, hp: state.hp - 8 },
            result: fightResult(action.cardId),
          };
        }
        if (action.type === 'StartNewRun') {
          const cards = [...FIXTURE_ROOM];
          return { state: { ...state, room: cards }, result: { type: 'RoomDealt', cards } };
        }
        return { state, result: { type: 'InvalidAction', reason: 'no' } };
      },
    });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());

    store.getState().selectCard('club-8');
    store.getState().confirm();

    const fight = engine.actions.find(
      (a): a is Action & { type: 'FightMonster' } => a.type === 'FightMonster',
    );
    expect(fight).toMatchObject({ cardId: 'club-8', barehanded: false });
    expect(store.getState().selected).toBeNull();
    expect(store.getState().lastResult?.type).toBe('MonsterDefeated');
    expect(store.getState().slots.find((s) => s.cardId === 'club-8')?.resolved).toBe(true);
    expect(store.getState().game?.room).not.toContain('club-8');
    expect(store.getState().game?.hp).toBe(12);
  });

  it('a second selectCard on the armed card commits (second click confirms)', () => {
    const fought: Action[] = [];
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'FightMonster') {
          fought.push(action);
          const room = state.room.filter((id) => id !== action.cardId);
          return {
            state: { ...state, room, resolvedCount: state.resolvedCount + 1 },
            result: fightResult(action.cardId),
          };
        }
        if (action.type === 'StartNewRun') {
          const cards = [...FIXTURE_ROOM];
          return { state: { ...state, room: cards }, result: { type: 'RoomDealt', cards } };
        }
        return { state, result: { type: 'InvalidAction', reason: 'no' } };
      },
    });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().selectCard('club-8');
    expect(fought).toHaveLength(1);
  });

  it('DrinkPotion and EquipWeapon dispatch for hearts/diamonds', () => {
    const engine = makeFakeEngine();
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('heart-7');
    store.getState().confirm();
    store.getState().selectCard('diamond-5');
    store.getState().confirm();
    const types = engine.actions.map((a) => a.type);
    expect(types).toContain('DrinkPotion');
    expect(types).toContain('EquipWeapon');
  });

  it('tracks the carried card from RoomDealt', () => {
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'StartNewRun' || action.type === 'DealRoom') {
          const cards = [...FIXTURE_ROOM];
          return {
            state: { ...state, room: cards },
            result: { type: 'RoomDealt', cards, carriedFrom: 'club-8' },
          };
        }
        return { state, result: { type: 'InvalidAction', reason: 'no' } };
      },
    });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    expect(store.getState().carriedCardId).toBe('club-8');
  });
});

describe('undo', () => {
  it('undo restores game state and room slots from the snapshot', () => {
    const roomStart = makeState({ roomSnapshot: null });
    const snapshot = { ...roomStart, roomSnapshot: null } as GameState;
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'StartNewRun') {
          const cards = [...FIXTURE_ROOM];
          return { state: { ...state, room: cards }, result: { type: 'RoomDealt', cards } };
        }
        if (action.type === 'DrinkPotion') {
          const room = state.room.filter((id) => id !== action.cardId);
          return {
            state: {
              ...state,
              room,
              hp: state.hp,
              potionsUsedThisRoom: 1,
              resolvedCount: 1,
              roomSnapshot: snapshot,
            },
            result: { type: 'PotionQuaffed', cardId: action.cardId, healed: 0, wasted: true },
          };
        }
        if (action.type === 'UndoToRoomStart') {
          return { state: snapshot, result: { type: 'UndoDone' } };
        }
        return { state, result: { type: 'InvalidAction', reason: 'no' } };
      },
    });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());

    store.getState().selectCard('heart-7');
    store.getState().confirm();
    expect(store.getState().slots.find((s) => s.cardId === 'heart-7')?.resolved).toBe(true);

    store.getState().undo();
    expect(store.getState().lastResult?.type).toBe('UndoDone');
    expect(store.getState().game).toBe(snapshot);
    expect(store.getState().slots.every((s) => !s.resolved)).toBe(true);
    expect(store.getState().selected).toBeNull();
  });
});

describe('terminal + stats idempotency', () => {
  const lostScript = (state: GameState, action: Action): { state: GameState; result: Result } => {
    if (action.type === 'StartNewRun') {
      const cards = [...FIXTURE_ROOM];
      return { state: { ...state, room: cards }, result: { type: 'RoomDealt', cards } };
    }
    if (action.type === 'FightMonster') {
      return {
        state: { ...state, phase: 'lost', hp: -2, roomSnapshot: null },
        result: { type: 'GameLost', score: -11, seed: state.seed, config: state.config },
      };
    }
    return { state, result: { type: 'InvalidAction', reason: 'no' } };
  };

  it('writes the stats record exactly once and persists outcome inline', () => {
    const engine = makeFakeEngine({ reduce: lostScript });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().confirm();

    expect(store.getState().outcome).toEqual({ phase: 'lost', score: -11 });
    expect(store.getState().statsWritten).toBe(true);
    expect(loadStats().gamesPlayed).toBe(1);
    expect(loadStats().runs[0]).toMatchObject({ seed: 'abc123', outcome: 'lost', score: -11 });

    const record = loadRun();
    if (record === null) throw new Error('expected a saved run');
    expect(record.statsWritten).toBe(true);
    expect(record.outcome).toEqual({ phase: 'lost', score: -11 });
  });

  it('a reloaded terminal run cannot double-count stats', () => {
    const engine = makeFakeEngine({ reduce: lostScript });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().confirm();
    expect(loadStats().gamesPlayed).toBe(1);

    // Reload: fresh store restores the saved terminal run.
    const engine2 = makeFakeEngine({ reduce: lostScript });
    const store2 = createGameStore({ engine: engine2 });
    expect(store2.getState().loadSavedRun()).toBe(true);
    expect(store2.getState().outcome).toEqual({ phase: 'lost', score: -11 });
    expect(store2.getState().statsWritten).toBe(true);

    // Any further terminal result is ignored for stats (flag is set).
    store2.getState().enterNextRoom();
    expect(loadStats().gamesPlayed).toBe(1);
  });

  it('backToTitle clears the run record', () => {
    const engine = makeFakeEngine({ reduce: lostScript });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().confirm();
    expect(loadRun()).not.toBeNull();
    store.getState().backToTitle();
    expect(loadRun()).toBeNull();
    expect(store.getState().game).toBeNull();
  });
});

describe('run persistence round-trip', () => {
  it('restores slots, snapshot, carried marker, and state on a fresh store', () => {
    const engine = makeFakeEngine({
      reduce: (state, action) => {
        if (action.type === 'StartNewRun') {
          const cards = [...FIXTURE_ROOM];
          return {
            state: { ...state, room: cards, roomSnapshot: null },
            result: { type: 'RoomDealt', cards, carriedFrom: 'club-8' },
          };
        }
        if (action.type === 'FightMonster') {
          const room = state.room.filter((id) => id !== action.cardId);
          return {
            state: { ...state, room, resolvedCount: 1, hp: 12, roomSnapshot: makeState() },
            result: fightResult(action.cardId),
          };
        }
        return { state, result: { type: 'InvalidAction', reason: 'no' } };
      },
    });
    const store = createGameStore({ engine });
    store.getState().newRun('abc123', makeConfig());
    store.getState().selectCard('club-8');
    store.getState().confirm();

    const store2 = createGameStore({ engine: makeFakeEngine() });
    expect(store2.getState().loadSavedRun()).toBe(true);

    expect(gameOf(store2).hp).toBe(12);
    expect(gameOf(store2).room).toEqual(['diamond-5', 'heart-7', 'spade-2']);
    expect(store2.getState().slots.find((s) => s.cardId === 'club-8')?.resolved).toBe(true);
    expect(store2.getState().slots).toHaveLength(4);
    expect(store2.getState().carriedCardId).toBe('club-8');
    expect(gameOf(store2).roomSnapshot).not.toBeNull();
  });
});
