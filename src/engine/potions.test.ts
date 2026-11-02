import { describe, expect, it } from 'vitest';
import {
  applyAction,
  type ActionResult,
  type CardId,
  type CardResolvedEvent,
  type GameState,
} from './index';
import { makeState, roomOf } from './state-fixtures';

function resolveCard(state: GameState, card: CardId): ActionResult {
  return applyAction(state, { type: 'resolveCard', card });
}

function expectApplied(result: ActionResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected action to be legal, got ${result.reason}`);
  return result;
}

function expectOk(result: ActionResult): {
  state: GameState;
  event: CardResolvedEvent;
  ok: true;
} {
  const applied = expectApplied(result);
  if (applied.event.type !== 'cardResolved') throw new Error('Expected a card resolution event');
  return { state: applied.state, event: applied.event, ok: true };
}

const potionRoom = roomOf(['heart-5', 'heart-6', 'club-2', 'club-3']);

describe('healing potions', () => {
  it('restores health equal to the card value', () => {
    const state = makeState({ health: 10, room: potionRoom });
    const result = expectOk(resolveCard(state, 'heart-5'));

    expect(result.event).toMatchObject({
      cardKind: 'potion',
      healing: 5,
      healthBefore: 10,
      healthAfter: 15,
      potionWasted: false,
      damage: 0,
    });
    expect(result.state.health).toBe(15);
    expect(result.state.potionUsedThisRoom).toBe(true);
  });

  it('caps healing at 20 health', () => {
    const state = makeState({ health: 18, room: potionRoom });
    const result = expectOk(resolveCard(state, 'heart-5'));

    expect(result.event.healing).toBe(2);
    expect(result.state.health).toBe(20);
    expect(result.event.potionWasted).toBe(false);
  });

  it('caps healing when the potion value would overshoot 20', () => {
    const state = makeState({
      health: 19,
      room: roomOf(['heart-10', 'club-2', 'club-3', 'club-4']),
    });
    const result = expectOk(resolveCard(state, 'heart-10'));

    expect(result.event.healing).toBe(1);
    expect(result.state.health).toBe(20);
    expect(result.event.potionWasted).toBe(false);
  });
});

describe('wasted potions', () => {
  it('wastes a potion consumed at full health and still uses the allowance', () => {
    const state = makeState({ health: 20, room: potionRoom });
    const first = expectOk(resolveCard(state, 'heart-5'));

    expect(first.event).toMatchObject({
      healing: 0,
      potionWasted: true,
      healthAfter: 20,
    });
    expect(first.state.highlights.potionsWasted).toBe(1);
    // Ruling: consuming a potion at 20 health uses the one-per-room allowance,
    // so the next potion is a discarded second potion.
    expect(first.state.potionUsedThisRoom).toBe(true);

    const second = expectOk(resolveCard(first.state, 'heart-6'));
    expect(second.event).toMatchObject({ healing: 0, potionWasted: true });
    expect(second.state.highlights.potionsWasted).toBe(2);
  });

  it('discards a second potion in the room and restores nothing', () => {
    const state = makeState({ health: 5, room: potionRoom });
    const first = expectOk(resolveCard(state, 'heart-5'));
    expect(first.state.health).toBe(10);
    expect(first.state.highlights.potionsWasted).toBe(0);

    const second = expectOk(resolveCard(first.state, 'heart-6'));
    expect(second.event).toMatchObject({ healing: 0, potionWasted: true, healthAfter: 10 });
    expect(second.state.health).toBe(10);
    expect(second.state.highlights.potionsWasted).toBe(1);
    expect(second.state.room.cards.some((roomCard) => roomCard.card === 'heart-6')).toBe(false);
  });

  it('does not count a healing potion as wasted', () => {
    const state = makeState({ health: 10, room: potionRoom });
    const result = expectOk(resolveCard(state, 'heart-5'));

    expect(result.state.highlights.potionsWasted).toBe(0);
  });
});

describe('potion allowance per room', () => {
  it('resets the allowance when the next room is dealt', () => {
    const roomCleared = makeState({
      health: 10,
      room: roomOf(['heart-6']),
      roomCleared: true,
      resolvedThisRoom: 3,
      potionUsedThisRoom: true,
      dungeon: ['club-2', 'club-3', 'club-4'],
    });

    const entered = expectApplied(applyAction(roomCleared, { type: 'enterNextRoom' }));
    expect(entered.state.potionUsedThisRoom).toBe(false);
    expect(entered.state.room.cards).toHaveLength(4);

    const drunk = expectOk(
      applyAction(entered.state, {
        type: 'resolveCard',
        card: 'heart-6',
      }),
    );
    expect(drunk.event).toMatchObject({ cardKind: 'potion', healing: 6 });
    expect(drunk.state.health).toBe(16);
  });

  it('carries an unresolved heart without discarding it', () => {
    const roomCleared = makeState({
      health: 12,
      room: roomOf(['heart-8']),
      roomCleared: true,
      resolvedThisRoom: 3,
      dungeon: ['club-2', 'club-3'],
    });

    const entered = expectApplied(applyAction(roomCleared, { type: 'enterNextRoom' }));
    const carried = entered.state.room.cards.find((roomCard) => roomCard.card === 'heart-8');

    expect(carried).toBeDefined();
    expect(carried?.carried).toBe(true);
    expect(entered.state.potionUsedThisRoom).toBe(false);
  });
});

describe('unlimited potions house rule', () => {
  it('allows every potion to heal until 20 health', () => {
    const state = makeState({ config: 2, health: 3, room: potionRoom });
    const first = expectOk(resolveCard(state, 'heart-5'));
    expect(first.state.health).toBe(8);

    const second = expectOk(resolveCard(first.state, 'heart-6'));
    expect(second.event).toMatchObject({ healing: 6, potionWasted: false });
    expect(second.state.health).toBe(14);
    expect(second.state.highlights.potionsWasted).toBe(0);
  });

  it('still wastes a potion consumed at 20 health', () => {
    const state = makeState({ config: 2, health: 20, room: potionRoom });
    const first = expectOk(resolveCard(state, 'heart-5'));
    expect(first.event).toMatchObject({ healing: 0, potionWasted: true });

    const second = expectOk(resolveCard(first.state, 'heart-6'));
    expect(second.event).toMatchObject({ healing: 0, potionWasted: true });
    expect(second.state.highlights.potionsWasted).toBe(2);
  });
});
