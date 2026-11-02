import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  getLegalActions,
  previewAction,
  previewCardResolution,
  previewMonster,
  type ActionResult,
  type GameAction,
  type GameState,
  type ActionPreview,
} from './index';
import { makeState, roomOf, weaponOf } from './state-fixtures';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Assert that previewing an action agrees with confirming it: same legality, same
 * event (or reason), and previewing never mutates the state.
 */
function expectPreviewAgrees(
  state: GameState,
  action: GameAction,
): {
  preview: ActionPreview;
  result: ActionResult;
} {
  const before = clone(state);
  const preview = previewAction(state, action);
  expect(state).toEqual(before);

  const result = applyAction(state, action);
  expect(preview.ok).toBe(result.ok);
  if (preview.ok && result.ok) {
    expect(preview.event).toEqual(result.event);
  } else if (!preview.ok && !result.ok) {
    expect(preview.reason).toBe(result.reason);
  }
  return { preview, result };
}

describe('preview/confirm parity', () => {
  it('agrees for every legal action in a seeded opening room', () => {
    const state = createInitialState('parity-seed');
    const actions = getLegalActions(state);
    expect(actions.length).toBeGreaterThan(0);

    for (const action of actions) {
      expectPreviewAgrees(state, action);
    }
  });

  it('agrees for every legal action across a deterministic playthrough', () => {
    let state = createInitialState('parity-playthrough-seed');
    let steps = 0;

    while (state.status === 'playing' && steps < 300) {
      const actions = getLegalActions(state);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expectPreviewAgrees(state, action);
      }
      // Prefer resolutions and room entry; escaping every room would loop the
      // same cards between the room and the dungeon bottom forever.
      const chosen =
        actions.find((action) => action.type === 'resolveCard') ??
        actions.find((action) => action.type === 'enterNextRoom') ??
        actions.find((action) => action.type === 'undoRoom') ??
        actions[0];
      const result = applyAction(state, chosen);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      state = result.state;
      steps += 1;
    }

    expect(state.status).not.toBe('playing');
    expect(steps).toBeGreaterThan(0);
  });

  it('agrees for rejected monster attack choices', () => {
    const noWeapon = makeState({ room: roomOf(['club-5', 'club-2', 'club-3', 'club-4']) });
    expectPreviewAgrees(noWeapon, { type: 'resolveCard', card: 'club-5', attack: 'weapon' });

    const ineligible = makeState({
      room: roomOf(['club-5', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-2', ['club-5']),
    });
    expectPreviewAgrees(ineligible, { type: 'resolveCard', card: 'club-5', attack: 'weapon' });

    const missingAttack = makeState({ room: roomOf(['club-5', 'club-2', 'club-3', 'club-4']) });
    expectPreviewAgrees(missingAttack, { type: 'resolveCard', card: 'club-5' });
  });

  it('agrees for escape, next-room, and undo actions in every phase of a room', () => {
    const start = makeState({
      room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
      dungeon: ['diamond-4', 'heart-3', 'spade-6', 'club-7'],
    });
    const escaped = expectPreviewAgrees(start, { type: 'runAway' }).result;
    expect(escaped.ok).toBe(true);

    const cleared = makeState({
      room: roomOf(['club-2']),
      roomCleared: true,
      resolvedThisRoom: 3,
      dungeon: ['diamond-4', 'heart-3', 'spade-6'],
    });
    expectPreviewAgrees(cleared, { type: 'enterNextRoom' });

    const progressed = makeState({
      room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
      dungeon: ['diamond-4'],
      resolvedThisRoom: 1,
    });
    expectPreviewAgrees(progressed, { type: 'undoRoom' });
    expectPreviewAgrees(progressed, { type: 'runAway' });
  });

  it('previews every legal room-card resolution in a room with mixed card kinds', () => {
    const state = makeState({
      room: roomOf(['club-8', 'diamond-5', 'heart-6', 'club-2']),
      weapon: weaponOf('diamond-4'),
    });

    for (const roomCard of state.room.cards) {
      for (const action of getLegalActions(state).filter(
        (candidate) => candidate.type === 'resolveCard' && candidate.card === roomCard.card,
      )) {
        expectPreviewAgrees(state, action);
      }
    }
  });
});

describe('engine state is immutable', () => {
  it('applying an action returns a new state and never mutates the input', () => {
    const state = createInitialState('immutability-seed');
    const before = clone(state);

    // Listing legal actions must not mutate the state either.
    const actions = getLegalActions(state);
    expect(state).toEqual(before);

    const action = actions.find((candidate) => candidate.type === 'resolveCard');
    expect(action).toBeDefined();
    if (!action) return;

    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    expect(state).toEqual(before);
    expect(result.state).not.toBe(state);
    if (result.ok) expect(result.state.room).not.toBe(state.room);
  });
});

describe('monster preview', () => {
  it('shows barehanded damage and no weapon choice when unarmed', () => {
    const state = makeState({ room: roomOf(['club-a', 'club-2', 'club-3', 'club-4']) });
    const preview = previewMonster(state, 'club-a');

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview).toEqual({
      card: 'club-a',
      monsterValue: 14,
      barehanded: { damage: 14, healthAfter: 6 },
      weapon: null,
    });
  });

  it('shows weapon damage and eligibility while a weapon is equipped', () => {
    const state = makeState({
      room: roomOf(['club-8', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-3'),
    });
    const preview = previewMonster(state, 'club-8');

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.barehanded).toEqual({ damage: 8, healthAfter: 12 });
    expect(preview.preview.weapon).toEqual({
      eligible: true,
      limit: null,
      damage: 5,
      healthAfter: 15,
    });
  });

  it('explains weapon ineligibility with the current limit', () => {
    const state = makeState({
      room: roomOf(['club-6', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-2', ['club-6']),
    });
    const preview = previewMonster(state, 'club-6');

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.weapon).toMatchObject({ eligible: false, limit: 6 });
  });

  it('rejects non-monsters and cards outside the room', () => {
    const state = makeState({ room: roomOf(['heart-5', 'club-2', 'club-3', 'club-4']) });

    expect(previewMonster(state, 'heart-5')).toEqual({ ok: false, reason: 'not-a-monster' });
    expect(previewMonster(state, 'club-a')).toEqual({ ok: false, reason: 'card-not-in-room' });
  });

  it('reports the same damage as the confirmed card resolution', () => {
    const state = makeState({
      room: roomOf(['club-8', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-3'),
    });
    const barehandedPreview = previewMonster(state, 'club-8');
    const barehandedResult = expectPreviewAgrees(state, {
      type: 'resolveCard',
      card: 'club-8',
      attack: 'barehanded',
    });
    const weaponPreview = previewMonster(state, 'club-8');
    const weaponResult = expectPreviewAgrees(state, {
      type: 'resolveCard',
      card: 'club-8',
      attack: 'weapon',
    });

    expect(barehandedPreview.ok && weaponPreview.ok).toBe(true);
    if (!barehandedPreview.ok || !weaponPreview.ok) return;
    expect(barehandedResult.result.ok && weaponResult.result.ok).toBe(true);
    if (!barehandedResult.result.ok || !weaponResult.result.ok) return;
    expect(barehandedPreview.preview.barehanded.damage).toBe(
      barehandedResult.result.event.type === 'cardResolved'
        ? barehandedResult.result.event.damage
        : -1,
    );
    expect(weaponPreview.preview.weapon?.damage).toBe(
      weaponResult.result.event.type === 'cardResolved' ? weaponResult.result.event.damage : -1,
    );
  });
});

describe('card preview helper', () => {
  it('agrees with confirmed card resolutions for potions and weapons', () => {
    const state = makeState({
      health: 10,
      room: roomOf(['heart-6', 'diamond-5', 'club-2', 'club-3']),
    });

    for (const card of ['heart-6', 'diamond-5'] as const) {
      const preview = previewCardResolution(state, card);
      const result = applyAction(state, { type: 'resolveCard', card });
      expect(preview.ok).toBe(result.ok);
      if (preview.ok && result.ok) expect(preview.event).toEqual(result.event);
    }
  });
});
