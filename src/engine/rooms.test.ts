import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createRoomSnapshot,
  getLegalActions,
  type ActionResult,
  type CardId,
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

function isMonsterCard(card: CardId): boolean {
  return card.startsWith('club') || card.startsWith('spade');
}

function resolve(state: GameState, card: CardId): GameState {
  const action = isMonsterCard(card)
    ? ({ type: 'resolveCard', card, attack: 'barehanded' } as const)
    : ({ type: 'resolveCard', card } as const);
  return expectOk(applyAction(state, action)).state;
}

describe('resolving a normal room', () => {
  const setup = (): GameState => {
    const state = makeState({
      room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
      dungeon: ['diamond-4', 'club-6', 'heart-4'],
    });
    return { ...state, undo: createRoomSnapshot(state) };
  };

  it('requires three resolutions and leaves the fourth card behind', () => {
    let state = setup();
    expect(getLegalActions(state).some((action) => action.type === 'enterNextRoom')).toBe(false);

    state = resolve(state, 'club-5');
    state = resolve(state, 'club-4');
    expect(state.roomCleared).toBe(false);
    expect(state.room.cards).toHaveLength(2);
    expect(state.resolvedThisRoom).toBe(2);

    state = resolve(state, 'club-3');
    expect(state.roomCleared).toBe(true);
    expect(state.room.cards).toHaveLength(1);
    expect(state.resolvedThisRoom).toBe(3);
    expect(state.status).toBe('playing');
    expect(state.highlights.roomsCleared).toBe(1);

    // The carry cannot be resolved in a normal room.
    expectRejected(
      applyAction(state, { type: 'resolveCard', card: 'club-2' }),
      'card-not-resolvable',
    );

    const legal = getLegalActions(state);
    expect(legal.some((action) => action.type === 'enterNextRoom')).toBe(true);
    expect(legal.some((action) => action.type === 'undoRoom')).toBe(true);
  });

  it('does not deal the next room until the player enters it', () => {
    let state = setup();
    state = resolve(state, 'club-5');
    state = resolve(state, 'club-4');
    state = resolve(state, 'club-3');

    expect(state.dungeon).toEqual(['diamond-4', 'club-6', 'heart-4']);
    expect(state.highlights.roomsExplored).toBe(1);

    const entered = expectOk(applyAction(state, { type: 'enterNextRoom' }));
    expect(entered.event).toMatchObject({
      type: 'enterNextRoom',
      carriedCard: 'club-2',
      dealtCards: ['diamond-4', 'club-6', 'heart-4'],
      finalRoom: true,
    });
    expect(entered.state.room.cards.map((roomCard) => roomCard.card)).toEqual([
      'club-2',
      'diamond-4',
      'club-6',
      'heart-4',
    ]);
  });

  it('rejects entering the next room before three resolutions', () => {
    expectRejected(applyAction(setup(), { type: 'enterNextRoom' }), 'room-not-cleared');

    let state = resolve(setup(), 'club-5');
    expectRejected(applyAction(state, { type: 'enterNextRoom' }), 'room-not-cleared');
    state = resolve(state, 'club-4');
    expectRejected(applyAction(state, { type: 'enterNextRoom' }), 'room-not-cleared');
  });

  it('marks the carried card and resets room-scoped state on entry', () => {
    const cleared: GameState = {
      ...setupCompletedRoom(),
      health: 12,
      potionUsedThisRoom: true,
    };
    const entered = expectOk(applyAction(cleared, { type: 'enterNextRoom' })).state;

    expect(entered.potionUsedThisRoom).toBe(false);
    expect(entered.resolvedThisRoom).toBe(0);
    expect(entered.roomCleared).toBe(false);
    expect(entered.escapedLastRoom).toBe(false);
    expect(entered.room.cards).toHaveLength(4);
    expect(entered.room.cards[0]).toEqual({ card: 'club-2', carried: true });
    for (const roomCard of entered.room.cards.slice(1)) {
      expect(roomCard.carried).toBe(false);
    }
    expect(entered.highlights.roomsExplored).toBe(2);
  });
});

function setupCompletedRoom(): GameState {
  return makeState({
    room: roomOf(['club-2']),
    roomCleared: true,
    resolvedThisRoom: 3,
    dungeon: ['diamond-4', 'club-6', 'heart-4'],
    highlights: {
      monstersDefeated: 2,
      potionsWasted: 0,
      roomsExplored: 1,
      roomsCleared: 1,
    },
  });
}

describe('final rooms', () => {
  it.each([1, 2, 3, 4])('resolves a final room of %i card(s) and wins', (size) => {
    const cards: CardId[] = (['club-2', 'club-3', 'club-4', 'spade-2'] as const).slice(0, size);
    let state = makeState({
      finalRoom: true,
      dungeon: [],
      health: 20,
      room: roomOf(cards),
    });

    expect(state.status).toBe('playing');
    for (const card of cards) {
      state = resolve(state, card);
      if (state.status === 'playing') {
        expect(getLegalActions(state).some((action) => action.type === 'enterNextRoom')).toBe(
          false,
        );
      }
    }

    expect(state.status).toBe('won');
    expect(state.room.cards).toHaveLength(0);
    expect(state.result).toEqual({
      outcome: 'won',
      health: state.health,
      score: state.health,
      seed: 'fixture-seed',
      config: 0,
      highlights: state.highlights,
    });
    expect(state.highlights.roomsCleared).toBe(1);
  });

  it('reaches a final room when dealing empties the draw pile', () => {
    const cleared = makeState({
      room: roomOf(['club-2']),
      roomCleared: true,
      resolvedThisRoom: 3,
      dungeon: [],
      highlights: {
        monstersDefeated: 2,
        potionsWasted: 0,
        roomsExplored: 1,
        roomsCleared: 1,
      },
    });

    const entered = expectOk(applyAction(cleared, { type: 'enterNextRoom' }));

    expect(entered.event).toMatchObject({ carriedCard: 'club-2', dealtCards: [], finalRoom: true });
    expect(entered.state.finalRoom).toBe(true);
    expect(entered.state.dungeon).toHaveLength(0);
    expect(entered.state.room.cards).toHaveLength(1);
    expect(entered.state.status).toBe('playing');
  });

  it('does not win just because the dungeon is empty', () => {
    const state = makeState({
      finalRoom: true,
      dungeon: [],
      room: roomOf(['club-2', 'club-3']),
    });

    expect(state.status).toBe('playing');
    expect(state.result).toBeNull();
    expect(state.room.cards).toHaveLength(2);
  });
});
