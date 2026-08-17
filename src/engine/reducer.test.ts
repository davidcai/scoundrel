import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  canFightWithWeapon,
  canRunAway,
  createInitialState,
  fightDamage,
  isFinalRoom,
  reducer,
  resolveLimit,
} from './reducer';
import type { GameConfig, GameState } from './types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'test',
    config: { ...DEFAULT_CONFIG },
    phase: 'playing',
    hp: 20,
    maxHp: 20,
    dungeon: ['club-6', 'club-7', 'club-8', 'club-9'],
    room: [],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 0,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 0 },
    startedAt: 0,
    roomSnapshot: null,
    ...overrides,
  };
}

const FOUR = ['club-2', 'club-3', 'club-4', 'heart-5'];

describe('createInitialState', () => {
  it('deals the first 4-card room', () => {
    const s = createInitialState('abc', DEFAULT_CONFIG, 0);
    expect(s.phase).toBe('playing');
    expect(s.hp).toBe(20);
    expect(s.room).toHaveLength(4);
    expect(s.dungeon).toHaveLength(40);
    expect(s.roomSnapshot).not.toBeNull();
    expect(s.runHighlights.roomsExplored).toBe(1);
  });

  it('is deterministic for a fixed seed', () => {
    const a = createInitialState('same', DEFAULT_CONFIG, 0);
    const b = createInitialState('same', DEFAULT_CONFIG, 0);
    expect(a.dungeon).toEqual(b.dungeon);
    expect(a.room).toEqual(b.room);
  });
});

describe('FightMonster', () => {
  it('fights barehanded taking full damage', () => {
    const s = makeState({ room: ['club-10', 'heart-2', 'diamond-3', 'spade-4'] });
    const { state, result } = reducer(s, { type: 'FightMonster', cardId: 'club-10', barehanded: true });
    expect(result).toMatchObject({ type: 'MonsterDefeated', damage: 10 });
    expect(state.hp).toBe(10);
    expect(state.resolvedCount).toBe(1);
    expect(state.room).not.toContain('club-10');
    expect(state.killStack).toEqual([]);
    expect(state.runHighlights.monstersKilled).toBe(1);
  });

  it('fights with a weapon taking the difference', () => {
    const s = makeState({ room: ['club-8'], weapon: 'diamond-5' });
    const { state, result } = reducer(s, { type: 'FightMonster', cardId: 'club-8', barehanded: false });
    expect(result).toMatchObject({ type: 'MonsterDefeated', damage: 3, usedWeaponId: 'diamond-5' });
    expect(state.hp).toBe(17);
    expect(state.killStack).toEqual(['club-8']);
  });

  it('takes zero damage when the weapon nullifies the monster', () => {
    const s = makeState({ room: ['club-3'], weapon: 'diamond-5' });
    const { state } = reducer(s, { type: 'FightMonster', cardId: 'club-3', barehanded: false });
    expect(state.hp).toBe(20);
  });

  it('allows barehanded even with a weapon equipped', () => {
    const s = makeState({ room: ['club-8'], weapon: 'diamond-5', killStack: ['club-9'] });
    const { state, result } = reducer(s, { type: 'FightMonster', cardId: 'club-8', barehanded: true });
    expect(result).toMatchObject({ damage: 8 });
    expect(state.killStack).toEqual(['club-9']);
  });

  it('blocks fighting a monster that is not strictly weaker than the last kill', () => {
    const s = makeState({ room: ['club-10', 'club-5'], weapon: 'diamond-3', killStack: ['club-9'] });
    const blocked = reducer(s, { type: 'FightMonster', cardId: 'club-10', barehanded: false });
    expect(blocked.result).toEqual({ type: 'InvalidAction', reason: 'weapon-degraded' });
    const ok = reducer(s, { type: 'FightMonster', cardId: 'club-5', barehanded: false });
    expect(ok.result.type).toBe('MonsterDefeated');
  });

  it('ignores degradation when the toggle is off', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, weaponDegradation: false };
    const s = makeState({ config, room: ['club-10'], weapon: 'diamond-3', killStack: ['club-9'] });
    const { result } = reducer(s, { type: 'FightMonster', cardId: 'club-10', barehanded: false });
    expect(result.type).toBe('MonsterDefeated');
  });

  it('rejects non-monster cards', () => {
    const s = makeState({ room: ['diamond-5'] });
    expect(reducer(s, { type: 'FightMonster', cardId: 'diamond-5' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-a-monster',
    });
  });
});

describe('EquipWeapon', () => {
  it('discards the old weapon and its kill stack', () => {
    const s = makeState({ room: ['diamond-7'], weapon: 'diamond-2', killStack: ['club-5', 'club-4'] });
    const { state, result } = reducer(s, { type: 'EquipWeapon', cardId: 'diamond-7' });
    expect(result).toMatchObject({
      type: 'WeaponEquipped',
      discardedWeaponId: 'diamond-2',
      discardedMonsterIds: ['club-5', 'club-4'],
    });
    expect(state.weapon).toBe('diamond-7');
    expect(state.killStack).toEqual([]);
  });

  it('rejects a non-weapon card', () => {
    const s = makeState({ room: ['heart-2'] });
    expect(reducer(s, { type: 'EquipWeapon', cardId: 'heart-2' }).result.type).toBe('InvalidAction');
  });
});

