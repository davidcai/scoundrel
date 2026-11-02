/**
 * Deterministic rules-engine states for the Phase 4 store tests.
 *
 * These helpers stay rules-engine-only: they replay the recorded winning line
 * from the Phase 3 fixture and search simple seeds for a lost run, so store
 * tests do not depend on interface rendering.
 */
import {
  DEFAULT_RULE_CONFIG,
  applyAction,
  cardValue,
  createInitialState,
  getLegalActions,
  isMonster,
  type CardId,
  type GameAction,
  type GameState,
} from '../../src/engine';
import { WINNING_RUN } from '../fixtures/winning-run';
import type { UiStep } from './game';

export type WinningStep = (typeof WINNING_RUN.steps)[number];

export function applyWinningStep(state: GameState, step: WinningStep): GameState {
  const action: GameAction =
    step.kind === 'resolve'
      ? {
          type: 'resolveCard',
          card: step.card,
          ...(step.attack === undefined ? {} : { attack: step.attack }),
        }
      : step.kind === 'enterNextRoom'
        ? { type: 'enterNextRoom' }
        : { type: 'runAway' };
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(`Recorded winning step rejected: ${result.reason} (${step.kind})`);
  }
  return result.state;
}

/** Replay the recorded winning run up to `stepCount` steps (all by default). */
export function replayWinningRun(stepCount: number = WINNING_RUN.steps.length): GameState {
  let state = createInitialState(WINNING_RUN.seed, DEFAULT_RULE_CONFIG);
  for (const step of WINNING_RUN.steps.slice(0, stepCount)) {
    state = applyWinningStep(state, step);
  }
  return state;
}

/** The final won state for the recorded winning run. */
export function winningState(): GameState {
  const state = replayWinningRun();
  if (state.status !== 'won' || state.result === null) {
    throw new Error(`Expected a won fixture run, got ${state.status}`);
  }
  return state;
}

/** A playing state that carries an undo snapshot (after the first Enter Next Room). */
export function stateWithUndo(): GameState {
  for (let count = 1; count <= WINNING_RUN.steps.length; count += 1) {
    const state = replayWinningRun(count);
    if (state.undo !== null && state.status === 'playing') return state;
  }
  throw new Error('Recorded winning run never offered an undo snapshot');
}

function greedyPlay(seed: string): GameState {
  let state = createInitialState(seed, DEFAULT_RULE_CONFIG);
  for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
    const actions = getLegalActions(state);
    if (actions.length === 0) break;
    const action: GameAction =
      actions.find((candidate) => candidate.type === 'resolveCard') ??
      actions.find((candidate) => candidate.type === 'enterNextRoom') ??
      actions.find((candidate) => candidate.type === 'runAway') ??
      actions[0];
    const result = applyAction(state, action);
    if (!result.ok) break;
    state = result.state;
  }
  return state;
}

/** Search simple seeds for a run the greedy policy loses. */
export function findLostState(maxSeeds = 400): GameState {
  for (let index = 0; index < maxSeeds; index += 1) {
    const state = greedyPlay(`loss-search-${index}`);
    if (state.status === 'lost' && state.result !== null) return state;
  }
  throw new Error('No lost run found for the greedy policy');
}

/** A valid playing state whose remaining draw pile has no monsters. */
export function noMonsterDungeonState(): GameState {
  const initial = createInitialState(WINNING_RUN.seed, DEFAULT_RULE_CONFIG);
  return { ...initial, dungeon: [] };
}

function findSubset(cards: readonly CardId[], target: number): CardId[] | null {
  const memo = new Map<string, CardId[] | null>();
  function search(index: number, remaining: number): CardId[] | null {
    if (remaining === 0) return [];
    if (remaining < 0 || index >= cards.length) return null;
    const key = `${String(index)}:${String(remaining)}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    const card = cards[index];
    const take = search(index + 1, remaining - cardValue(card));
    const subset = take === null ? search(index + 1, remaining) : [card, ...take];
    memo.set(key, subset);
    return subset;
  }
  return search(0, target);
}

/**
 * A valid playing state whose draw pile holds monsters totalling `monsterScore`
 * and nothing else. Used to exercise the abandonment loss-score helper.
 */
export function abandonmentState(monsterScore: number): {
  state: GameState;
  expectedScore: number;
} {
  const seeds = [
    WINNING_RUN.seed,
    ...Array.from({ length: 100 }, (_value, index) => `dungeon-score-${index}`),
  ];
  for (const seed of seeds) {
    const initial = createInitialState(seed, DEFAULT_RULE_CONFIG);
    const monsters = initial.dungeon.filter((card) => isMonster(card));
    const subset = findSubset(monsters, monsterScore);
    if (subset !== null) {
      return { state: { ...initial, dungeon: subset }, expectedScore: -monsterScore };
    }
  }
  throw new Error(`No draw pile totalling ${String(monsterScore)} monster points`);
}

/** A copy of a state with a different remaining draw pile. */
export function withDungeon(state: GameState, dungeon: readonly CardId[]): GameState {
  return { ...state, dungeon };
}

/** Steps shape used by the fixture; kept for callers typing custom lines. */
export type { UiStep };
