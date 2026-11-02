import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  createRoomSnapshot,
  getLegalActions,
  type ActionResult,
  type CardId,
  type GameState,
} from './index';
import { makeState, roomOf, weaponOf } from './state-fixtures';

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

function withUndo(state: GameState): GameState {
  return { ...state, undo: createRoomSnapshot(state) };
}

function resolveBarehanded(state: GameState, card: CardId): GameState {
  return expectOk(applyAction(state, { type: 'resolveCard', card, attack: 'barehanded' })).state;
}

const highlights = (overrides: Partial<GameState['highlights']> = {}) => ({
  monstersDefeated: 0,
  potionsWasted: 0,
  roomsExplored: 1,
  roomsCleared: 0,
  ...overrides,
});

describe('undo restores the room-start state', () => {
  it('restores every field listed in REQ-008', () => {
    const start = withUndo(
      makeState({
        room: roomOf(['club-3', 'heart-5', 'diamond-6', 'club-2']),
        dungeon: ['club-a', 'spade-2', 'diamond-9', 'heart-3'],
        health: 18,
        weapon: weaponOf('diamond-2', ['club-4']),
        highlights: highlights({ monstersDefeated: 1 }),
      }),
    );

    let state = expectOk(
      applyAction(start, { type: 'resolveCard', card: 'club-3', attack: 'weapon' }),
    ).state;
    state = expectOk(applyAction(state, { type: 'resolveCard', card: 'heart-5' })).state;
    state = expectOk(applyAction(state, { type: 'resolveCard', card: 'diamond-6' })).state;

    expect(state).not.toEqual(start);
    expect(state.health).toBe(20);
    expect(state.weapon?.card).toBe('diamond-6');
    expect(state.potionUsedThisRoom).toBe(true);
    expect(state.highlights.monstersDefeated).toBe(2);

    const undone = expectOk(applyAction(state, { type: 'undoRoom' })).state;

    expect(undone).toEqual(start);
    expect(undone.health).toBe(18);
    expect(undone.weapon).toEqual(weaponOf('diamond-2', ['club-4']));
    expect(undone.room.cards.map((roomCard) => roomCard.card)).toEqual([
      'club-3',
      'heart-5',
      'diamond-6',
      'club-2',
    ]);
    expect(undone.dungeon).toEqual(['club-a', 'spade-2', 'diamond-9', 'heart-3']);
    expect(undone.potionUsedThisRoom).toBe(false);
    expect(undone.highlights).toEqual(highlights({ monstersDefeated: 1 }));
    expect(undone.resolvedThisRoom).toBe(0);
    expect(undone.roomCleared).toBe(false);
  });

  it('survives a JSON round trip so a resumed run can still undo', () => {
    const start = createInitialState('undo-resume-seed');
    const firstCard = getLegalActions(start).find((action) => action.type === 'resolveCard');
    expect(firstCard).toBeDefined();
    if (!firstCard || firstCard.type !== 'resolveCard') return;

    const played = expectOk(applyAction(start, firstCard)).state;
    const resumed = JSON.parse(JSON.stringify(played)) as GameState;
    const undone = expectOk(applyAction(resumed, { type: 'undoRoom' })).state;

    expect(undone).toEqual(start);
  });

  it('restores the same room rather than dealing another dungeon', () => {
    const start = createInitialState('undo-room-seed');
    const firstCard = getLegalActions(start).find((action) => action.type === 'resolveCard');
    expect(firstCard).toBeDefined();
    if (!firstCard || firstCard.type !== 'resolveCard') return;

    const played = expectOk(applyAction(start, firstCard)).state;
    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;

    expect(undone.room).toEqual(start.room);
    expect(undone.dungeon).toEqual(start.dungeon);
    expect(undone.seed).toBe(start.seed);
    expect(undone.config).toBe(start.config);
  });

  it('restores the potion allowance so the potion can be drunk again', () => {
    const start = withUndo(
      makeState({
        health: 10,
        room: roomOf(['heart-5', 'club-2', 'club-3', 'club-4']),
      }),
    );
    const played = expectOk(applyAction(start, { type: 'resolveCard', card: 'heart-5' })).state;
    expect(played.health).toBe(15);
    expect(played.potionUsedThisRoom).toBe(true);

    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;
    expect(undone.potionUsedThisRoom).toBe(false);
    expect(undone.health).toBe(10);

    const replayed = expectOk(applyAction(undone, { type: 'resolveCard', card: 'heart-5' })).state;
    expect(replayed.health).toBe(15);
  });
});