describe('DrinkPotion', () => {
  it('heals and caps at max HP', () => {
    const s = makeState({ room: ['heart-10'], hp: 15 });
    const { state, result } = reducer(s, { type: 'DrinkPotion', cardId: 'heart-10' });
    expect(result).toMatchObject({ type: 'PotionQuaffed', healed: 5, wasted: false });
    expect(state.hp).toBe(20);
  });

  it('wastes a second potion in the same room by default', () => {
    const s = makeState({ room: ['heart-3'], hp: 10, potionsUsedThisRoom: 1 });
    const { state, result } = reducer(s, { type: 'DrinkPotion', cardId: 'heart-3' });
    expect(result).toMatchObject({ type: 'PotionQuaffed', healed: 0, wasted: true });
    expect(state.hp).toBe(10);
    expect(state.runHighlights.potionsWasted).toBe(1);
  });

  it('allows unlimited potions when configured', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, potionsPerRoom: Infinity };
    const s = makeState({ config, room: ['heart-2'], hp: 10, potionsUsedThisRoom: 5 });
    const { result } = reducer(s, { type: 'DrinkPotion', cardId: 'heart-2' });
    expect(result).toMatchObject({ healed: 2, wasted: false });
  });
});

describe('RunAway', () => {
  it('sends the room to the bottom and deals a new room', () => {
    const s = makeState({
      room: FOUR,
      dungeon: ['heart-2', 'heart-3', 'heart-4', 'heart-6', 'heart-7', 'heart-8'],
    });
    const { state, result } = reducer(s, { type: 'RunAway' });
    expect(result.type).toBe('RanAway');
    expect(state.room).toHaveLength(4);
    expect(state.ranAwayLastRoom).toBe(true);
    expect(state.dungeon.slice(-4)).toEqual(FOUR);
  });

  it('blocks running from two rooms in a row', () => {
    const s = makeState({
      room: FOUR,
      dungeon: ['heart-2', 'heart-3', 'heart-4', 'heart-6', 'heart-7', 'heart-8'],
      ranAwayLastRoom: true,
    });
    const { state, result } = reducer(s, { type: 'RunAway' });
    expect(result).toEqual({ type: 'RunAwayBlocked', reason: 'twice-in-row' });
    expect(state).toBe(s);
  });

  it('allows consecutive runs in unlimited mode', () => {
    const config: GameConfig = { ...DEFAULT_CONFIG, runAwayMode: 'unlimited' };
    const s = makeState({
      config,
      room: FOUR,
      dungeon: ['heart-2', 'heart-3', 'heart-4', 'heart-6', 'heart-7', 'heart-8'],
      ranAwayLastRoom: true,
    });
    expect(reducer(s, { type: 'RunAway' }).result.type).toBe('RanAway');
  });

  it('blocks running when fewer than 4 cards remain in the deck', () => {
    const s = makeState({ room: FOUR, dungeon: ['heart-2', 'heart-3', 'heart-4'] });
    expect(reducer(s, { type: 'RunAway' }).result).toEqual({
      type: 'RunAwayBlocked',
      reason: 'no-cards',
    });
  });
});

