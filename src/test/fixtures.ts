/**
 * Engine-independent test harness: hand-built GameState fixtures and a
 * scripted fake EngineApi so every UI/store test runs WITHOUT the real
 * engine (which is a throwing stub in this lane).
 */
import type { Action, CardId, GameConfig, GameState, Result, RunAwayBlockReason } from '../engine';
import type { EngineApi } from '../store/engineApi';

export const FIXTURE_ROOM: readonly CardId[] = ['club-8', 'diamond-5', 'heart-7', 'spade-2'];

export function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true, ...overrides };
}

/** A mid-run, mid-room state; nothing resolved yet, full HP. */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'test00',
    config: makeConfig(),
    phase: 'playing',
    hp: 20,
    maxHp: 20,
    dungeon: ['club-2', 'club-3', 'heart-4', 'spade-8', 'diamond-6', 'club-9', 'heart-5'],
    room: [...FIXTURE_ROOM],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 1,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
    // Engine-owned; always 0 per the clarified contract (persistence stamps savedAt).
    startedAt: 0,
    roomSnapshot: null,
    ...overrides,
  };
}

export interface FakeEngine extends EngineApi {
  actions: Action[];
}

interface FakeEngineOverrides {
  createInitialState?: (seed: string, config: GameConfig) => GameState;
  reduce?: (state: GameState, action: Action) => { state: GameState; result: Result };
  canRunAway?: (state: GameState) => { allowed: boolean; reason?: RunAwayBlockReason };
  previewFightMonster?: (
    state: GameState,
    cardId: CardId,
    barehanded: boolean,
  ) => { legal: boolean; damage: number; reason?: string };
}

/**
 * Scripted fake. Defaults: createInitialState returns an empty-room fixture;
 * DealRoom deals FIXTURE_ROOM; every other action records and returns
 * InvalidAction('unscripted'). Override `reduce` for richer scripts — wrap
 * `defaultReduce` if you still want action recording.
 */
export function makeFakeEngine(overrides: FakeEngineOverrides = {}): FakeEngine {
  const actions: Action[] = [];

  const defaultReduce = (
    state: GameState,
    action: Action,
  ): { state: GameState; result: Result } => {
    // Contract: StartNewRun deals the first room and returns RoomDealt.
    if (action.type === 'StartNewRun' || action.type === 'DealRoom') {
      const cards = [...FIXTURE_ROOM];
      const carriedFrom = action.type === 'DealRoom' ? 'club-8' : undefined;
      return {
        state: { ...state, room: cards },
        result: { type: 'RoomDealt', cards, ...(carriedFrom !== undefined ? { carriedFrom } : {}) },
      };
    }
    return { state, result: { type: 'InvalidAction', reason: 'unscripted' } };
  };

  return {
    actions,
    createInitialState:
      overrides.createInitialState ??
      ((seed, config) => makeState({ seed, config, room: [], roomSnapshot: null })),
    reduce: (state, action) => {
      actions.push(action);
      return (overrides.reduce ?? defaultReduce)(state, action);
    },
    canRunAway: overrides.canRunAway ?? (() => ({ allowed: true })),
    previewFightMonster:
      overrides.previewFightMonster ??
      ((_state, _cardId, barehanded) => ({
        legal: true,
        damage: barehanded ? 8 : 3,
      })),
  };
}

/** Convenience: the store's slot rows for a fixture room. */
export function slotsFor(cards: readonly CardId[], resolved: readonly CardId[] = []) {
  return cards.map((cardId) => ({ cardId, resolved: resolved.includes(cardId) }));
}
