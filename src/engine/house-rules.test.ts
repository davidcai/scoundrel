import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  ruleOptions,
  type ActionResult,
  type GameState,
  type RuleConfig,
} from './index';
import { makeState, roomOf, weaponOf } from './state-fixtures';

function expectOk(result: ActionResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected action to be legal, got ${result.reason}`);
  return result;
}

function potionRoom() {
  return roomOf(['heart-5', 'heart-6', 'club-2', 'club-3']);
}

function escapeState(config: RuleConfig): GameState {
  return makeState({
    config,
    room: roomOf(['club-2', 'club-3', 'club-4', 'club-5']),
    dungeon: ['diamond-4', 'heart-3', 'spade-6', 'club-7', 'club-8'],
  });
}

function degradationState(config: RuleConfig): GameState {
  return makeState({
    config,
    room: roomOf(['club-5', 'club-2', 'club-3', 'club-4']),
    weapon: weaponOf('diamond-2', ['spade-5']),
  });
}

describe('house-rule combinations', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7] as const)(
    'applies configuration %i exactly as its bits define',
    (config) => {
      const options = ruleOptions(config);

      // The configuration is stored on the run, not mutated by play.
      const initial = createInitialState('house-rule-seed', config);
      expect(initial.config).toBe(config);
      expect(ruleOptions(initial.config)).toEqual(options);

      // Bit 0: consecutive escapes.
      const escaped = expectOk(applyAction(escapeState(config), { type: 'runAway' })).state;
      const secondEscape = applyAction(escaped, { type: 'runAway' });
      expect(secondEscape.ok).toBe(options.consecutiveEscapesAllowed);
      if (!secondEscape.ok) {
        expect(secondEscape.reason).toBe('escape-consecutive-blocked');
      }

      // Bit 1: unlimited potions.
      const potionState = makeState({ config, health: 5, room: potionRoom() });
      const firstPotion = expectOk(
        applyAction(potionState, { type: 'resolveCard', card: 'heart-5' }),
      ).state;
      expect(firstPotion.health).toBe(10);
      const secondPotion = expectOk(
        applyAction(firstPotion, { type: 'resolveCard', card: 'heart-6' }),
      );
      if (options.unlimitedPotions) {
        expect(secondPotion.state.health).toBe(16);
        expect(secondPotion.event).toMatchObject({ healing: 6, potionWasted: false });
      } else {
        expect(secondPotion.state.health).toBe(10);
        expect(secondPotion.event).toMatchObject({ healing: 0, potionWasted: true });
      }

      // Bit 2: weapon degradation.
      const degraded = degradationState(config);
      const equalMonster = applyAction(degraded, {
        type: 'resolveCard',
        card: 'club-5',
        attack: 'weapon',
      });
      expect(equalMonster.ok).toBe(options.degradationOff);
      if (!equalMonster.ok) {
        expect(equalMonster.reason).toBe('weapon-ineligible');
      }
    },
  );

  it('defaults every option off', () => {
    expect(ruleOptions(0)).toEqual({
      consecutiveEscapesAllowed: false,
      unlimitedPotions: false,
      degradationOff: false,
    });
  });

  it('does not let one option leak into another', () => {
    // Consecutive escapes on, but potions still once per room.
    const consecutiveOnly = makeState({ config: 1, health: 5, room: potionRoom() });
    const first = expectOk(
      applyAction(consecutiveOnly, { type: 'resolveCard', card: 'heart-5' }),
    ).state;
    const second = expectOk(applyAction(first, { type: 'resolveCard', card: 'heart-6' }));
    expect(second.event).toMatchObject({ healing: 0, potionWasted: true });

    // Unlimited potions on, but degradation still applies.
    const potionsOnly = degradationState(2);
    expect(
      applyAction(potionsOnly, { type: 'resolveCard', card: 'club-5', attack: 'weapon' }),
    ).toMatchObject({ ok: false, reason: 'weapon-ineligible' });

    // Degradation off, but consecutive escapes still blocked.
    const degradationOnly = expectOk(applyAction(escapeState(4), { type: 'runAway' })).state;
    expect(applyAction(degradationOnly, { type: 'runAway' })).toMatchObject({
      ok: false,
      reason: 'escape-consecutive-blocked',
    });
  });
});
