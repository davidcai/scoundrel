import { describe, expect, it } from 'vitest';
import { makeCard } from '../src/game/deck';
import { canUseWeapon, combatDamage, healAmount, isMonster, monsterValuesSum } from '../src/game/rules';
import { reducer } from '../src/game/engine';

describe('canUseWeapon / combatDamage', () => {
  it('fresh weapon may attack any monster', () => {
    const w = { card: makeCard('diamonds', 10), slain: [], lastKilledValue: null };
    expect(canUseWeapon(w, 14)).toBe(true);
    expect(canUseWeapon(w, 10)).toBe(true);
  });

  it('after a kill, only strictly weaker monsters are valid', () => {
    const w = { card: makeCard('diamonds', 8), slain: [makeCard('clubs', 11)], lastKilledValue: 11 };
    expect(canUseWeapon(w, 11)).toBe(false);
    expect(canUseWeapon(w, 12)).toBe(false);
    expect(canUseWeapon(w, 10)).toBe(true);
  });

  it('returns false when no weapon is equipped', () => {
    expect(canUseWeapon(null, 5)).toBe(false);
  });

  it('combat damage is the nonnegative difference (weapon can cap at 0)', () => {
    expect(combatDamage(8, 11)).toBe(3);
    expect(combatDamage(10, 4)).toBe(0);
    expect(combatDamage(0, 7)).toBe(7);
  });
});

describe('healAmount', () => {
  it('heals up to the cap of 20', () => {
    expect(healAmount(10, 5)).toBe(5);
    expect(healAmount(18, 5)).toBe(2);
    expect(healAmount(20, 5)).toBe(0);
  });

  it('respects a custom cap', () => {
    expect(healAmount(3, 10, 8)).toBe(5);
  });
});

describe('isMonster / monsterValuesSum', () => {
  it('identifies clubs/spades as monsters and sums only monster values', () => {
    const cards = [makeCard('clubs', 5), makeCard('spades', 10), makeCard('diamonds', 4), makeCard('hearts', 7)];
    expect(isMonster(cards[0])).toBe(true);
    expect(isMonster(cards[2])).toBe(false);
    expect(monsterValuesSum(cards)).toBe(15);
  });
});

describe('reducer NEW_GAME determinism', () => {
  it('seeds produce identical opening hands', () => {
    const a = reducer(undefined, { type: 'NEW_GAME', seed: 99 });
    const b = reducer(undefined, { type: 'NEW_GAME', seed: 99 });
    expect(a.room.map((c) => c.id)).toEqual(b.room.map((c) => c.id));
  });
});