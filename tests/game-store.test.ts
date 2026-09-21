import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  cardKind,
  cardValue,
  type CardId,
  type GameAction,
  type GameConfig,
  type GameState,
} from '../src/engine';
import { loadRunSave, useGameStore, type StoreResult } from '../src/store/game-store';
import { STORAGE_KEYS } from '../src/store/persistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().reset();
});

const state = () => useGameStore.getState();
const lastSeq = () => state().lastResult?.seq ?? 0;
const expectResult = (): StoreResult => {
  const lr = state().lastResult;
  if (lr === null) throw new Error('no result published');
  return lr;
};

function currentGame(): GameState {
  const game = state().game;
  if (game === null) throw new Error('no active game');
  return game;
}

/** Any legal resolve for the first room card — used to drive act() deterministically. */
function firstRoomAction(g: GameState): GameAction {
  const card = g.room[0] as CardId;
  const kind = cardKind(card);
  if (kind === 'monster') return { type: 'FightMonster', cardId: card, barehanded: true };
  if (kind === 'weapon') return { type: 'EquipWeapon', cardId: card };
  return { type: 'DrinkPotion', cardId: card };
}

const act = (action: GameAction) => useGameStore.getState().act(action);

/** Suicide run: barehanded-fight every monster until the GameLost substitution fires. */
function fightToDeath(): void {
  let guard = 0;
  while (currentGame().phase === 'playing' && guard++ < 300) {
    const g = currentGame();
    if (g.room.length === 0) {
      act({ type: 'DealRoom' });
      continue;
    }
    if (g.room.length === 1 && g.dungeon.length > 0) {
      act({ type: 'EnterNextRoom' });
      continue;
    }
    const monster = g.room.find((c) => cardKind(c) === 'monster');
    if (monster !== undefined) {
      act({ type: 'FightMonster', cardId: monster, barehanded: true });
      continue;
    }
    const other = g.room.find((c) => cardKind(c) !== 'monster');
    if (other === undefined) throw new Error('unresolvable room');
    act(
      cardKind(other) === 'weapon'
        ? { type: 'EquipWeapon', cardId: other }
        : { type: 'DrinkPotion', cardId: other },
    );
  }
  if (currentGame().phase !== 'lost') throw new Error('run did not end in a loss');
}

/**
 * Conservative play under the lenient config: heal every chance, upgrade
 * weapons, weapon-fight the biggest monster, flee unwinnable rooms before
 * engaging. Achieves a win on roughly a quarter of seeds, which the search in
 * the GameWon test exploits.
 */
function actGreedy(): void {
  let guard = 0;
  while (currentGame().phase === 'playing' && guard++ < 1000) {
    const g = currentGame();
    if (g.room.length === 0) {
      act({ type: 'DealRoom' });
      continue;
    }
    if (g.room.length === 1 && g.dungeon.length > 0) {
      act({ type: 'EnterNextRoom' });
      continue;
    }
    const monsters = g.room
      .filter((c) => cardKind(c) === 'monster')
      .sort((a, b) => cardValue(b) - cardValue(a));
    const potion = g.room.find((c) => cardKind(c) === 'potion');
    // Heal whenever possible (unlimited potions): damage budget is the constraint.
    if (g.hp < g.maxHp && potion !== undefined) {
      act({ type: 'DrinkPotion', cardId: potion });
      continue;
    }
    // Equip a strictly better weapon.
    const better = g.room
      .filter((c) => cardKind(c) === 'weapon')
      .sort((a, b) => cardValue(b) - cardValue(a))
      .find((c) => g.weapon === null || cardValue(c) > cardValue(g.weapon!));
    if (better !== undefined) {
      act({ type: 'EquipWeapon', cardId: better });
      continue;
    }
    const smallest = monsters[monsters.length - 1];
    // Hunt for a weapon/potions when hurting or unarmed: flee before engaging.
    const shouldFlee =
      (g.hp <= 6 && potion === undefined) ||
      (g.weapon === null && monsters.length > 0 && cardValue(smallest!) > 5);
    if (shouldFlee && g.resolvedCount === 0) {
      act({ type: 'RunAway' });
      continue;
    }
    if (g.weapon !== null && monsters.length > 0) {
      act({ type: 'FightMonster', cardId: monsters[0]! });
      continue;
    }
    if (smallest !== undefined) {
      act({ type: 'FightMonster', cardId: smallest, barehanded: true });
      continue;
    }
    const other = g.room.find((c) => cardKind(c) !== 'monster');
    if (other === undefined) throw new Error('unresolvable room');
    act(
      cardKind(other) === 'weapon'
        ? { type: 'EquipWeapon', cardId: other }
        : { type: 'DrinkPotion', cardId: other },
    );
  }
}

// ---------------------------------------------------------------------------
// Result channel
// ---------------------------------------------------------------------------

