/**
 * The engine surface the store depends on. Matches the frozen contract in
 * src/engine/index.ts; the store receives an EngineApi by injection so tests
 * can drive it with a scripted fake while the real engine lands from the
 * engine-dev lane.
 */
import type { Action, CardId, GameConfig, GameState, Result, RunAwayBlockReason } from '../engine';
import * as realEngine from '../engine';

export interface EngineApi {
  createInitialState: (seed: string, config: GameConfig) => GameState;
  reduce: (state: GameState, action: Action) => { state: GameState; result: Result };
  canRunAway: (state: GameState) => { allowed: boolean; reason?: RunAwayBlockReason };
  previewFightMonster: (
    state: GameState,
    cardId: CardId,
    barehanded: boolean,
  ) => { legal: boolean; damage: number; reason?: string };
}

/** Indirection keeps the binding lazy — the stub only throws when called. */
export const defaultEngine: EngineApi = {
  createInitialState: (seed, config) => realEngine.createInitialState(seed, config),
  reduce: (state, action) => realEngine.reduce(state, action),
  canRunAway: (state) => realEngine.canRunAway(state),
  previewFightMonster: (state, cardId, barehanded) =>
    realEngine.previewFightMonster(state, cardId, barehanded),
};
