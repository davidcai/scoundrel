import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  previewAction,
  previewCardResolution,
  previewMonster,
  type ActionResult,
  type GameState,
} from './index';
import { makeState, roomOf } from './state-fixtures';

function expectOk(result: ActionResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected action to be legal, got ${result.reason}`);
  return result;
}

function expectRejected(result: ActionResult, reason: string) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected action to be rejected');
  expect(result.reason).toBe(reason);
}

function escapeReadyState(overrides: Partial<GameState> = {}): GameState {
  return makeState({
    room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
    dungeon: ['diamond-4', 'heart-3', 'spade-6', 'club-7', 'club-8'],
    ...overrides,
  });
}

describe('running away', () => {
  it('is legal at room start and returns all four cards to the dungeon bottom in room order', () => {
    const state = escapeReadyState();
    const result = expectOk(applyAction(state, { type: 'runAway' }));

    expect(result.event).toMatchObject({
      type: 'runAway',
      returnedCards: ['club-2', 'club-3', 'club-4', 'club-5'],
      dealtCards: ['diamond-4', 'heart-3', 'spade-6', 'club-7'],
      finalRoom: false,
    });

    // The returned block sits at the bottom of the dungeon, leftmost card first.
    expect(result.state.dungeon).toEqual(['club-8', 'club-2', 'club-3', 'club-4', 'club-5']);
    expect(result.state.dungeon.slice(-4)).toEqual(['club-2', 'club-3', 'club-4', 'club-5']);

    expect(result.state.room.cards).toHaveLength(4);
    expect(result.state.room.cards.every((roomCard) => !roomCard.carried)).toBe(true);
    expect(result.state.escapedLastRoom).toBe(true);
    expect(result.state.resolvedThisRoom).toBe(0);
    expect(result.state.roomCleared).toBe(false);
    expect(result.state.highlights.roomsExplored).toBe(2);
    expect(result.state.highlights.roomsCleared).toBe(0);
  });

  it('deals the returned block back in left-to-right order when it reaches the top', () => {
    const state = makeState({
      room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
      dungeon: ['heart-3'],
    });
    const escaped = expectOk(applyAction(state, { type: 'runAway' })).state;

    // heart-3 was dealt first, then the returned block in order; club-5 is now
    // the top card of the dungeon, so the next room leads with it.
    expect(escaped.room.cards.map((roomCard) => roomCard.card)).toEqual([
      'heart-3',
      'club-2',
      'club-3',
      'club-4',
    ]);
    expect(escaped.dungeon).toEqual(['club-5']);
  });

  it('is allowed after previews alone, because previewing is not resolving', () => {
    const state = escapeReadyState();
    previewCardResolution(state, 'club-3', 'barehanded');
    previewMonster(state, 'club-3');
    previewAction(state, { type: 'resolveCard', card: 'club-3', attack: 'barehanded' });

    expect(getLegalActions(state).some((action) => action.type === 'runAway')).toBe(true);
    expect(applyAction(state, { type: 'runAway' }).ok).toBe(true);
  });

  it('is blocked after the first card is resolved under either consecutive-escape option', () => {
    for (const config of [0, 1] as const) {
      const state = escapeReadyState({ config });
      const resolved = expectOk(
        applyAction(state, { type: 'resolveCard', card: 'club-2', attack: 'barehanded' }),
      ).state;

      expectRejected(applyAction(resolved, { type: 'runAway' }), 'escape-after-resolution');
      expect(getLegalActions(resolved).some((action) => action.type === 'runAway')).toBe(false);
    }
  });

  it('is blocked in consecutive rooms by default', () => {
    const escaped = expectOk(applyAction(escapeReadyState(), { type: 'runAway' })).state;

    expect(escaped.escapedLastRoom).toBe(true);
    expectRejected(applyAction(escaped, { type: 'runAway' }), 'escape-consecutive-blocked');
  });

  it('allows consecutive escapes when the house rule is on', () => {
    const escaped = expectOk(
      applyAction(escapeReadyState({ config: 1 }), { type: 'runAway' }),
    ).state;

    const second = expectOk(applyAction(escaped, { type: 'runAway' }));
    expect(second.state.highlights.roomsExplored).toBe(3);
  });

  it('allows escaping again once a room has been played and left normally', () => {
    let state = expectOk(applyAction(escapeReadyState(), { type: 'runAway' })).state;
    // Resolve the three required cards of the replacement room.
    const resolvable = state.room.cards.slice(0, 3).map((roomCard) => roomCard.card);
    for (const card of resolvable) {
      const kind = card.startsWith('club') || card.startsWith('spade') ? 'barehanded' : undefined;
      state = expectOk(applyAction(state, { type: 'resolveCard', card, attack: kind })).state;
    }
    expect(state.roomCleared).toBe(true);

    state = expectOk(applyAction(state, { type: 'enterNextRoom' })).state;
    expect(state.escapedLastRoom).toBe(false);
    expect(getLegalActions(state).some((action) => action.type === 'runAway')).toBe(true);
  });

  it('is always blocked in the final room, even when consecutive escapes are allowed', () => {
    for (const config of [0, 1] as const) {
      const state = escapeReadyState({ config, finalRoom: true, dungeon: [] });

      expectRejected(applyAction(state, { type: 'runAway' }), 'escape-final-room');
      expect(getLegalActions(state).some((action) => action.type === 'runAway')).toBe(false);
    }
  });

  it('is rejected once the run is over', () => {
    const state = makeState({
      room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
      status: 'lost',
      result: {
        outcome: 'lost',
        health: -1,
        score: 0,
        seed: 'fixture-seed',
        config: 0,
        highlights: {
          monstersDefeated: 0,
          potionsWasted: 0,
          roomsExplored: 1,
          roomsCleared: 0,
        },
      },
    });

    expectRejected(applyAction(state, { type: 'runAway' }), 'run-over');
  });
});

describe('running away starts a new undo boundary', () => {
  it('cannot undo back into the escaped room', () => {
    const escaped = expectOk(applyAction(escapeReadyState(), { type: 'runAway' })).state;

    expect(escaped.undo).not.toBeNull();
    expectRejected(applyAction(escaped, { type: 'undoRoom' }), 'undo-unavailable');
  });

  it('restores the replacement room start, not the escaped room', () => {
    const escaped = expectOk(applyAction(escapeReadyState(), { type: 'runAway' })).state;
    const firstCard = escaped.room.cards[0].card;
    const attack =
      firstCard.startsWith('club') || firstCard.startsWith('spade') ? 'barehanded' : undefined;
    const afterCard = expectOk(
      applyAction(escaped, { type: 'resolveCard', card: firstCard, attack }),
    ).state;

    const undone = expectOk(applyAction(afterCard, { type: 'undoRoom' })).state;

    expect(undone.room).toEqual(escaped.room);
    expect(undone.health).toBe(escaped.health);
    expect(undone.resolvedThisRoom).toBe(0);
    expect(undone.escapedLastRoom).toBe(true);
    expect(undone.highlights).toEqual(escaped.highlights);
  });
});