describe('store result channel (lastResult)', () => {
  it('is null on a pristine store', () => {
    expect(state().lastResult).toBeNull();
  });

  it('startRun publishes the DealRoom result (RunStarted never reaches the store)', () => {
    const before = lastSeq();
    useGameStore.getState().startRun('seq-start', DEFAULT_CONFIG);
    const lr = expectResult();
    expect(lr.result.type).toBe('RoomDealt');
    expect(lr.result).toMatchObject({ cards: currentGame().room, carriedFrom: null });
    expect(lr.seq).toBe(before + 1);
  });

  it('act() publishes every result with a monotonically increasing seq', () => {
    useGameStore.getState().startRun('t0', DEFAULT_CONFIG);
    let prev = lastSeq();

    act(firstRoomAction(currentGame()));
    const afterResolve = expectResult();
    expect(afterResolve.seq).toBe(prev + 1);
    prev = afterResolve.seq;

    act({ type: 'UndoToRoomStart' });
    const afterUndo = expectResult();
    expect(afterUndo.result.type).toBe('UndoDone');
    expect(afterUndo.seq).toBe(prev + 1);
  });

  it('publishes RunAwayBlocked no-op results with an unchanged state', () => {
    useGameStore.getState().startRun('t0', DEFAULT_CONFIG);
    act({ type: 'RunAway' }); // legal: fresh room, nothing resolved
    expect(expectResult().result.type).toBe('RanAway');

    const before = lastSeq();
    const gameBefore = state().game;
    act({ type: 'RunAway' }); // twice in a row → blocked
    const lr = expectResult();
    expect(lr.result).toEqual({ type: 'RunAwayBlocked', reason: 'twice-in-a-row' });
    expect(state().game).toBe(gameBefore); // no-op: identical state object
    expect(lr.seq).toBe(before + 1);
  });

  it('publishes InvalidAction no-op results', () => {
    useGameStore.getState().startRun('t0', DEFAULT_CONFIG);
    const before = lastSeq();
    act({ type: 'EnterNextRoom' }); // room not resolved down to one yet
    const lr = expectResult();
    expect(lr.result).toEqual({ type: 'InvalidAction', reason: 'room-not-resolved' });
    expect(lr.seq).toBe(before + 1);
  });

  it('publishes the substituted GameLost terminal result', () => {
    const before = lastSeq();
    useGameStore.getState().startRun('t0', DEFAULT_CONFIG);
    fightToDeath();
    const lr = expectResult();
    expect(lr.result.type).toBe('GameLost');
    expect(lr.result).toMatchObject({ seed: 't0', config: DEFAULT_CONFIG });
    expect(currentGame().phase).toBe('lost');
    expect(lr.seq).toBeGreaterThan(before);
  });

  it('publishes the substituted GameWon terminal result', () => {
    // Wins are seed-luck under the canonical rules (weapon degradation forces
    // strictly-descending kill chains), so the search runs under a lenient
    // config; the terminal-substitution behavior under test is config-neutral.
    const lenient: GameConfig = {
      runAwayMode: 'unlimited',
      potionsPerRoom: 'unlimited',
      weaponDegradation: false,
    };
    for (let i = 0; i < 60; i++) {
      useGameStore.getState().reset();
      const seed = `win${i}`;
      useGameStore.getState().startRun(seed, lenient);
      actGreedy();
      if (currentGame().phase !== 'won') continue;
      const lr = expectResult();
      expect(lr.result.type).toBe('GameWon');
      expect(lr.result).toMatchObject({ seed, config: lenient });
      expect(lr.seq).toBeGreaterThan(0);
      return;
    }
    throw new Error('no winning seed found in 60 attempts');
  });

  it('is not persisted in the run shard', () => {
    useGameStore.getState().startRun('persist', DEFAULT_CONFIG);
    act(firstRoomAction(currentGame()));
    act({ type: 'UndoToRoomStart' });

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.run)!);
    expect(raw.data).not.toHaveProperty('lastResult');
    const saved = loadRunSave();
    expect(saved).not.toBeNull();
    expect(saved!).not.toHaveProperty('lastResult');
  });

  it('seq continues across reset + hydrate within a session (never resets)', () => {
    useGameStore.getState().startRun('hydrate-seq', DEFAULT_CONFIG);
    act(firstRoomAction(currentGame()));
    const seqBefore = lastSeq();
    expect(seqBefore).toBeGreaterThan(0);

    // Reset clears the channel but NOT the seq counter; hydrate then restores
    // the run from storage and the next publication continues the sequence.
    useGameStore.getState().reset();
    expect(state().lastResult).toBeNull();
    useGameStore.getState().hydrate();
    expect(currentGame().seed).toBe('hydrate-seq');
    expect(state().lastResult).toBeNull(); // hydrate publishes nothing

    act(firstRoomAction(currentGame()));
    expect(lastSeq()).toBeGreaterThan(seqBefore);
  });

  it('hydrate does not clobber a run already started in memory', () => {
    useGameStore.getState().startRun('url-run', DEFAULT_CONFIG);
    const before = currentGame();
    useGameStore.getState().hydrate();
    expect(state().game).toBe(before);
  });
});
