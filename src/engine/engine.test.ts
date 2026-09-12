import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  type CardId,
  type GameAction,
  type GameConfig,
  type GameResult,
  type GameState,
} from './index';
import {
  buildDeck,
  cardAriaLabel,
  cardLabel,
  cardValue,
  createInitialState,
  isFinalRoom,
  previewFight,
  reducer,
  roomResolveTarget,
  runAwayStatus,
  weaponThreshold,
} from './index';

// ---------------------------------------------------------------------------
// Helpers — everything goes through the public reducer API.
//
// Crafted fixtures keep the engine's room semantics honest: a room with an
// empty dungeon after the deal is a FINAL room (resolve all), while a non-final
// room must resolve only 3 of its 4 cards. Non-final fixtures therefore carry
// a non-empty dungeon tail.
// ---------------------------------------------------------------------------

const CONFIG: GameConfig = { ...DEFAULT_CONFIG };

function baseState(overrides: Partial<GameState> = {}, seed = 'seed1'): GameState {
  return { ...createInitialState(seed, CONFIG, 0), ...overrides };
}

/** Deal a room from a crafted dungeon. */
function dealFrom(dungeon: CardId[], overrides: Partial<GameState> = {}) {
  return reducer(baseState({ dungeon, ...overrides }), { type: 'DealRoom' });
}

function dispatch(
  state: GameState,
  ...actions: GameAction[]
): { state: GameState; result: GameResult } {
  let current = state;
  let last: { state: GameState; result: GameResult } = { state, result: { type: 'UndoDone' } };
  for (const action of actions) {
    last = reducer(current, action);
    current = last.state;
  }
  return last;
}

const C = (id: string) => id as CardId;

// ---------------------------------------------------------------------------
// Deck & cards
// ---------------------------------------------------------------------------

describe('deck composition', () => {
  it('builds the 44-card Scoundrel deck', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(44);
    for (const suit of ['club', 'spade'] as const) {
      const suitCards = deck.filter((c) => c.startsWith(`${suit}-`));
      expect(suitCards).toHaveLength(13);
      for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a']) {
        expect(deck).toContain(`${suit}-${rank}`);
      }
    }
    for (const suit of ['diamond', 'heart'] as const) {
      const suitCards = deck.filter((c) => c.startsWith(`${suit}-`));
      expect(suitCards).toHaveLength(9);
      for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10']) {
        expect(deck).toContain(`${suit}-${rank}`);
      }
    }
    // Red face cards and red aces removed.
    expect(deck).not.toContain('heart-j');
    expect(deck).not.toContain('heart-q');
    expect(deck).not.toContain('heart-k');
    expect(deck).not.toContain('heart-a');
    expect(deck).not.toContain('diamond-j');
    expect(deck).not.toContain('diamond-a');
  });

  it('assigns face cards their values', () => {
    expect(cardValue(C('club-j'))).toBe(11);
    expect(cardValue(C('spade-q'))).toBe(12);
    expect(cardValue(C('club-k'))).toBe(13);
    expect(cardValue(C('spade-a'))).toBe(14);
    expect(cardValue(C('heart-10'))).toBe(10);
  });

  it('labels cards for screen readers', () => {
    expect(cardAriaLabel(C('club-8'))).toBe('8 of Clubs, monster, value 8');
    expect(cardLabel(C('diamond-5'))).toBe('5 of Diamonds');
    expect(cardLabel(C('spade-k'))).toBe('King of Spades');
  });
});

// ---------------------------------------------------------------------------
// Seeded determinism
// ---------------------------------------------------------------------------