describe('undo and escape eligibility', () => {
  it('makes escape available again when the room was entered legally', () => {
    const start = withUndo(
      makeState({ room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']), dungeon: ['heart-3'] }),
    );
    const played = resolveBarehanded(start, 'club-2');
    expectRejected(applyAction(played, { type: 'runAway' }), 'escape-after-resolution');

    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;
    expect(undone.resolvedThisRoom).toBe(0);
    expect(applyAction(undone, { type: 'runAway' }).ok).toBe(true);
  });

  it('keeps escape blocked for a room entered after an escape under default rules', () => {
    const start = withUndo(
      makeState({
        room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
        dungeon: ['heart-3'],
        escapedLastRoom: true,
      }),
    );
    const played = resolveBarehanded(start, 'club-2');
    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;

    expect(undone.escapedLastRoom).toBe(true);
    expectRejected(applyAction(undone, { type: 'runAway' }), 'escape-consecutive-blocked');
  });

  it('keeps the final-room escape prohibition after undo', () => {
    const start = withUndo(
      makeState({
        room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
        dungeon: [],
        finalRoom: true,
      }),
    );
    const played = resolveBarehanded(start, 'club-2');
    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;

    expectRejected(applyAction(undone, { type: 'runAway' }), 'escape-final-room');
  });
});

describe('undo does not inflate highlights', () => {
  const start = withUndo(
    makeState({
      health: 20,
      room: roomOf(['club-2', 'heart-5', 'club-3', 'club-4']),
    }),
  );

  it('restores rooms cleared and re-clearing adds it exactly once', () => {
    let cleared = start;
    cleared = resolveBarehanded(cleared, 'club-2');
    cleared = expectOk(applyAction(cleared, { type: 'resolveCard', card: 'heart-5' })).state;
    cleared = resolveBarehanded(cleared, 'club-3');
    expect(cleared.roomCleared).toBe(true);
    expect(cleared.highlights.roomsCleared).toBe(1);

    const undone = expectOk(applyAction(cleared, { type: 'undoRoom' })).state;
    expect(undone.highlights.roomsCleared).toBe(0);

    let replayed = undone;
    replayed = resolveBarehanded(replayed, 'club-2');
    replayed = expectOk(applyAction(replayed, { type: 'resolveCard', card: 'heart-5' })).state;
    replayed = resolveBarehanded(replayed, 'club-3');

    expect(replayed.highlights.roomsCleared).toBe(1);
    expect(replayed.highlights.monstersDefeated).toBe(2);
    expect(replayed.highlights.potionsWasted).toBe(0);
  });

  it('does not inflate counts across repeated resolve/undo cycles', () => {
    const played = resolveBarehanded(start, 'club-2');
    const undone = expectOk(applyAction(played, { type: 'undoRoom' })).state;
    const replayed = resolveBarehanded(undone, 'club-2');
    expect(replayed.highlights).toEqual(played.highlights);
    expect(replayed.health).toBe(played.health);
  });

  it('restores a wasted-potion count instead of accumulating it', () => {
    const fullHealth = withUndo(
      makeState({ health: 20, room: roomOf(['heart-5', 'club-2', 'club-3', 'club-4']) }),
    );
    const wasted = expectOk(
      applyAction(fullHealth, { type: 'resolveCard', card: 'heart-5' }),
    ).state;
    expect(wasted.highlights.potionsWasted).toBe(1);

    const undone = expectOk(applyAction(wasted, { type: 'undoRoom' })).state;
    expect(undone.highlights.potionsWasted).toBe(0);

    const replayed = expectOk(applyAction(undone, { type: 'resolveCard', card: 'heart-5' })).state;
    expect(replayed.highlights.potionsWasted).toBe(1);
  });
});

describe('undo availability', () => {
  it('is unavailable at room start and after entering the next room', () => {
    const initial = createInitialState('undo-availability-seed');
    expectRejected(applyAction(initial, { type: 'undoRoom' }), 'undo-unavailable');

    const cleared = makeState({
      room: roomOf(['club-2']),
      roomCleared: true,
      resolvedThisRoom: 3,
      dungeon: ['diamond-4', 'heart-3', 'spade-6'],
    });
    const entered = expectOk(applyAction(cleared, { type: 'enterNextRoom' })).state;
    expectRejected(applyAction(entered, { type: 'undoRoom' }), 'undo-unavailable');
  });

  it('is rejected after a win', () => {
    const start = withUndo(makeState({ finalRoom: true, dungeon: [], room: roomOf(['club-2']) }));
    const won = expectOk(
      applyAction(start, { type: 'resolveCard', card: 'club-2', attack: 'barehanded' }),
    ).state;

    expect(won.status).toBe('won');
    expectRejected(applyAction(won, { type: 'undoRoom' }), 'run-over');
  });

  it('is rejected after a loss', () => {
    const start = withUndo(
      makeState({ health: 1, room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']) }),
    );
    const lost = resolveBarehanded(start, 'club-2');

    expect(lost.status).toBe('lost');
    expectRejected(applyAction(lost, { type: 'undoRoom' }), 'run-over');
  });

  it('leaves the state untouched when rejected', () => {
    const initial = createInitialState('undo-rejected-seed');
    const result = applyAction(initial, { type: 'undoRoom' });

    expect(result.ok).toBe(false);
    expect(result.state).toBe(initial);
  });
});
