import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  cardKind,
  cardValue,
  createInitialState,
  reducer,
  type CardId,
  type GameState,
} from '../../engine';
import {
  carryNoteState,
  monsterActions,
  potionActions,
  roomProgressKey,
  weaponActions,
  weaponCannotNote,
} from './action-panel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isMonster = (c: CardId) => cardKind(c) === 'monster';
const isWeapon = (c: CardId) => cardKind(c) === 'weapon';
const isPotion = (c: CardId) => cardKind(c) === 'potion';

function seedFor(predicate: (room: CardId[]) => boolean): { seed: string; room: CardId[] } {
  for (let i = 0; i < 500; i++) {
    const seed = `t${i}`;
    const room = createInitialState(seed, DEFAULT_CONFIG).dungeon.slice(0, 4);
    if (predicate(room)) return { seed, room };
  }
  throw new Error('no seed matched');
}

function baseState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState('t0', DEFAULT_CONFIG), ...overrides };
}

/** Fresh run with its first room dealt. */
function dealtRoom(seed: string): GameState {
  return reducer(createInitialState(seed, DEFAULT_CONFIG), { type: 'DealRoom' }).state;
}

const C = (id: string) => id as CardId;

// ---------------------------------------------------------------------------
// Monster actions
// ---------------------------------------------------------------------------

describe('monsterActions', () => {
  it('offers only the barehanded fight when no weapon is equipped', () => {
    const { seed, room } = seedFor((r) => r.filter(isMonster).length === 1);
    const state = dealtRoom(seed);
    const monster = room.find(isMonster)!;

    const vm = monsterActions(state, monster);
    expect(vm.withWeaponLegal).toBe(false);
    expect(vm.withWeaponDamage).toBeNull();
    expect(vm.barehanded.legal).toBe(true);
    expect(vm.barehanded.usesWeapon).toBe(false);
    expect(vm.barehanded.damage).toBe(cardValue(monster));
  });

  it('offers the weapon fight with reduced damage when the equipped weapon beats the monster', () => {
    const { seed, room } = seedFor(
      (r) =>
        r.filter(isMonster).length === 1 &&
        r.some((c) => isWeapon(c) && cardValue(c) < cardValue(r.find(isMonster)!)),
    );
    const state = dealtRoom(seed);
    const monster = room.find(isMonster)!;
    const weapon = room.find(isWeapon)!;
    const equipped = reducer(state, { type: 'EquipWeapon', cardId: weapon }).state;

    const vm = monsterActions(equipped, monster);
    expect(vm.withWeaponLegal).toBe(true);
    expect(vm.withWeaponDamage).toBe(cardValue(monster) - cardValue(weapon));
    // Barehanded stays available alongside the weapon fight.
    expect(vm.barehanded.legal).toBe(true);
    expect(vm.barehanded.damage).toBe(cardValue(monster));
  });

  it('marks the weapon fight illegal and surfaces the last kill when degradation blocks it', () => {
    // Weapon killed the Ace of Spades (14); another Ace (14) is not below the
    // last kill — degradation blocks it, barehanded does not.
    const state = baseState({
      room: [C('club-a'), C('heart-2')],
      dungeon: [C('club-3')],
      weapon: C('diamond-6'),
      killStack: [C('spade-a')],
    });

    const vm = monsterActions(state, C('club-a'));
    expect(vm.withWeaponLegal).toBe(false);
    expect(vm.withWeaponDamage).toBeNull();
    expect(vm.barehanded.legal).toBe(true);
    expect(vm.barehanded.damage).toBe(14);

    expect(weaponCannotNote(state, C('club-a'))).toEqual({
      lastKill: C('spade-a'),
      weapon: C('diamond-6'),
    });
  });

  it('reports an empty last kill for a weapon that has not slain anything yet', () => {
    const state = baseState({
      room: [C('spade-j'), C('heart-2')],
      dungeon: [C('club-3')],
      weapon: C('diamond-6'),
    });
    expect(weaponCannotNote(state, C('spade-j'))).toEqual({
      lastKill: undefined,
      weapon: C('diamond-6'),
    });
  });
});

// ---------------------------------------------------------------------------
// Potion actions
// ---------------------------------------------------------------------------