describe('seeded determinism', () => {
  it('produces identical dungeons for the same seed', () => {
    const a = createInitialState('abc123', CONFIG);
    const b = createInitialState('abc123', CONFIG);
    expect(a.dungeon).toEqual(b.dungeon);
    expect(a.seed).toBe('abc123');
  });

  it('produces different dungeons for different seeds', () => {
    const a = createInitialState('abc123', CONFIG);
    const b = createInitialState('zzz999', CONFIG);
    expect(a.dungeon).not.toEqual(b.dungeon);
  });

  it('normalizes seed case so replays match', () => {
    const a = createInitialState('ABC123', CONFIG);
    const b = createInitialState('abc123', CONFIG);
    expect(a.dungeon).toEqual(b.dungeon);
    expect(a.seed).toBe('abc123');
  });

  it('hashes non-base36 seeds deterministically', () => {
    const a = createInitialState('my-run-#42', CONFIG);
    const b = createInitialState('my-run-#42', CONFIG);
    expect(a.dungeon).toEqual(b.dungeon);
  });

  it('starts each run with 20 hp and an empty room', () => {
    const s = createInitialState('abc', CONFIG, 1234);
    expect(s.hp).toBe(20);
    expect(s.maxHp).toBe(20);
    expect(s.room).toEqual([]);
    expect(s.phase).toBe('playing');
    expect(s.startedAt).toBe(1234);
    expect(s.dungeon).toHaveLength(44);
    expect(s.roomSnapshot).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dealing rooms
// ---------------------------------------------------------------------------

describe('DealRoom', () => {
  it('deals the top 4 cards from the dungeon', () => {
    const dungeon: CardId[] = [
      C('club-2'),
      C('heart-3'),
      C('diamond-4'),
      C('spade-5'),
      C('club-6'),
      C('heart-7'),
    ];
    const { state, result } = dealFrom(dungeon);
    expect(result).toEqual({
      type: 'RoomDealt',
      cards: ['club-2', 'heart-3', 'diamond-4', 'spade-5'],
      carriedFrom: null,
    });
    expect(state.room).toEqual(['club-2', 'heart-3', 'diamond-4', 'spade-5']);
    expect(state.dungeon).toEqual(['club-6', 'heart-7']);
    expect(state.resolvedCount).toBe(0);
    expect(state.turnCount).toBe(1);
  });

  it('deals fewer than 4 when the dungeon is running out', () => {
    const { state, result } = dealFrom([C('club-2'), C('heart-3')]);
    expect(result.type).toBe('RoomDealt');
    if (result.type === 'RoomDealt') {
      expect(result.cards).toEqual(['club-2', 'heart-3']);
    }
    expect(state.room).toEqual(['club-2', 'heart-3']);
    expect(state.dungeon).toEqual([]);
    expect(isFinalRoom(state)).toBe(true);
  });

  it('rejects a second deal while a room is active', () => {
    const dealt = dealFrom([C('club-2'), C('heart-3'), C('diamond-4'), C('spade-5'), C('club-6')]);
    const { state, result } = reducer(dealt.state, { type: 'DealRoom' });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'room-active' });
    expect(state).toBe(dealt.state);
  });

  it('snapshots the room at its start for undo', () => {
    const { state } = dealFrom([
      C('club-2'),
      C('heart-3'),
      C('diamond-4'),
      C('spade-5'),
      C('club-6'),
    ]);
    expect(state.roomSnapshot).not.toBeNull();
    expect(state.roomSnapshot?.room).toEqual(state.room);
    expect(state.roomSnapshot?.roomSnapshot).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

describe('FightMonster', () => {
  const fourCardRoom = (hp = 20, weapon: CardId | null = null) =>
    baseState({
      room: [C('club-8'), C('heart-2'), C('diamond-3'), C('spade-4')],
      dungeon: [C('club-10')],
      hp,
      weapon,
    });

  it('takes full damage barehanded and discards the monster', () => {
    const { state, result } = dispatch(fourCardRoom(), {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    expect(result).toEqual({
      type: 'MonsterDefeated',
      cardId: 'club-8',
      damage: 8,
      usedWeaponId: null,
      weaponBroke: false,
    });
    expect(state.hp).toBe(12);
    expect(state.room).not.toContain('club-8');
    expect(state.killStack).toEqual([]);
    expect(state.runHighlights.monstersKilled).toBe(1);
  });

  it('takes the difference when fighting with a weapon', () => {
    const { state, result } = dispatch(fourCardRoom(20, C('diamond-5')), {
      type: 'FightMonster',
      cardId: C('club-8'),
    });
    expect(result).toEqual({
      type: 'MonsterDefeated',
      cardId: 'club-8',
      damage: 3,
      usedWeaponId: 'diamond-5',
      weaponBroke: false,
    });
    expect(state.hp).toBe(17);
    expect(state.killStack).toEqual(['club-8']);
  });

  it('nullifies monsters weaker than the weapon (max(0, m − w))', () => {
    const { state, result } = dispatch(fourCardRoom(20, C('diamond-9')), {
      type: 'FightMonster',
      cardId: C('club-8'),
    });
    expect(result.type).toBe('MonsterDefeated');
    if (result.type === 'MonsterDefeated') expect(result.damage).toBe(0);
    expect(state.hp).toBe(20);
    expect(state.killStack).toEqual(['club-8']);
  });

  it('allows fighting barehanded even with a weapon equipped', () => {
    const { state, result } = dispatch(fourCardRoom(20, C('diamond-5')), {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    expect(result.type).toBe('MonsterDefeated');
    if (result.type === 'MonsterDefeated') {
      expect(result.damage).toBe(8);
      expect(result.usedWeaponId).toBeNull();
    }
    expect(state.hp).toBe(12);
    expect(state.killStack).toEqual([]);
    expect(state.weapon).toBe('diamond-5');
  });

  it('rejects fighting a non-monster or a card not in the room', () => {
    const s = fourCardRoom();
    expect(dispatch(s, { type: 'FightMonster', cardId: C('heart-2') }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-a-monster',
    });
    expect(dispatch(s, { type: 'FightMonster', cardId: C('club-9') }).result).toEqual({
      type: 'InvalidAction',
      reason: 'not-in-room',
    });
  });
});

describe('weapon degradation', () => {
  const degraded = () =>
    baseState({
      room: [C('club-9'), C('heart-2')],
      dungeon: [C('club-10')],
      weapon: C('diamond-10'),
      killStack: [C('club-8')],
    });

  it('blocks monsters stronger than or equal to the last kill', () => {
    const { result } = dispatch(degraded(), { type: 'FightMonster', cardId: C('club-9') });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'weapon-too-weak' });
    expect(previewFight(degraded(), C('club-9'), false).legal).toBe(false);
  });

  it('allows strictly weaker monsters', () => {
    const s = baseState({
      room: [C('club-7'), C('heart-2')],
      dungeon: [C('club-10')],
      weapon: C('diamond-10'),
      killStack: [C('club-8')],
    });
    const { state, result } = dispatch(s, { type: 'FightMonster', cardId: C('club-7') });
    expect(result.type).toBe('MonsterDefeated');
    expect(state.killStack).toEqual(['club-8', 'club-7']);
  });

  it('exposes the threshold via weaponThreshold', () => {
    expect(weaponThreshold(degraded())).toBe(7); // last kill 8 → must be < 8
  });

  it('chains degradation across kills — each kill lowers the threshold', () => {
    // Weapon killed the Ace of Spades (14), then a 10 in a later resolution.
    const s = baseState({
      room: [C('spade-10'), C('spade-j'), C('heart-2'), C('spade-4')],
      dungeon: [C('club-2')],
      weapon: C('diamond-6'),
      killStack: [C('spade-a')],
    });
    const after = dispatch(s, { type: 'FightMonster', cardId: C('spade-10') });
    expect(after.state.killStack).toEqual(['spade-a', 'spade-10']);
    // The Jack (11) is stronger than the LAST kill (10) — blocked, even though
    // the earlier Ace was stronger. Killing ANY monster with the weapon —
    // including weak 0-damage kills — resets the threshold below it.
    expect(previewFight(after.state, C('spade-j'), false).legal).toBe(false);
    expect(weaponThreshold(after.state)).toBe(9);
  });

  it('is lifted by the config toggle', () => {
    const s = {
      ...degraded(),
      config: { ...CONFIG, weaponDegradation: false },
    };
    const { state, result } = dispatch(s, { type: 'FightMonster', cardId: C('club-9') });
    expect(result.type).toBe('MonsterDefeated');
    expect(state.hp).toBe(20);
    expect(weaponThreshold(s)).toBeNull();
  });
});

describe('EquipWeapon', () => {
  it('equips a fresh weapon', () => {
    const s = baseState({
      room: [C('diamond-5'), C('club-2'), C('heart-3'), C('spade-4')],
      dungeon: [C('club-10')],
    });
    const { state, result } = dispatch(s, { type: 'EquipWeapon', cardId: C('diamond-5') });
    expect(result).toEqual({
      type: 'WeaponEquipped',
      cardId: 'diamond-5',
      discardedWeaponId: null,
      discardedMonsterIds: [],
    });
    expect(state.weapon).toBe('diamond-5');
    expect(state.killStack).toEqual([]);
    expect(state.room).not.toContain('diamond-5');
  });

  it('discards the old weapon and its entire kill stack on swap', () => {
    const s = baseState({
      room: [C('diamond-7'), C('club-2'), C('heart-3'), C('spade-4')],
      dungeon: [C('club-10')],
      weapon: C('diamond-5'),
      killStack: [C('club-3'), C('club-2')],
    });
    const { state, result } = dispatch(s, { type: 'EquipWeapon', cardId: C('diamond-7') });
    expect(result).toEqual({
      type: 'WeaponEquipped',
      cardId: 'diamond-7',
      discardedWeaponId: 'diamond-5',
      discardedMonsterIds: ['club-3', 'club-2'],
    });
    expect(state.weapon).toBe('diamond-7');
    expect(state.killStack).toEqual([]);
  });

  it('rejects equipping non-diamonds', () => {
    const s = baseState({
      room: [C('heart-3'), C('club-2'), C('spade-4'), C('spade-5')],
      dungeon: [C('club-10')],
    });
    const { result } = dispatch(s, { type: 'EquipWeapon', cardId: C('heart-3') });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'not-a-weapon' });
  });
});

// ---------------------------------------------------------------------------
// Potions
// ---------------------------------------------------------------------------

describe('DrinkPotion', () => {
  const fourCardRoom = (overrides: Partial<GameState> = {}) =>
    baseState({
      room: [C('heart-9'), C('club-2'), C('diamond-5'), C('spade-4')],
      dungeon: [C('club-10')],
      ...overrides,
    });

  it('heals up to the cap of 20', () => {
    const { state, result } = dispatch(fourCardRoom({ hp: 15 }), {
      type: 'DrinkPotion',
      cardId: C('heart-9'),
    });
    expect(result).toEqual({ type: 'PotionQuaffed', cardId: 'heart-9', healed: 5, wasted: false });
    expect(state.hp).toBe(20);
  });

  it('wastes the second potion in the same room but still resolves it', () => {
    const { state, result } = dispatch(fourCardRoom({ hp: 10, potionsUsedThisRoom: 1 }), {
      type: 'DrinkPotion',
      cardId: C('heart-9'),
    });
    expect(result).toEqual({ type: 'PotionQuaffed', cardId: 'heart-9', healed: 0, wasted: true });
    expect(state.hp).toBe(10);
    expect(state.room).not.toContain('heart-9');
    expect(state.runHighlights.potionsWasted).toBe(1);
  });

  it('resets the potion counter when entering the next room', () => {
    const { state } = dispatch(
      fourCardRoom({ hp: 10, dungeon: [C('heart-2'), C('heart-3'), C('club-10')] }),
      { type: 'DrinkPotion', cardId: C('heart-9') },
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'FightMonster', cardId: C('club-2') },
      { type: 'EnterNextRoom' },
    );
    expect(state.potionsUsedThisRoom).toBe(0);
    // The carried card + fresh dungeon cards form the new room; a heart heals again.
    expect(state.carriedCardId).toBe('spade-4');
    const hearts = state.room.filter((c) => c.startsWith('heart-'));
    expect(hearts.length).toBeGreaterThan(0);
    const healed = dispatch(state, { type: 'DrinkPotion', cardId: hearts[0]! });
    expect(healed.result.type).toBe('PotionQuaffed');
    if (healed.result.type === 'PotionQuaffed') {
      expect(healed.result.wasted).toBe(false);
      expect(healed.result.healed).toBeGreaterThan(0);
    }
  });

  it('honors the unlimited-potions toggle', () => {
    const s = fourCardRoom({
      hp: 5,
      potionsUsedThisRoom: 1,
      config: { ...CONFIG, potionsPerRoom: 'unlimited' },
    });
    const { state, result } = dispatch(s, { type: 'DrinkPotion', cardId: C('heart-9') });
    expect(result.type).toBe('PotionQuaffed');
    if (result.type === 'PotionQuaffed') {
      expect(result.wasted).toBe(false);
      expect(result.healed).toBe(9);
    }
    expect(state.hp).toBe(14);
  });

  it('rejects drinking non-hearts', () => {
    const { result } = dispatch(fourCardRoom(), { type: 'DrinkPotion', cardId: C('diamond-5') });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'not-a-potion' });
  });
});

// ---------------------------------------------------------------------------
// Carryover & rooms
// ---------------------------------------------------------------------------

describe('EnterNextRoom', () => {
  const room4 = () =>
    baseState({
      room: [C('heart-9'), C('diamond-5'), C('club-2'), C('club-3')],
      dungeon: [C('heart-2'), C('heart-3'), C('heart-4'), C('club-10')],
    });

  it('requires 3 of 4 resolved first', () => {
    const { result } = dispatch(room4(), { type: 'EnterNextRoom' });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'room-not-resolved' });
  });

  it('carries the unresolved card into the next room, marked', () => {
    const { state, result } = dispatch(
      room4(),
      { type: 'DrinkPotion', cardId: C('heart-9') },
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'FightMonster', cardId: C('club-2') },
      { type: 'EnterNextRoom' },
    );
    expect(result.type).toBe('RoomDealt');
    if (result.type === 'RoomDealt') {
      expect(result.carriedFrom).toBe('club-3');
      expect(result.cards[0]).toBe('club-3');
    }
    expect(state.carriedCardId).toBe('club-3');
    expect(state.room).toEqual(['club-3', 'heart-2', 'heart-3', 'heart-4']);
    expect(state.dungeon).toEqual(['club-10']);
    expect(state.resolvedCount).toBe(0);
    expect(state.potionsUsedThisRoom).toBe(0);
    expect(state.runHighlights.roomsExplored).toBe(1);
    expect(state.turnCount).toBe(1);
  });

  it('blocks the 4th resolution — exactly 3 of 4', () => {
    const { result } = dispatch(
      room4(),
      { type: 'DrinkPotion', cardId: C('heart-9') },
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'FightMonster', cardId: C('club-2') },
      { type: 'FightMonster', cardId: C('club-3') },
    );
    expect(result).toEqual({ type: 'InvalidAction', reason: 'room-complete' });
  });

  it('rejects entering from a final room', () => {
    const s = baseState({ room: [C('club-2'), C('club-3')], dungeon: [] });
    expect(isFinalRoom(s)).toBe(true);
    const { result } = dispatch(s, { type: 'EnterNextRoom' });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'final-room' });
  });
});

