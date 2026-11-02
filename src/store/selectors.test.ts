import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canResolveAnyCard,
  cardKind,
  createInitialState,
  type CardId,
  type GameState,
  type RuleOptions,
} from '../engine';
import {
  configFromOptions,
  getActionAvailability,
  getCardViews,
  getDefeatedTotal,
  getDungeonCount,
  getHealthView,
  getPotionStatus,
  getRoomNumber,
  getWeaponView,
} from './selectors';

const CONFIG_0 = 0 as const;
const CONFIG_ALL = 7 as const;
const ALL_OFF: RuleOptions = {
  consecutiveEscapesAllowed: false,
  unlimitedPotions: false,
  degradationOff: false,
};
const ALL_ON: RuleOptions = {
  consecutiveEscapesAllowed: true,
  unlimitedPotions: true,
  degradationOff: true,
};

function findSeedWith(
  predicate: (state: GameState) => boolean,
  prefix: string,
  maxSeeds = 300,
): string {
  for (let index = 0; index < maxSeeds; index += 1) {
    const seed = `${prefix}-${index}`;
    if (predicate(createInitialState(seed, CONFIG_0))) return seed;
  }
  throw new Error(`No seed matched ${prefix}`);
}

function resolveCard(state: GameState, card: CardId): GameState {
  const result = applyAction(state, {
    type: 'resolveCard',
    card,
    attack: cardKind(card) === 'monster' ? 'barehanded' : undefined,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('selectors', () => {
  it('reports room action availability from the engine previews', () => {
    const state = createInitialState('selectors-seed', CONFIG_0);
    const availability = getActionAvailability(state);

    expect(availability.runAway.enabled).toBe(true);
    expect(availability.enterNextRoom.enabled).toBe(false);
    expect(availability.enterNextRoom.reason).toBe('room-not-cleared');
    expect(availability.undoRoom.enabled).toBe(false);
    expect(availability.undoRoom.reason).toBe('undo-unavailable');
  });

  it('maps engine state to card views', () => {
    const state = createInitialState('selectors-seed', CONFIG_0);
    const views = getCardViews(state, null);

    expect(views).toHaveLength(4);
    views.forEach((view, index) => {
      expect(view.index).toBe(index + 1);
      expect(view.total).toBe(4);
      expect(view.selected).toBe(false);
      expect(view.reason).toBeNull();
      expect(view.value).toBeGreaterThanOrEqual(2);
    });
  });

  it('marks remaining cards after the room is cleared as not resolvable', () => {
    const seed = findSeedWith((state) => {
      let current = state;
      for (let step = 0; step < 3; step += 1) {
        if (current.roomCleared) return false;
        current = resolveCard(current, current.room.cards[0]!.card);
        if (current.status !== 'playing') return false;
      }
      return current.roomCleared && !canResolveAnyCard(current);
    }, 'selectors-cleared');
    let state = createInitialState(seed, CONFIG_0);
    for (let step = 0; step < 3 && !state.roomCleared; step += 1) {
      state = resolveCard(state, state.room.cards[0]!.card);
    }

    const views = getCardViews(state, null);
    expect(views).toHaveLength(1);
    expect(views[0]!.reason).toBe('card-not-resolvable');
  });

  it('exposes the equipped weapon and the degradation limit', () => {
    const seed = findSeedWith(
      (state) =>
        state.room.cards.some((roomCard) => cardKind(roomCard.card) === 'weapon') &&
        state.room.cards.some((roomCard) => cardKind(roomCard.card) === 'monster'),
      'selectors-weapon',
    );
    let state = createInitialState(seed, CONFIG_0);
    const weaponCard = state.room.cards.find(
      (roomCard) => cardKind(roomCard.card) === 'weapon',
    )!.card;
    state = resolveCard(state, weaponCard);

    const view = getWeaponView(state);
    expect(view.weapon).not.toBeNull();
    expect(view.broken).toBe(false);

    const monster = state.room.cards.find(
      (roomCard) => cardKind(roomCard.card) === 'monster',
    )!.card;
    const attack = applyAction(state, { type: 'resolveCard', card: monster, attack: 'weapon' });
    expect(attack.ok).toBe(true);
    if (!attack.ok) return;

    const afterAttack = getWeaponView(attack.state);
    expect(afterAttack.weapon?.limit).not.toBeNull();
    expect(afterAttack.broken).toBe(true);
    expect(afterAttack.brokenLimit).toBe(afterAttack.weapon?.limit);
  });

  it('derives readable run counters', () => {
    const state = createInitialState('selectors-seed', CONFIG_0);

    expect(getRoomNumber(state)).toBe(1);
    expect(getDungeonCount(state)).toBe(40);
    expect(getDefeatedTotal(state)).toBe(0);
    expect(getHealthView(state)).toEqual({ health: 20, max: 20 });
  });

  it('reports potion availability and the unlimited house rule', () => {
    const base = createInitialState('selectors-seed', CONFIG_0);
    expect(getPotionStatus(base)).toMatchObject({
      available: true,
      usedThisRoom: false,
      unlimited: false,
    });

    const unlimited = createInitialState('selectors-seed', 2);
    expect(getPotionStatus(unlimited).unlimited).toBe(true);
  });

  it('converts rule options into the engine config mask', () => {
    expect(configFromOptions(ALL_OFF)).toBe(0);
    expect(configFromOptions(ALL_ON)).toBe(CONFIG_ALL);
    expect(configFromOptions({ ...ALL_OFF, consecutiveEscapesAllowed: true })).toBe(1);
    expect(configFromOptions({ ...ALL_OFF, unlimitedPotions: true })).toBe(2);
    expect(configFromOptions({ ...ALL_OFF, degradationOff: true })).toBe(4);
  });
});