describe('potionActions', () => {
  it('clamps the heal to missing HP', () => {
    const { seed, room } = seedFor((r) => r.some((c) => isPotion(c) && cardValue(c) > 2));
    const state = dealtRoom(seed);
    const potion = room.find((c) => isPotion(c) && cardValue(c) > 2)!;

    const hurt = { ...state, hp: state.maxHp - 2 };
    const vm = potionActions(hurt, potion);
    expect(vm.wasted).toBe(false);
    expect(vm.heal).toBe(2);

    // At full HP there is nothing to heal.
    expect(potionActions(state, potion).heal).toBe(0);
  });

  it('wastes the second potion of a room under the one-potion house rule', () => {
    const { seed, room } = seedFor((r) => r.some(isPotion));
    const state = dealtRoom(seed);
    const potion = room.find(isPotion)!;

    const spent = { ...state, potionsUsedThisRoom: 1 };
    const vm = potionActions(spent, potion);
    expect(vm.wasted).toBe(true);
    expect(vm.heal).toBe(0);

    // The unlimited-potions toggle lifts the waste.
    const unlimited = {
      ...spent,
      hp: 10,
      config: { ...DEFAULT_CONFIG, potionsPerRoom: 'unlimited' as const },
    };
    const free = potionActions(unlimited, potion);
    expect(free.wasted).toBe(false);
    expect(free.heal).toBe(Math.min(cardValue(potion), unlimited.maxHp - unlimited.hp));
  });
});

// ---------------------------------------------------------------------------
// Weapon actions
// ---------------------------------------------------------------------------

describe('weaponActions', () => {
  it('flags the swap warning only when a weapon is already equipped', () => {
    const { seed, room } = seedFor((r) => r.some(isWeapon));
    const state = dealtRoom(seed);
    const weapon = room.find(isWeapon)!;

    expect(weaponActions(state, weapon).swap).toBe(false);

    const armed = { ...state, weapon: C('diamond-5') };
    expect(weaponActions(armed, weapon).swap).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Carry-note gate & room progress
// ---------------------------------------------------------------------------

describe('carryNoteState', () => {
  it('is false — actions offered — while the room can still be resolved', () => {
    const { seed } = seedFor((r) => r.length === 4);
    expect(carryNoteState(dealtRoom(seed))).toBe(false);
  });

  it('is true — carry note shown — once only the carry card remains', () => {
    const carry = baseState({ room: [C('club-2')], dungeon: [C('club-3')] });
    expect(carryNoteState(carry)).toBe(true);
  });

  it('stays false in a final room until it is empty', () => {
    const finalRoom = baseState({ room: [C('club-2')], dungeon: [] });
    expect(carryNoteState(finalRoom)).toBe(false);
  });
});

describe('roomProgressKey', () => {
  it('explains the carry card for a single-card non-final room', () => {
    const single = baseState({ room: [C('club-2')], dungeon: [C('club-3')] });
    expect(roomProgressKey(single)).toBe('carrySingle');
  });

  it('tells the player to clear everything in the final room', () => {
    const finalRoom = baseState({ room: [C('club-2'), C('club-3')], dungeon: [] });
    expect(roomProgressKey(finalRoom)).toBe('carryNone');
  });

  it('uses the default hint for a freshly dealt room', () => {
    const { seed } = seedFor((r) => r.length === 4);
    expect(roomProgressKey(dealtRoom(seed))).toBe('carryDefault');
  });
});

// ---------------------------------------------------------------------------
// One seeded room, all three panels
// ---------------------------------------------------------------------------

describe('action panel over a seeded monster+weapon+potion room', () => {
  it('describes every panel of the room coherently', () => {
    const { seed, room } = seedFor(
      (r) => r.filter(isMonster).length === 1 && r.some(isWeapon) && r.some(isPotion),
    );
    const state = dealtRoom(seed);
    const monster = room.find(isMonster)!;
    const weapon = room.find(isWeapon)!;
    const potion = room.find(isPotion)!;

    // Before equipping: only barehanded is offered for the monster.
    const bare = monsterActions(state, monster);
    expect(bare.withWeaponLegal).toBe(false);
    expect(bare.withWeaponDamage).toBeNull();
    expect(bare.barehanded.legal).toBe(true);
    expect(bare.barehanded.damage).toBe(cardValue(monster));

    // Fresh weapon: no swap warning; potion heals the missing HP.
    expect(weaponActions(state, weapon).swap).toBe(false);
    expect(potionActions(state, potion).wasted).toBe(false);
    expect(potionActions(state, potion).heal).toBe(
      Math.min(cardValue(potion), state.maxHp - state.hp),
    );

    // After equipping the room's weapon, the weapon fight appears when legal.
    const equipped = reducer(state, { type: 'EquipWeapon', cardId: weapon }).state;
    const armed = monsterActions(equipped, monster);
    if (armed.withWeaponLegal) {
      expect(armed.withWeaponDamage).toBe(Math.max(0, cardValue(monster) - cardValue(weapon)));
    } else {
      // Illegal only via degradation — but the weapon was just equipped, so it
      // must be legal whenever it beats the monster.
      expect(cardValue(weapon)).toBeGreaterThan(cardValue(monster));
    }
    expect(weaponActions(equipped, weapon).swap).toBe(true);
  });
});
