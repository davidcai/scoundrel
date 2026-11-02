import { describe, expect, it } from 'vitest';
import {
  MAX_HEALTH,
  STARTING_HEALTH,
  createInitialState,
  getLegalActions,
  previewMonster,
  type RuleConfig,
} from './index';

describe('initial run state', () => {
  it('starts at 20 health with a four-card room and 40 cards left in the dungeon', () => {
    const state = createInitialState('initial-seed');

    expect(STARTING_HEALTH).toBe(20);
    expect(MAX_HEALTH).toBe(20);
    expect(state.health).toBe(20);
    expect(state.dungeon).toHaveLength(40);
    expect(state.room.cards).toHaveLength(4);
    expect(state.room.cards.every((roomCard) => !roomCard.carried)).toBe(true);
    expect(state.finalRoom).toBe(false);
    expect(state.roomCleared).toBe(false);
    expect(state.resolvedThisRoom).toBe(0);
    expect(state.weapon).toBeNull();
    expect(state.potionUsedThisRoom).toBe(false);
    expect(state.escapedLastRoom).toBe(false);
    expect(state.status).toBe('playing');
    expect(state.result).toBeNull();
  });

  it('accounts for all 44 cards between the dungeon and the room', () => {
    const state = createInitialState('44-cards');

    const allCards = [
      ...state.dungeon,
      ...state.room.cards.map((roomCard) => roomCard.card),
      ...(state.weapon === null ? [] : [state.weapon.card, ...state.weapon.kills]),
    ];

    expect(allCards).toHaveLength(44);
    expect(new Set(allCards).size).toBe(44);
  });

  it('records the starting room as explored and captures its undo starting point', () => {
    const state = createInitialState('highlights-seed');

    expect(state.highlights).toEqual({
      monstersDefeated: 0,
      potionsWasted: 0,
      roomsExplored: 1,
      roomsCleared: 0,
    });
    expect(state.undo).not.toBeNull();
    expect(state.undo?.health).toBe(state.health);
    expect(state.undo?.dungeon).toEqual(state.dungeon);
    expect(state.undo?.room).toEqual(state.room);
    expect(state.undo?.resolvedThisRoom).toBe(0);
  });

  it('normalizes the stored seed and keeps the selected rule options', () => {
    expect(createInitialState('  trimmed seed  ').seed).toBe('trimmed seed');
    expect(createInitialState('configured', 7).config).toBe(7);
    expect(createInitialState('configured', 0).config).toBe(0);
  });

  it('rejects invalid seeds and rule configurations', () => {
    expect(() => createInitialState('')).toThrow(RangeError);
    expect(() => createInitialState('   ')).toThrow(RangeError);
    expect(() => createInitialState('a'.repeat(65))).toThrow(RangeError);
    expect(() => createInitialState('valid', 8 as RuleConfig)).toThrow(RangeError);
    expect(() => createInitialState('valid', -1 as RuleConfig)).toThrow(RangeError);
  });
});

describe('legal actions in the starting room', () => {
  it('offers run away and a resolution for every card, but not next-room entry or undo', () => {
    const state = createInitialState('legal-seed');
    const actions = getLegalActions(state);

    expect(actions.filter((action) => action.type === 'runAway')).toHaveLength(1);
    expect(actions.filter((action) => action.type === 'enterNextRoom')).toHaveLength(0);
    expect(actions.filter((action) => action.type === 'undoRoom')).toHaveLength(0);

    const resolutions = actions.filter((action) => action.type === 'resolveCard');
    expect(resolutions).toHaveLength(4);
    expect(new Set(resolutions.map((action) => 'card' in action && action.card))).toEqual(
      new Set(state.room.cards.map((roomCard) => roomCard.card)),
    );
  });

  it('shows the same monster damage in previews as the confirmed resolution', () => {
    const state = createInitialState('preview-seed');
    const monster = state.room.cards.find((roomCard) => roomCard.card.startsWith('club'));

    expect(monster).toBeDefined();
    const preview = previewMonster(state, monster!.card);

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.barehanded.damage).toBeGreaterThan(0);
    expect(preview.preview.weapon).toBeNull();
  });
});
