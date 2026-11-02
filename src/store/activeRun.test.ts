import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  createInitialState,
  type CardId,
  type GameState,
  type RuleConfig,
} from '../engine';
import {
  createPersistedRun,
  isGameState,
  isPersistedRun,
  isRunInProgress,
  type PersistedRun,
} from './activeRun';
import {
  findLostState,
  replayWinningRun,
  stateWithUndo,
  winningState,
} from '../../tests/helpers/storeRuns';

const STARTED_AT = '2026-10-31T12:00:00.000Z';
const UPDATED_AT = '2026-10-31T12:05:00.000Z';

function asCard(value: string): CardId {
  return value as CardId;
}

function initial(): GameState {
  return createInitialState('plain-257', DEFAULT_RULE_CONFIG);
}

function playingPayload(): PersistedRun {
  return createPersistedRun('run-1', initial(), STARTED_AT, STARTED_AT);
}

function completedPayload(): PersistedRun {
  return createPersistedRun('run-2', winningState(), STARTED_AT, UPDATED_AT);
}

function tamper(state: GameState, changes: Partial<GameState>): unknown {
  return { ...state, ...changes };
}

function withWeaponState(): GameState {
  for (let count = 1; count <= 30; count += 1) {
    const state = replayWinningRun(count);
    if (state.weapon !== null && state.status === 'playing') return state;
  }
  throw new Error('No recorded state with a weapon');
}

describe('createPersistedRun', () => {
  it('wraps a playing state without final fields', () => {
    const payload = playingPayload();
    expect(payload).toMatchObject({
      runId: 'run-1',
      seed: 'plain-257',
      config: 0,
      startedAt: STARTED_AT,
      updatedAt: STARTED_AT,
      completedAt: null,
      outcomeRecorded: false,
    });
    expect(isPersistedRun(payload)).toBe(true);
  });

  it('marks a completed state with the same completion timestamp', () => {
    const payload = completedPayload();
    expect(payload.completedAt).toBe(UPDATED_AT);
    expect(payload.outcomeRecorded).toBe(false);
    expect(payload.state.result?.outcome).toBe('won');
    expect(isPersistedRun(payload)).toBe(true);
    expect(isPersistedRun({ ...payload, outcomeRecorded: true })).toBe(true);
  });

  it('accepts a lost completed state', () => {
    const payload = createPersistedRun('run-3', findLostState(), STARTED_AT, UPDATED_AT);
    expect(payload.state.status).toBe('lost');
    expect(isPersistedRun(payload)).toBe(true);
  });
});

describe('isPersistedRun', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a missing run id', { ...playingPayload(), runId: undefined }],
    ['an empty run id', { ...playingPayload(), runId: '' }],
    ['a whitespace seed', { ...playingPayload(), seed: ' ' }],
    ['an unnormalized seed', { ...playingPayload(), seed: ' plain-257' }],
    ['an invalid config', { ...playingPayload(), config: 8 as RuleConfig }],
    ['a non-ISO start time', { ...playingPayload(), startedAt: 'yesterday' }],
    ['a non-canonical start time', { ...playingPayload(), startedAt: '2026-10-31T12:00:00+00:00' }],
    ['an update before the start', { ...playingPayload(), updatedAt: '2026-10-31T11:00:00.000Z' }],
    ['a playing state with a completion time', { ...playingPayload(), completedAt: STARTED_AT }],
    ['a playing state already recorded', { ...playingPayload(), outcomeRecorded: true }],
    ['a completed state without a completion time', { ...completedPayload(), completedAt: null }],
    [
      'a completion before the start',
      { ...completedPayload(), completedAt: '2026-10-31T11:00:00.000Z' },
    ],
    ['a mismatched payload seed', { ...completedPayload(), seed: 'other' }],
    ['a non-boolean recorded flag', { ...playingPayload(), outcomeRecorded: 'yes' }],
  ])('rejects %s', (_label, value) => {
    expect(isPersistedRun(value)).toBe(false);
  });

  it('rejects a state that is not a valid engine state', () => {
    const payload = playingPayload();
    expect(isPersistedRun({ ...payload, state: { ...payload.state, health: 21 } })).toBe(false);
  });
});

describe('isGameState', () => {
  it('accepts initial, mid-run, won, and lost states', () => {
    expect(isGameState(initial())).toBe(true);
    expect(isGameState(stateWithUndo())).toBe(true);
    expect(isGameState(winningState())).toBe(true);
    expect(isGameState(findLostState())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a non-object', 'state'],
    ['health above the maximum', tamper(initial(), { health: 21 })],
    ['negative health', tamper(initial(), { health: -1 })],
    ['an unknown seed', tamper(initial(), { seed: '' })],
    ['an invalid config', tamper(initial(), { config: 8 as RuleConfig })],
    ['an invalid status', tamper(initial(), { status: 'paused' as GameState['status'] })],
    ['a playing state with a result', tamper(initial(), { result: winningState().result })],
    ['a completed state without a result', tamper(winningState(), { result: null })],
    ['an unknown card id', tamper(initial(), { dungeon: [asCard('club-z')] })],
    [
      'a too-large room',
      tamper(initial(), { room: { cards: [...initial().room.cards, initial().room.cards[0]] } }),
    ],
    [
      'a carried card that is not leftmost',
      tamper(initial(), {
        room: {
          cards: initial().room.cards.map((roomCard, index) => ({
            ...roomCard,
            carried: index === 2,
          })),
        },
      }),
    ],
    [
      'a duplicate card between draw pile and room',
      tamper(initial(), {
        room: {
          cards: initial().room.cards.map((roomCard, index) =>
            index === 0 ? { ...roomCard, card: initial().dungeon[0] ?? roomCard.card } : roomCard,
          ),
        },
      }),
    ],
    ['an oversized resolution count', tamper(initial(), { resolvedThisRoom: 5 })],
    ['a mismatched final outcome', tamper(winningState(), { status: 'lost' })],
    [
      'mismatched final health',
      tamper(winningState(), {
        result: { ...winningState().result!, health: winningState().health + 1 },
      }),
    ],
    [
      'mismatched result highlights',
      tamper(winningState(), {
        result: {
          ...winningState().result!,
          highlights: { ...winningState().result!.highlights, roomsCleared: 99 },
        },
      }),
    ],
    [
      'an invalid undo snapshot',
      tamper(stateWithUndo(), {
        undo: { ...stateWithUndo().undo!, health: 99 },
      }),
    ],
  ])('rejects %s', (_label, value) => {
    expect(isGameState(value)).toBe(false);
  });

  it('rejects a weapon whose value, card, or kill stack is inconsistent', () => {
    const state = withWeaponState();
    const weapon = state.weapon;
    if (weapon === null) throw new Error('expected a weapon');

    expect(isGameState({ ...state, weapon: { ...weapon, value: weapon.value + 1 } })).toBe(false);
    expect(isGameState({ ...state, weapon: { ...weapon, card: asCard('club-a') } })).toBe(false);
    expect(isGameState({ ...state, weapon: { ...weapon, kills: [asCard('diamond-9')] } })).toBe(
      false,
    );
    expect(
      isGameState({
        ...state,
        weapon: { ...weapon, kills: [...weapon.kills, asCard('club-a'), asCard('club-a')] },
      }),
    ).toBe(false);
  });
});

describe('isRunInProgress', () => {
  it('is true only for a playing payload', () => {
    expect(isRunInProgress(playingPayload())).toBe(true);
    expect(isRunInProgress(completedPayload())).toBe(false);
    expect(isRunInProgress(null)).toBe(false);
  });
});