describe('EnterNextRoom', () => {
  it('carries the unresolved card into the next room', () => {
    const s = makeState({
      room: FOUR,
      resolvedCount: 3,
      dungeon: ['diamond-2', 'diamond-3', 'diamond-4', 'diamond-5'],
    });
    const { state, result } = reducer(s, { type: 'EnterNextRoom' });
    expect(result.type).toBe('RoomDealt');
    if (result.type === 'RoomDealt') {
      expect(result.carriedFrom).toEqual(['heart-5']);
    }
    expect(state.room).toEqual(['heart-5', 'diamond-2', 'diamond-3', 'diamond-4']);
    expect(state.dungeon).toEqual(['diamond-5']);
    expect(state.resolvedCount).toBe(0);
    expect(state.ranAwayLastRoom).toBe(false);
  });

  it('blocks entering the next room before resolving three cards', () => {
    const s = makeState({ room: FOUR, resolvedCount: 2, dungeon: ['a', 'b', 'c', 'd'] });
    expect(reducer(s, { type: 'EnterNextRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-resolved',
    });
  });

  it('blocks entering the next room from a final room', () => {
    const s = makeState({ room: FOUR, resolvedCount: 3, dungeon: [] });
    expect(reducer(s, { type: 'EnterNextRoom' }).result).toEqual({
      type: 'InvalidAction',
      reason: 'no-next-room',
    });
  });
});

describe('UndoToRoomStart', () => {
  it('restores HP, room, resolved count, and highlights', () => {
    const snap = makeState({ room: ['club-8', 'heart-2', 'diamond-3', 'spade-4'], dungeon: ['club-2'] });
    const s = makeState({
      room: ['heart-2', 'diamond-3', 'spade-4'],
      resolvedCount: 1,
      hp: 12,
      dungeon: ['club-2'],
      roomSnapshot: snap,
      runHighlights: { monstersKilled: 1, potionsWasted: 0, roomsExplored: 1 },
    });
    const { state, result } = reducer(s, { type: 'UndoToRoomStart' });
    expect(result.type).toBe('UndoDone');
    expect(state.hp).toBe(20);
    expect(state.room).toEqual(['club-8', 'heart-2', 'diamond-3', 'spade-4']);
    expect(state.resolvedCount).toBe(0);
    expect(state.runHighlights.monstersKilled).toBe(0);
    expect(state.roomSnapshot).not.toBeNull();
  });
});

describe('win/lose', () => {
  it('loses when HP drops to 0 and scores 0 minus remaining monsters in the dungeon', () => {
    const s = makeState({ room: ['club-10'], hp: 5, dungeon: ['spade-3', 'heart-2', 'club-4'] });
    const { state, result } = reducer(s, { type: 'FightMonster', cardId: 'club-10', barehanded: true });
    expect(state.phase).toBe('lost');
    expect(result.type).toBe('GameLost');
    expect((result as { score: number }).score).toBe(-7);
  });

  it('wins a single-card final room and scores remaining HP', () => {
    const s = makeState({ room: ['club-3'], dungeon: [], hp: 14 });
    const { state, result } = reducer(s, { type: 'FightMonster', cardId: 'club-3', barehanded: true });
    expect(state.phase).toBe('won');
    expect(result.type).toBe('GameWon');
    expect((result as { score: number }).score).toBe(11);
  });
});

describe('final rooms of size 4/3/2/1', () => {
  it('resolves all cards (no carryover) in a 2-card final room', () => {
    const s = makeState({ room: ['club-5', 'heart-2'], dungeon: [] });
    expect(resolveLimit(s)).toBe(2);
    const afterPotion = reducer(s, { type: 'DrinkPotion', cardId: 'heart-2' });
    expect(afterPotion.state.resolvedCount).toBe(1);
    const afterFight = reducer(afterPotion.state, { type: 'FightMonster', cardId: 'club-5', barehanded: true });
    expect(afterFight.result.type).toBe('GameWon');
  });

  it('allows resolving all 4 cards when the final room is a full 4', () => {
    const s = makeState({ room: ['heart-2', 'club-3', 'diamond-4', 'club-5'], dungeon: [] });
    expect(resolveLimit(s)).toBe(4);
    let cur = s;
    for (const id of ['heart-2', 'diamond-4', 'club-3']) {
      if (id === 'heart-2') cur = reducer(cur, { type: 'DrinkPotion', cardId: id }).state;
      else if (id === 'diamond-4') cur = reducer(cur, { type: 'EquipWeapon', cardId: id }).state;
      else cur = reducer(cur, { type: 'FightMonster', cardId: id, barehanded: true }).state;
    }
    expect(cur.resolvedCount).toBe(3);
    expect(cur.phase).toBe('playing');
    const last = reducer(cur, { type: 'FightMonster', cardId: 'club-5', barehanded: true });
    expect(last.result.type).toBe('GameWon');
  });

  it('caps a non-final room at 3 resolutions', () => {
    const s = makeState({
      room: ['club-2', 'club-3', 'club-4', 'club-5'],
      dungeon: ['x', 'y', 'z', 'w'],
      resolvedCount: 3,
    });
    expect(resolveLimit(s)).toBe(3);
    expect(reducer(s, { type: 'FightMonster', cardId: 'club-5', barehanded: true }).result).toEqual({
      type: 'InvalidAction',
      reason: 'room-resolved',
    });
  });
});

describe('UI queries', () => {
  it('computes fight damage for both modes', () => {
    const s = makeState({ weapon: 'diamond-5' });
    expect(fightDamage(s, 'club-8', false)).toBe(3);
    expect(fightDamage(s, 'club-8', true)).toBe(8);
  });

  it('reports weapon legality under degradation', () => {
    const degraded = makeState({ weapon: 'diamond-3', killStack: ['club-9'] });
    expect(canFightWithWeapon(degraded, 'club-5')).toBe(true);
    expect(canFightWithWeapon(degraded, 'club-9')).toBe(false);
    const fresh = makeState({ weapon: 'diamond-3' });
    expect(canFightWithWeapon(fresh, 'club-a')).toBe(true);
  });

  it('gates run-away', () => {
    expect(canRunAway(makeState({ room: FOUR, dungeon: ['a', 'b', 'c', 'd'] })).can).toBe(true);
    expect(canRunAway(makeState({ room: FOUR, dungeon: ['a', 'b', 'c', 'd'], ranAwayLastRoom: true })).reason).toBe(
      'twice-in-row',
    );
    expect(canRunAway(makeState({ room: FOUR, dungeon: [] })).reason).toBe('no-cards');
  });

  it('detects final rooms', () => {
    expect(isFinalRoom(makeState({ dungeon: [] }))).toBe(true);
    expect(isFinalRoom(makeState({ dungeon: ['club-2'] }))).toBe(false);
  });
});
