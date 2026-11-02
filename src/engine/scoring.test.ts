import { describe, expect, it } from 'vitest';
import {
  applyAction,
  calculateLossScore,
  getLegalActions,
  sumMonsterValues,
  type ActionResult,
  type GameState,
} from './index';
import { makeState, roomOf } from './state-fixtures';

function expectOk(result: ActionResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected action to be legal, got ${result.reason}`);
  return result;
}

describe('winning', () => {
  it('scores surviving health and reports the run highlights', () => {
    const state = makeState({
      finalRoom: true,
      dungeon: [],
      health: 20,
      room: roomOf(['club-2']),
    });
    const result = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-2', attack: 'barehanded' }),
    );

    expect(result.state.status).toBe('won');
    expect(result.state.result).toMatchObject({
      outcome: 'won',
      health: 18,
      score: 18,
    });
    expect(result.event).toMatchObject({ roomCleared: true, runOutcome: 'won', score: 18 });
  });

  it('never scores more than the 20 health cap', () => {
    const state = makeState({
      finalRoom: true,
      dungeon: [],
      health: 20,
      room: roomOf(['heart-2']),
    });
    const won = expectOk(applyAction(state, { type: 'resolveCard', card: 'heart-2' })).state;

    expect(won.health).toBe(20);
    expect(won.result?.score).toBe(20);
  });
});

describe('losing', () => {
  it('scores the negative sum of monsters in the draw pile only', () => {
    // 14 + 2 monster points remain face down; the room's monsters are excluded.
    const state = makeState({
      health: 1,
      room: roomOf(['club-k', 'club-a', 'club-3', 'club-4']),
      dungeon: ['club-a', 'diamond-5', 'heart-3', 'spade-2'],
    });
    const result = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-3', attack: 'barehanded' }),
    );

    expect(result.state.status).toBe('lost');
    expect(result.state.result).toEqual({
      outcome: 'lost',
      health: -2,
      score: -16,
      seed: 'fixture-seed',
      config: 0,
      highlights: result.state.highlights,
    });
  });

  it('excludes the carried card and unresolved room cards from the loss score', () => {
    const state = makeState({
      health: 1,
      room: roomOf(['club-k', 'club-3'], ['club-k']),
      dungeon: ['spade-2'],
    });
    const lost = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-3', attack: 'barehanded' }),
    ).state;

    // Room monsters (club-k) and the carried card are excluded; only spade-2 counts.
    expect(lost.result?.score).toBe(-2);
  });

  it('scores 0 but still loses when no monsters remain in the draw pile', () => {
    const state = makeState({
      health: 1,
      room: roomOf(['club-3', 'club-4', 'club-5', 'diamond-2']),
      dungeon: ['diamond-5', 'heart-3'],
    });
    const lost = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-3', attack: 'barehanded' }),
    ).state;

    expect(lost.status).toBe('lost');
    expect(lost.result).toMatchObject({ outcome: 'lost', score: 0 });
  });

  it('matches the reusable loss-score formula at the moment of death', () => {
    const state = makeState({
      health: 1,
      room: roomOf(['club-3', 'club-4', 'club-5', 'diamond-2']),
      dungeon: ['club-a', 'heart-2', 'spade-10'],
    });
    const expected = calculateLossScore(state.dungeon);
    const lost = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-3', attack: 'barehanded' }),
    ).state;

    expect(lost.result?.score).toBe(expected);
    expect(expected).toBe(-24);
  });
});

describe('death precedence', () => {
  it('loses when the last card of the final room kills the player, not wins', () => {
    const state = makeState({
      health: 3,
      finalRoom: true,
      dungeon: [],
      room: roomOf(['club-5']),
    });
    const result = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'club-5', attack: 'barehanded' }),
    );

    expect(result.state.status).toBe('lost');
    expect(result.state.room.cards).toHaveLength(0);
    expect(result.state.result).toMatchObject({ outcome: 'lost', score: 0 });
    expect(result.state.highlights.roomsCleared).toBe(0);
    expect(result.event).toMatchObject({ roomCleared: false, runOutcome: 'lost' });
  });

  it('explores but does not clear a normal room where the player dies', () => {
    const state = makeState({
      health: 5,
      room: roomOf(['diamond-9', 'club-2', 'club-8', 'club-3']),
      dungeon: ['club-4', 'heart-2'],
    });

    let current: GameState = expectOk(
      applyAction(state, { type: 'resolveCard', card: 'diamond-9' }),
    ).state;
    current = expectOk(
      applyAction(current, { type: 'resolveCard', card: 'club-2', attack: 'weapon' }),
    ).state;
    expect(current.status).toBe('playing');
    expect(current.highlights.monstersDefeated).toBe(1);

    // The third required resolution is lethal: the room would have cleared, but
    // death takes precedence (implementation plan phase 2 acceptance).
    current = expectOk(
      applyAction(current, { type: 'resolveCard', card: 'club-8', attack: 'barehanded' }),
    ).state;

    expect(current.status).toBe('lost');
    expect(current.room.cards).toHaveLength(1);
    expect(current.highlights.roomsCleared).toBe(0);
    expect(current.highlights.roomsExplored).toBe(1);
    expect(current.highlights.monstersDefeated).toBe(1);
  });
});

describe('completed runs are final', () => {
  it('offers no legal actions after a win or a loss', () => {
    const win = makeState({ finalRoom: true, dungeon: [], room: roomOf(['club-2']) });
    const won = expectOk(
      applyAction(win, { type: 'resolveCard', card: 'club-2', attack: 'barehanded' }),
    ).state;
    expect(getLegalActions(won)).toEqual([]);

    const loss = makeState({ health: 1, room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']) });
    const lost = expectOk(
      applyAction(loss, { type: 'resolveCard', card: 'club-2', attack: 'barehanded' }),
    ).state;
    expect(getLegalActions(lost)).toEqual([]);
  });
});

describe('scoring helpers', () => {
  it('sums only monster values', () => {
    expect(sumMonsterValues(['club-a', 'heart-5', 'spade-2', 'diamond-10'])).toBe(16);
    expect(sumMonsterValues([])).toBe(0);
    expect(sumMonsterValues(['diamond-5', 'heart-3'])).toBe(0);
  });

  it('returns the negative dungeon monster sum for a loss', () => {
    expect(calculateLossScore(['club-a', 'spade-2', 'heart-3'])).toBe(-16);
    expect(calculateLossScore([])).toBe(0);
    expect(calculateLossScore(['diamond-2', 'heart-10'])).toBe(0);
  });
});
