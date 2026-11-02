import { describe, expect, it } from 'vitest';
import {
  applyAction,
  cardValue,
  getLegalActions,
  previewMonster,
  type ActionResult,
  type AttackMode,
  type CardId,
  type CardResolvedEvent,
  type GameState,
} from './index';
import { makeState, roomOf, weaponOf } from './state-fixtures';

function resolveCard(state: GameState, card: CardId, attack?: AttackMode): ActionResult {
  return applyAction(
    state,
    attack === undefined
      ? { type: 'resolveCard', card }
      : {
          type: 'resolveCard',
          card,
          attack,
        },
  );
}

function expectOk(result: ActionResult): {
  state: GameState;
  event: CardResolvedEvent;
  ok: true;
} {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected action to be legal, got ${result.reason}`);
  if (result.event.type !== 'cardResolved') throw new Error('Expected a card resolution event');
  return { state: result.state, event: result.event, ok: true };
}

function expectRejected(result: ActionResult, reason: string) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected action to be rejected');
  expect(result.reason).toBe(reason);
}

const roomOfFour = roomOf(['club-2', 'club-3', 'club-4', 'club-5']);

describe('fighting barehanded', () => {
  it('takes damage equal to the full monster value', () => {
    const state = makeState({ room: roomOfFour });
    const result = expectOk(resolveCard(state, 'club-5', 'barehanded'));

    expect(result.event).toMatchObject({
      type: 'cardResolved',
      card: 'club-5',
      cardKind: 'monster',
      attack: 'barehanded',
      monsterValue: 5,
      damage: 5,
      healthBefore: 20,
      healthAfter: 15,
      monsterDefeated: true,
    });
    expect(result.state.health).toBe(15);
    expect(result.state.room.cards.map((roomCard) => roomCard.card)).toHaveLength(3);
  });

  it('remains available when a weapon is equipped and ignores the weapon', () => {
    const state = makeState({
      room: roomOfFour,
      weapon: weaponOf('diamond-10', ['club-2']),
    });

    const barehanded = getLegalActions(state).filter(
      (action) =>
        action.type === 'resolveCard' && action.attack === 'barehanded' && action.card === 'club-5',
    );
    expect(barehanded).toHaveLength(1);

    const result = expectOk(resolveCard(state, 'club-5', 'barehanded'));
    expect(result.state.health).toBe(15);
    expect(result.state.weapon).toEqual(state.weapon);
    expect(result.event).toMatchObject({ damage: 5, weaponEquipped: false });
  });
});

describe('fighting with a weapon', () => {
  it('subtracts the weapon value and takes the difference as damage', () => {
    const state = makeState({
      room: roomOf(['club-8', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-5'),
    });
    const result = expectOk(resolveCard(state, 'club-8', 'weapon'));

    expect(result.event).toMatchObject({ damage: 3, healthAfter: 17, monsterDefeated: true });
    expect(result.state.health).toBe(17);
  });

  it('never deals negative damage or restores health when the weapon is stronger', () => {
    const state = makeState({ room: roomOfFour, weapon: weaponOf('diamond-10'), health: 12 });
    const result = expectOk(resolveCard(state, 'club-5', 'weapon'));

    expect(result.event).toMatchObject({ damage: 0, healthAfter: 12, healing: 0 });
    expect(result.state.health).toBe(12);
  });

  it('deals exactly zero damage when weapon and monster values are equal', () => {
    const state = makeState({
      room: roomOf(['club-10', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-10'),
    });
    const result = expectOk(resolveCard(state, 'club-10', 'weapon'));

    expect(result.event.damage).toBe(0);
    expect(result.event.healthAfter).toBe(20);
  });

  it('parks the defeated monster on the weapon stack, most recent on top', () => {
    const state = makeState({
      room: roomOf(['club-6', 'club-3', 'club-9', 'club-2']),
      weapon: weaponOf('diamond-8'),
    });

    const first = expectOk(resolveCard(state, 'club-6', 'weapon'));
    const second = expectOk(resolveCard(first.state, 'club-3', 'weapon'));

    expect(first.state.weapon?.kills).toEqual(['club-6']);
    expect(second.state.weapon?.kills).toEqual(['club-6', 'club-3']);
    expect(second.event.weapon?.kills).toEqual(['club-6', 'club-3']);
  });

  it('requires an explicit attack mode for monsters', () => {
    const state = makeState({ room: roomOfFour });
    expectRejected(resolveCard(state, 'club-5'), 'attack-mode-required');
  });

  it('rejects the weapon choice without an equipped weapon', () => {
    const state = makeState({ room: roomOfFour });
    expectRejected(resolveCard(state, 'club-5', 'weapon'), 'no-weapon');
  });
});

describe('weapon degradation', () => {
  it('rejects an equal-value monster after a kill', () => {
    const state = makeState({
      room: roomOf(['club-4', 'club-2', 'club-3', 'club-5']),
      weapon: weaponOf('diamond-3', ['club-4']),
    });

    expectRejected(resolveCard(state, 'club-4', 'weapon'), 'weapon-ineligible');
    const weaponActions = getLegalActions(state).filter(
      (action) =>
        action.type === 'resolveCard' && action.card === 'club-4' && action.attack === 'weapon',
    );
    expect(weaponActions).toHaveLength(0);
  });

  it('rejects a greater-value monster after a kill but allows lower values', () => {
    const state = makeState({
      room: roomOf(['club-9', 'club-8', 'club-6', 'club-2']),
      weapon: weaponOf('diamond-6', ['club-8']),
    });

    expectRejected(resolveCard(state, 'club-9', 'weapon'), 'weapon-ineligible');
    expectRejected(resolveCard(state, 'club-8', 'weapon'), 'weapon-ineligible');

    const lower = expectOk(resolveCard(state, 'club-2', 'weapon'));
    expect(lower.state.weapon?.limit).toBe(2);
  });

  it('updates the limit after each kill', () => {
    const state = makeState({
      room: roomOf(['club-6', 'spade-6', 'club-4', 'club-3']),
      weapon: weaponOf('diamond-8'),
    });

    const first = expectOk(resolveCard(state, 'club-6', 'weapon'));
    expect(first.state.weapon?.limit).toBe(6);
    // An equal-value monster left in the room is now ineligible; a duplicate
    // value elsewhere in the room exercises the same limit.
    expectRejected(resolveCard(first.state, 'spade-6', 'weapon'), 'weapon-ineligible');

    const second = expectOk(resolveCard(first.state, 'club-4', 'weapon'));
    expect(second.state.weapon?.limit).toBe(4);
  });

  it('exposes the limit and ineligibility in the monster preview', () => {
    const state = makeState({
      room: roomOfFour,
      weapon: weaponOf('diamond-3', ['club-4']),
    });

    const equalPreview = previewMonster(state, 'club-4');
    expect(equalPreview.ok).toBe(true);
    if (!equalPreview.ok) return;
    expect(equalPreview.preview.weapon).toMatchObject({
      eligible: false,
      limit: 4,
      damage: 1,
    });

    const lowerPreview = previewMonster(state, 'club-2');
    expect(lowerPreview.ok).toBe(true);
    if (!lowerPreview.ok) return;
    expect(lowerPreview.preview.weapon).toMatchObject({ eligible: true, limit: 4 });
  });

  it('allows any monster when degradation is off, but still records the kill stack', () => {
    const state = makeState({
      config: 4,
      room: roomOf(['club-6', 'spade-6', 'club-10', 'club-2']),
      weapon: weaponOf('diamond-3', ['club-4']),
    });

    const equal = expectOk(resolveCard(state, 'club-6', 'weapon'));
    expect(equal.state.weapon?.kills).toEqual(['club-4', 'club-6']);
    expect(equal.state.weapon?.limit).toBe(6);

    const greater = expectOk(resolveCard(equal.state, 'club-10', 'weapon'));
    expect(greater.event.damage).toBe(7);
    expect(greater.state.weapon?.limit).toBe(10);
  });

  it('keeps a fresh weapon unrestricted', () => {
    const state = makeState({
      room: roomOf(['club-a', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-2'),
    });
    const preview = previewMonster(state, 'club-a');

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.weapon).toMatchObject({ eligible: true, limit: null });

    expect(preview.preview.weapon?.damage).toBe(cardValue('club-a') - 2);
  });
});

describe('weapon replacement', () => {
  it('discards the old weapon and its kill stack when a diamond is picked up', () => {
    const state = makeState({
      room: roomOf(['diamond-7', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-3', ['club-2', 'club-5']),
    });

    const result = expectOk(resolveCard(state, 'diamond-7'));

    expect(result.event).toMatchObject({
      cardKind: 'weapon',
      attack: null,
      weaponEquipped: true,
      weaponReplaced: 'diamond-3',
      weaponReplacedKills: ['club-2', 'club-5'],
      damage: 0,
    });
    expect(result.state.weapon).toEqual({
      card: 'diamond-7',
      value: 7,
      kills: [],
      limit: null,
    });
  });

  it('equips a diamond with no replacement when barehanded or unarmed', () => {
    const state = makeState({ room: roomOf(['club-2', 'diamond-9', 'club-3', 'club-4']) });
    const result = expectOk(resolveCard(state, 'diamond-9'));

    expect(result.event.weaponReplaced).toBeNull();
    expect(result.state.weapon?.card).toBe('diamond-9');
  });
});

describe('lethal combat', () => {
  it('loses the run when barehanded damage reaches zero health', () => {
    const state = makeState({ health: 3, room: roomOfFour, finalRoom: false });
    const result = expectOk(resolveCard(state, 'club-5', 'barehanded'));

    expect(result.state.status).toBe('lost');
    expect(result.event).toMatchObject({
      healthAfter: -2,
      runOutcome: 'lost',
      monsterDefeated: false,
    });
    expect(result.state.result?.outcome).toBe('lost');
    expect(result.state.undo).toBeNull();
  });

  it('does not record a kill for the monster that defeats the player', () => {
    const state = makeState({
      health: 2,
      room: roomOf(['club-10', 'club-2', 'club-3', 'club-4']),
      weapon: weaponOf('diamond-2'),
    });
    const result = expectOk(resolveCard(state, 'club-10', 'weapon'));

    expect(result.state.status).toBe('lost');
    expect(result.event.monsterDefeated).toBe(false);
    expect(result.state.weapon?.kills).toEqual([]);
    expect(result.state.highlights.monstersDefeated).toBe(0);
  });

  it('counts defeated monsters when the player survives with 1 health', () => {
    const state = makeState({ health: 3, room: roomOfFour });
    const result = expectOk(resolveCard(state, 'club-2', 'barehanded'));

    expect(result.state.status).toBe('playing');
    expect(result.state.health).toBe(1);
    expect(result.state.highlights.monstersDefeated).toBe(1);
  });
});