describe('final partial rooms', () => {
  const finalRoom = (cards: CardId[]) => baseState({ room: cards, dungeon: [] });

  it('resolves a 4-card final room in full (no carryover) and wins', () => {
    const { state, result } = dispatch(
      finalRoom([C('heart-2'), C('diamond-5'), C('club-3'), C('club-2')]),
      { type: 'DrinkPotion', cardId: C('heart-2') },
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'FightMonster', cardId: C('club-3') }, // strongest first (degradation)
      { type: 'FightMonster', cardId: C('club-2') },
    );
    expect(result.type).toBe('GameWon');
    if (result.type === 'GameWon') expect(result.score).toBe(20);
    expect(state.phase).toBe('won');
    expect(state.hp).toBe(20);
  });

  it('resolves 3-card final rooms in full', () => {
    const { result } = dispatch(
      finalRoom([C('heart-2'), C('club-2'), C('club-3')]),
      { type: 'DrinkPotion', cardId: C('heart-2') },
      { type: 'FightMonster', cardId: C('club-2'), barehanded: true },
      { type: 'FightMonster', cardId: C('club-3'), barehanded: true },
    );
    expect(result.type).toBe('GameWon');
  });

  it('resolves 2-card final rooms in full', () => {
    const { result } = dispatch(
      finalRoom([C('club-2'), C('club-3')]),
      { type: 'FightMonster', cardId: C('club-2'), barehanded: true },
      { type: 'FightMonster', cardId: C('club-3'), barehanded: true },
    );
    expect(result.type).toBe('GameWon');
  });

  it('resolves the single-card final room and wins', () => {
    const { state, result } = dispatch(finalRoom([C('club-2')]), {
      type: 'FightMonster',
      cardId: C('club-2'),
      barehanded: true,
    });
    expect(result.type).toBe('GameWon');
    expect(state.phase).toBe('won');
    expect(state.hp).toBe(18);
    if (result.type === 'GameWon') expect(result.score).toBe(18);
  });

  it('marks final rooms via isFinalRoom and roomResolveTarget', () => {
    const s = finalRoom([C('club-2'), C('club-3')]);
    expect(isFinalRoom(s)).toBe(true);
    expect(roomResolveTarget(s)).toBe(2);
    const nonFinal = baseState({
      room: [C('club-2'), C('club-3'), C('club-4'), C('club-5')],
      dungeon: [C('heart-2')],
    });
    expect(isFinalRoom(nonFinal)).toBe(false);
    expect(roomResolveTarget(nonFinal)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Running away
// ---------------------------------------------------------------------------

describe('RunAway', () => {
  const fledFrom = () =>
    baseState({
      room: [C('club-2'), C('heart-3'), C('diamond-4'), C('spade-5')],
      dungeon: [C('club-6'), C('heart-7')],
    });

  it('sends all 4 room cards to the bottom and deals a fresh room', () => {
    const { state, result } = dispatch(fledFrom(), { type: 'RunAway' });
    expect(result.type).toBe('RanAway');
    if (result.type === 'RanAway') {
      expect(result.newCards).toEqual(['club-6', 'heart-7', 'club-2', 'heart-3']);
    }
    expect(state.room).toEqual(['club-6', 'heart-7', 'club-2', 'heart-3']);
    expect(state.dungeon).toEqual(['diamond-4', 'spade-5']);
    expect(state.ranAwayLastRoom).toBe(true);
    expect(state.resolvedCount).toBe(0);
    expect(state.carriedCardId).toBeNull();
    expect(state.roomSnapshot?.room).toEqual(state.room);
  });

  it('blocks running twice in a row (default config)', () => {
    const fled = dispatch(fledFrom(), { type: 'RunAway' });
    const again = dispatch(fled.state, { type: 'RunAway' });
    expect(again.result).toEqual({ type: 'RunAwayBlocked', reason: 'twice-in-a-row' });
    expect(runAwayStatus(fled.state).reason).toBe('twice-in-a-row');
  });

  it('clears the flag after entering the next room normally', () => {
    const roomy = () =>
      baseState({
        room: [C('club-2'), C('heart-3'), C('diamond-4'), C('spade-5')],
        dungeon: [C('club-6'), C('heart-7'), C('diamond-8'), C('heart-9'), C('spade-10')],
      });
    const fled = dispatch(roomy(), { type: 'RunAway' });
    // New room: [club-6, heart-7, diamond-8, heart-9], dungeon [spade-10, ...fled cards]
    const { state } = dispatch(
      fled.state,
      { type: 'FightMonster', cardId: C('club-6'), barehanded: true },
      { type: 'DrinkPotion', cardId: C('heart-7') },
      { type: 'EquipWeapon', cardId: C('diamond-8') },
      { type: 'EnterNextRoom' },
    );
    expect(state.ranAwayLastRoom).toBe(false);
    expect(runAwayStatus(state).legal).toBe(true);
  });

  it('allows unlimited runs with the toggle', () => {
    const s = baseState({
      room: [C('club-2'), C('heart-3'), C('diamond-4'), C('spade-5')],
      dungeon: [C('club-6'), C('heart-7')],
      ranAwayLastRoom: true,
      config: { ...CONFIG, runAwayMode: 'unlimited' },
    });
    const { state: next, result } = dispatch(s, { type: 'RunAway' });
    expect(result.type).toBe('RanAway');
    expect(next.ranAwayLastRoom).toBe(true);
  });

  it('blocks running from the final room', () => {
    const s = baseState({ room: [C('club-2'), C('club-3')], dungeon: [] });
    const { result } = dispatch(s, { type: 'RunAway' });
    expect(result).toEqual({ type: 'RunAwayBlocked', reason: 'final-room' });
  });

  it('blocks running after the room is engaged', () => {
    const { state } = dispatch(fledFrom(), { type: 'DrinkPotion', cardId: C('heart-3') });
    const { result } = dispatch(state, { type: 'RunAway' });
    expect(result).toEqual({ type: 'RunAwayBlocked', reason: 'already-engaged' });
  });
});

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

describe('UndoToRoomStart', () => {
  const setup = () =>
    dealFrom([C('club-8'), C('diamond-5'), C('heart-9'), C('spade-2'), C('club-10')]);

  it('restores hp, weapon, kill stack, room and potion counter', () => {
    const dealt = setup();
    const after = dispatch(
      dealt.state,
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'FightMonster', cardId: C('club-8') },
      { type: 'DrinkPotion', cardId: C('heart-9') },
    );
    // 20 − 3 (weapon) then heart-9 heals 3 back to the cap.
    expect(after.state.hp).toBe(20);
    expect(after.state.weapon).toBe('diamond-5');
    expect(after.state.resolvedCount).toBe(3);
    const { state, result } = dispatch(after.state, { type: 'UndoToRoomStart' });
    expect(result).toEqual({ type: 'UndoDone' });
    expect(state.hp).toBe(20);
    expect(state.weapon).toBeNull();
    expect(state.killStack).toEqual([]);
    expect(state.room).toEqual(dealt.state.room);
    expect(state.resolvedCount).toBe(0);
    expect(state.potionsUsedThisRoom).toBe(0);
  });

  it('is repeatable within the room', () => {
    const dealt = setup();
    const first = dispatch(dealt.state, {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    const undo1 = dispatch(first.state, { type: 'UndoToRoomStart' });
    const redo = dispatch(undo1.state, {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    const undo2 = dispatch(redo.state, { type: 'UndoToRoomStart' });
    expect(undo2.result).toEqual({ type: 'UndoDone' });
    expect(undo2.state.hp).toBe(20);
  });

  it('keeps the snapshot only for the current room', () => {
    const dealt = setup();
    const entered = dispatch(
      dealt.state,
      { type: 'FightMonster', cardId: C('club-8'), barehanded: true },
      { type: 'DrinkPotion', cardId: C('heart-9') },
      { type: 'EquipWeapon', cardId: C('diamond-5') },
      { type: 'EnterNextRoom' },
    );
    // Undo now rewinds to the NEW room's start, not the old room.
    const { state, result } = dispatch(entered.state, { type: 'UndoToRoomStart' });
    expect(result).toEqual({ type: 'UndoDone' });
    expect(state.room).toEqual(entered.state.room); // [spade-2, club-10], not the old deal
    expect(state.resolvedCount).toBe(0);
    expect(state.hp).toBe(20);
  });

  it('fails without a snapshot', () => {
    const s = baseState({ room: [C('club-2')], dungeon: [], roomSnapshot: null });
    const { result } = dispatch(s, { type: 'UndoToRoomStart' });
    expect(result).toEqual({ type: 'InvalidAction', reason: 'no-snapshot' });
  });
});

// ---------------------------------------------------------------------------
// Win / lose & scoring
// ---------------------------------------------------------------------------

describe('win and lose', () => {
  it('loses when hp drops to 0 or below, scored from unplayed dungeon monsters', () => {
    const s = baseState({
      room: [C('club-8'), C('heart-2'), C('diamond-3'), C('spade-4')],
      dungeon: [C('spade-10'), C('heart-3')],
      hp: 8,
    });
    const { state, result } = dispatch(s, {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    expect(result.type).toBe('GameLost');
    if (result.type === 'GameLost') expect(result.score).toBe(-10);
    expect(state.phase).toBe('lost');
    expect(state.hp).toBe(0);
  });

  it('scores zero when the dungeon is empty on defeat', () => {
    const s = baseState({ room: [C('club-8')], dungeon: [], hp: 3 });
    const { result } = dispatch(s, {
      type: 'FightMonster',
      cardId: C('club-8'),
      barehanded: true,
    });
    expect(result.type).toBe('GameLost');
    if (result.type === 'GameLost') expect(result.score).toBe(0);
  });

  it('can win by resolving the final card as a potion or weapon', () => {
    const potionWin = dispatch(baseState({ room: [C('heart-2')], dungeon: [], hp: 4 }), {
      type: 'DrinkPotion',
      cardId: C('heart-2'),
    });
    expect(potionWin.result.type).toBe('GameWon');
    if (potionWin.result.type === 'GameWon') expect(potionWin.result.score).toBe(6);

    const equipWin = dispatch(baseState({ room: [C('diamond-2')], dungeon: [] }), {
      type: 'EquipWeapon',
      cardId: C('diamond-2'),
    });
    expect(equipWin.result.type).toBe('GameWon');
  });

  it('rejects all actions after the game is over', () => {
    const wonState = baseState({ room: [C('heart-2')], dungeon: [], phase: 'won' });
    for (const action of [
      { type: 'DealRoom' },
      { type: 'RunAway' },
      { type: 'UndoToRoomStart' },
      { type: 'EnterNextRoom' },
      { type: 'DrinkPotion', cardId: C('heart-2') },
      { type: 'EquipWeapon', cardId: C('heart-2') },
      { type: 'FightMonster', cardId: C('heart-2') },
    ] as GameAction[]) {
      const { result } = reducer(wonState, action);
      expect(result).toEqual({ type: 'InvalidAction', reason: 'game-over' });
    }
  });
});

// ---------------------------------------------------------------------------
// Full-run integration through the reducer
// ---------------------------------------------------------------------------

describe('full run', () => {
  it('plays a deterministic seeded game from StartNewRun to a terminal state', () => {
    const start = reducer(baseState({ dungeon: [] }), {
      type: 'StartNewRun',
      seed: 'e2e-test',
      config: CONFIG,
      startedAt: 42,
    });
    expect(start.result.type).toBe('RunStarted');
    expect(start.state.dungeon).toEqual(createInitialState('e2e-test', CONFIG).dungeon);
    expect(start.state.startedAt).toBe(42);

    // Greedy strategy: drink potions when hurt, upgrade weapons, fight the
    // weakest monster (weaponed when legal, else barehanded). Every seeded
    // run reaches a terminal state.
    let current = start.state;
    let lastResult: GameResult = { type: 'RunStarted', seed: 'e2e-test', config: CONFIG };
    let guard = 0;
    while (current.phase === 'playing' && guard++ < 1000) {
      if (current.room.length === 0) {
        current = reducer(current, { type: 'DealRoom' }).state;
        continue;
      }
      if (roomReadyForNext(current)) {
        current = reducer(current, { type: 'EnterNextRoom' }).state;
        continue;
      }
      const out = reducer(current, pickAction(current));
      current = out.state;
      lastResult = out.result;
    }
    expect(['won', 'lost']).toContain(current.phase);
    expect(['GameWon', 'GameLost']).toContain(lastResult.type);

    // Determinism: a fresh engine with the same seed produces the same deal.
    const fresh = createInitialState('e2e-test', CONFIG);
    expect(fresh.dungeon).toEqual(start.state.dungeon);
    const freshDealt = reducer(fresh, { type: 'DealRoom' });
    const startDealt = reducer(start.state, { type: 'DealRoom' });
    expect(freshDealt.state.room).toEqual(startDealt.state.room);
  });
});

function roomReadyForNext(state: GameState): boolean {
  return state.phase === 'playing' && state.dungeon.length > 0 && state.room.length === 1;
}

function pickAction(state: GameState): GameAction {
  const room = state.room;
  const potion = room.find((c) => c.startsWith('heart-'));
  if (potion !== undefined && state.hp <= 12 && state.potionsUsedThisRoom === 0) {
    return { type: 'DrinkPotion', cardId: potion };
  }
  const bestWeapon = room
    .filter((c) => c.startsWith('diamond-'))
    .sort((a, b) => cardValue(b) - cardValue(a))[0];
  if (
    bestWeapon !== undefined &&
    (state.weapon === null || cardValue(bestWeapon) > cardValue(state.weapon))
  ) {
    return { type: 'EquipWeapon', cardId: bestWeapon };
  }
  const monster = room
    .filter((c) => c.startsWith('club-') || c.startsWith('spade-'))
    .sort((a, b) => cardValue(a) - cardValue(b))[0];
  if (monster === undefined) {
    const any = room[0]!;
    return any.startsWith('diamond-')
      ? { type: 'EquipWeapon', cardId: any }
      : { type: 'DrinkPotion', cardId: any };
  }
  const preview = state.weapon !== null ? previewFight(state, monster, false) : null;
  if (preview?.legal === true) return { type: 'FightMonster', cardId: monster };
  return { type: 'FightMonster', cardId: monster, barehanded: true };
}
