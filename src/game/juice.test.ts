import { describe, expect, it } from 'vitest';
import type { CardId } from '../engine';
import { planJuice, SHAKE_DAMAGE_THRESHOLD } from './juice';
import type { BridgeCommand } from './scene-api';

/**
 * Juice plan keying: every effect derives from the existing command payloads
 * and the terminal reconstruction. The scene skips juice under reduced motion
 * (the plan is motion-agnostic — that policy is asserted at the scene seam in
 * store-bridge.test.ts / animations.test.ts with end-state jumps).
 */

const attack = (overrides?: Partial<Extract<BridgeCommand, { kind: 'attack' }>>) => ({
  kind: 'attack' as const,
  cardId: 'club-2' as CardId,
  damage: 3,
  usedWeaponId: null,
  killCardId: null,
  weaponBreak: false,
  ...overrides,
});

describe('planJuice (keying off command payloads)', () => {
  it('camera shake fires only on big hits (damage ≥ threshold)', () => {
    expect(planJuice(attack({ damage: 3 })).cameraShake).toBeNull();
    expect(planJuice(attack({ damage: SHAKE_DAMAGE_THRESHOLD - 1 })).cameraShake).toBeNull();
    expect(planJuice(attack({ damage: SHAKE_DAMAGE_THRESHOLD })).cameraShake).toEqual({
      durationMs: expect.any(Number),
      intensity: expect.any(Number),
    });
    expect(planJuice(attack({ damage: 12 })).cameraShake).not.toBeNull();
  });

  it('weapon-strain flash keys ONLY to the bridge-derived weaponBreak flag', () => {
    expect(planJuice(attack({ weaponBreak: true })).weaponStrain).toBe(true);
    expect(planJuice(attack({ weaponBreak: false })).weaponStrain).toBe(false);
    // A weapon kill with heavy damage shakes the camera but never strains.
    const clean = planJuice(attack({ damage: 9, usedWeaponId: 'diamond-a', killCardId: 'club-2' }));
    expect(clean.weaponStrain).toBe(false);
    expect(clean.cameraShake).not.toBeNull();
  });

  it('terminal: lethal blows shake; the reconstructed break drives the strain flash', () => {
    expect(
      planJuice({
        kind: 'terminal',
        outcome: 'lost',
        reconstruction: {
          hpDelta: -14,
          hpBefore: 20,
          hpAfter: 6,
          killAppendedId: null,
          removedFromRoom: ['club-a'],
          addedToRoom: [],
          weaponBefore: null,
          weaponAfter: null,
          weaponBreak: true,
        },
      }),
    ).toEqual({
      cameraShake: expect.anything(), // lethal blow shakes
      weaponStrain: true,
      healBurst: false,
    });
    // Sub-threshold hit with no derived break → quiet.
    expect(
      planJuice({
        kind: 'terminal',
        outcome: 'won',
        reconstruction: {
          hpDelta: -2,
          hpBefore: 20,
          hpAfter: 18,
          killAppendedId: null,
          removedFromRoom: ['club-2'],
          addedToRoom: [],
          weaponBefore: null,
          weaponAfter: null,
          weaponBreak: false,
        },
      }).cameraShake,
    ).toBeNull();
    // Weapon kill at terminal: no strain flash even on a lethal blow.
    const terminal = planJuice({
      kind: 'terminal',
      outcome: 'lost',
      reconstruction: {
        hpDelta: -8,
        hpBefore: 10,
        hpAfter: 2,
        killAppendedId: 'club-3',
        removedFromRoom: ['club-2'],
        addedToRoom: [],
        weaponBefore: 'diamond-a',
        weaponAfter: 'diamond-a',
        weaponBreak: false,
      },
    });
    expect(terminal.cameraShake).not.toBeNull();
    expect(terminal.weaponStrain).toBe(false);
  });

  it('potion heal bursts only on real heals — wasted potions stay quiet (glow only)', () => {
    expect(
      planJuice({ kind: 'potion', cardId: 'heart-4', healed: 4, wasted: false }).healBurst,
    ).toBe(true);
    expect(
      planJuice({ kind: 'potion', cardId: 'heart-4', healed: 0, wasted: false }).healBurst,
    ).toBe(false);
    expect(
      planJuice({ kind: 'potion', cardId: 'heart-4', healed: 0, wasted: true }).healBurst,
    ).toBe(false);
  });

  it('every other command is quiet (no juice)', () => {
    for (const command of [
      { kind: 'deal', cards: [], carriedFrom: null },
      { kind: 'runAway', newCards: [] },
      {
        kind: 'weaponEquip',
        cardId: 'diamond-4',
        discardedWeaponId: null,
        discardedMonsterIds: [],
      },
      { kind: 'errorFeedback' },
      { kind: 'rebuild' },
      { kind: 'noop' },
    ] as BridgeCommand[]) {
      expect(planJuice(command)).toEqual({
        cameraShake: null,
        weaponStrain: false,
        healBurst: false,
      });
    }
  });
});
