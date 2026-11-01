import { describe, expect, it } from 'vitest';
import {
  CARD_IDS,
  DEFAULT_CONFIG,
  createGame,
  decodeReplay,
  encodeReplay,
  getCard,
  isCardId,
  isRoomComplete,
  lossScore,
  previewAction,
  shuffledDeck,
  transition,
  validateConfig,
  validateSeed,
} from './index';
import type { Action, CardId, GameConfig, GameState, PlayingState, RoomState } from './index';

function fixture(
  overrides: Partial<RoomState> = {},
  config: GameConfig = DEFAULT_CONFIG,
): PlayingState {
  const room: CardId[] = ['spade-8', 'heart-6', 'diamond-7', 'club-4'];
  const b = { ...createGame('fixture').board, room, ...overrides };
  const held = [...b.room, ...b.kills, ...(b.weapon ? [b.weapon] : [])];
  const dungeon = overrides.dungeon ?? CARD_IDS.filter((id) => !held.includes(id));
  const discard = CARD_IDS.filter((id) => ![...held, ...dungeon].includes(id));
  const board = { ...b, dungeon, discard };
  return { status: 'playing', seed: 'fixture', config: { ...config }, board, roomStart: board };
}
function act(s: GameState, action: Action): GameState {
  const result = transition(s, action);
  expect(result.result.type).not.toBe('invalid');
  return result.state;
}
function invalid(s: GameState, action: Action, reason: string) {
  const before = JSON.stringify(s);
  expect(transition(s, action)).toEqual({ state: s, result: { type: 'invalid', reason } });
  expect(JSON.stringify(s)).toBe(before);
}
function conserved(s: GameState) {
  const b = s.board;
  const all = [...b.dungeon, ...b.room, ...b.discard, ...b.kills, ...(b.weapon ? [b.weapon] : [])];
  expect([...all].sort()).toEqual([...CARD_IDS].sort());
}
function freeze(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
}
const configs: GameConfig[] = [];
for (const allowConsecutiveEscapes of [false, true])
  for (const unlimitedPotions of [false, true])
    for (const weaponDegradation of [false, true])
      configs.push({ allowConsecutiveEscapes, unlimitedPotions, weaponDegradation });

describe('deck and reproducible runs', () => {
  it('contains the exact 44 artwork IDs with canonical values', () => {
    expect(CARD_IDS).toHaveLength(44);
    expect(new Set(CARD_IDS).size).toBe(44);
    expect(CARD_IDS.filter((id) => getCard(id).kind === 'monster')).toHaveLength(26);
    expect(CARD_IDS.filter((id) => getCard(id).kind === 'weapon')).toHaveLength(9);
    expect(CARD_IDS.filter((id) => getCard(id).kind === 'potion')).toHaveLength(9);
    expect(getCard('club-a').value).toBe(14);
    expect(getCard('spade-j').value).toBe(11);
    expect(isCardId('heart-a')).toBe(false);
    expect(isCardId('joker-1')).toBe(false);
    expect(isCardId(null)).toBe(false);
  });
  it('shuffles deterministically without touching global randomness', () => {
    const first = shuffledDeck('cinder');
    expect(shuffledDeck('cinder')).toEqual(first);
    expect(shuffledDeck('Cinder')).not.toEqual(first);
    expect(first).not.toEqual(CARD_IDS);
    expect([...first].sort()).toEqual([...CARD_IDS].sort());
  });
  it('starts with 20 health, four cards, and one explored room', () => {
    const s = createGame('cinder');
    expect(s.board.health).toBe(20);
    expect(s.board.room).toHaveLength(4);
    expect(s.board.dungeon).toHaveLength(40);
    expect(s.board.highlights).toEqual({
      roomsExplored: 1,
      roomsCleared: 0,
      monstersDefeated: 0,
      potionsWasted: 0,
    });
    conserved(s);
  });
  it.each(['', ' ', ' abc', 'a.b', '中文', 'x'.repeat(33)])('rejects invalid seed %s', (seed) =>
    expect(() => validateSeed(seed)).toThrow(),
  );
  it.each([null, {}, { ...DEFAULT_CONFIG, unlimitedPotions: 1 }])(
    'rejects invalid configuration',
    (config) => expect(() => validateConfig(config)).toThrow(),
  );
  it.each(configs)('round-trips all rule combinations: %j', (config) => {
    const replay = encodeReplay('A_b-123', config);
    expect(decodeReplay(replay)).toEqual({ seed: 'A_b-123', config });
    expect(createGame(decodeReplay(replay).seed, decodeReplay(replay).config)).toEqual(
      createGame('A_b-123', config),
    );
  });
  it.each([
    '#/play?v=2&seed=x&rules=001',
    '#/play?v=1&seed=x&rules=abc',
    '#/play?v=1&seed=x&rules=001&seed=y',
    '#/play?v=1&seed=x&rules=001&foo=bar',
    '#/play?seed=x&rules=001',
    '#/play?v=1&seed=&rules=001',
    '/play?v=1&seed=x&rules=001',
  ])('rejects invalid replay %s', (value) => expect(() => decodeReplay(value)).toThrow());
  it('does not let caller config changes alter a running ruleset', () => {
    const config = { ...DEFAULT_CONFIG };
    const s = createGame('cinder', config);
    config.weaponDegradation = false;
    expect(s.config.weaponDegradation).toBe(true);
  });
});

describe('combat and equipment', () => {
  it('previews and resolves the same weapon damage without mutating input', () => {
    const s = fixture({ weapon: 'diamond-5', kills: ['club-10'], health: 14 });
    freeze(s);
    const action: Action = { type: 'fight', cardId: 'spade-8', mode: 'weapon' };
    const preview = previewAction(s, action);
    expect(s.board.health).toBe(14);
    const result = transition(s, action);
    expect(result.result).toEqual(preview);
    expect(result.state.board.health).toBe(11);
    expect(result.state.board.kills).toEqual(['club-10', 'spade-8']);
    conserved(result.state);
  });
  it('never heals from negative raw damage and still lowers the weapon threshold', () => {
    const s = fixture({ weapon: 'diamond-10', health: 12 });
    const n = act(s, { type: 'fight', cardId: 'club-4', mode: 'weapon' });
    expect(n.board.health).toBe(12);
    expect(n.board.kills).toEqual(['club-4']);
    invalid(n, { type: 'fight', cardId: 'spade-8', mode: 'weapon' }, 'weapon-degraded');
  });
  it('permits barehanded fighting while preserving weapon threshold', () => {
    const s = fixture({ weapon: 'diamond-5', kills: ['club-10'] });
    const n = act(s, { type: 'fight', cardId: 'spade-8', mode: 'barehanded' });
    expect(n.board.health).toBe(12);
    expect(n.board.kills).toEqual(['club-10']);
    expect(n.board.discard).toContain('spade-8');
    conserved(n);
  });
  it('rejects equal and stronger monsters under degradation', () => {
    const s = fixture({ weapon: 'diamond-5', kills: ['club-8'] });
    invalid(s, { type: 'fight', cardId: 'spade-8', mode: 'weapon' }, 'weapon-degraded');
    const n = act(s, { type: 'fight', cardId: 'club-4', mode: 'weapon' });
    expect(n.board.kills.at(-1)).toBe('club-4');
  });
  it('permits equal or stronger monsters when degradation is off', () => {
    const s = fixture(
      { weapon: 'diamond-5', kills: ['club-8'] },
      { ...DEFAULT_CONFIG, weaponDegradation: false },
    );
    expect(act(s, { type: 'fight', cardId: 'spade-8', mode: 'weapon' }).board.health).toBe(17);
  });
  it('discards the whole old stack on equip and resets the threshold', () => {
    const s = fixture({ weapon: 'diamond-5', kills: ['club-3', 'spade-2'] });
    const result = transition(s, { type: 'equip', cardId: 'diamond-7' });
    expect(result.result).toEqual({
      type: 'equipped',
      cardId: 'diamond-7',
      discarded: ['diamond-5', 'club-3', 'spade-2'],
    });
    expect(result.state.board.kills).toEqual([]);
    expect(
      act(result.state, { type: 'fight', cardId: 'spade-8', mode: 'weapon' }).board.health,
    ).toBe(19);
    conserved(result.state);
  });
  it('rejects wrong-type, absent-card and no-weapon actions without changing state', () => {
    const s = fixture();
    invalid(s, { type: 'fight', cardId: 'spade-8', mode: 'weapon' }, 'weapon-required');
    invalid(s, { type: 'fight', cardId: 'heart-6', mode: 'barehanded' }, 'wrong-card-type');
    invalid(s, { type: 'drink', cardId: 'club-4' }, 'wrong-card-type');
    invalid(s, { type: 'equip', cardId: 'heart-6' }, 'wrong-card-type');
    invalid(s, { type: 'drink', cardId: 'heart-2' }, 'card-not-in-room');
  });
});

describe('potions', () => {
  it('caps health and consumes extras without healing', () => {
    const s = fixture({ health: 18, room: ['heart-6', 'heart-5', 'club-4', 'spade-8'] });
    const first = act(s, { type: 'drink', cardId: 'heart-6' });
    expect(first.board.health).toBe(20);
    const second = transition(first, { type: 'drink', cardId: 'heart-5' });
    expect(second.result).toEqual({
      type: 'drank',
      cardId: 'heart-5',
      healed: 0,
      wasted: true,
      healthAfter: 20,
    });
    expect(second.state.board.highlights.potionsWasted).toBe(1);
    conserved(second.state);
  });
  it('counts a full-health potion as wasted and uses the room allowance', () => {
    const first = act(fixture(), { type: 'drink', cardId: 'heart-6' });
    expect(first.board.potionsUsed).toBe(1);
    expect(first.board.highlights.potionsWasted).toBe(1);
  });
  it('heals multiple times under the unlimited option', () => {
    const s = fixture(
      { health: 3, room: ['heart-6', 'heart-5', 'club-4', 'spade-8'] },
      { ...DEFAULT_CONFIG, unlimitedPotions: true },
    );
    const n = act(act(s, { type: 'drink', cardId: 'heart-6' }), {
      type: 'drink',
      cardId: 'heart-5',
    });
    expect(n.board.health).toBe(14);
    expect(n.board.highlights.potionsWasted).toBe(0);
  });
  it('carries an unresolved heart and resets the potion allowance', () => {
    const s = fixture({ room: ['heart-6', 'heart-5', 'diamond-7', 'club-4'], health: 10 });
    let n = act(s, { type: 'drink', cardId: 'heart-5' });
    n = act(n, { type: 'equip', cardId: 'diamond-7' });
    n = act(n, { type: 'fight', cardId: 'club-4', mode: 'weapon' });
    n = act(n, { type: 'next-room' });
    expect(n.board.carriedCard).toBe('heart-6');
    expect(n.board.potionsUsed).toBe(0);
    expect(act(n, { type: 'drink', cardId: 'heart-6' }).board.health).toBe(20);
  });
});

describe('rooms, escape and undo', () => {
  it('requires exactly three resolutions before normal entry and blocks a fourth', () => {
    let s: GameState = fixture();
    invalid(s, { type: 'next-room' }, 'room-incomplete');
    s = act(s, { type: 'equip', cardId: 'diamond-7' });
    s = act(s, { type: 'fight', cardId: 'spade-8', mode: 'weapon' });
    s = act(s, { type: 'fight', cardId: 'club-4', mode: 'weapon' });
    expect(s.board.highlights.roomsCleared).toBe(1);
    expect(isRoomComplete(s.board)).toBe(true);
    invalid(s, { type: 'drink', cardId: 'heart-6' }, 'room-complete');
    const next = act(s, { type: 'next-room' });
    expect(next.board.room[0]).toBe('heart-6');
    expect(next.board.highlights.roomsExplored).toBe(2);
    conserved(next);
  });
  it('preview does not prevent escape, which appends cards in displayed order', () => {
    const s = fixture();
    previewAction(s, { type: 'fight', cardId: 'spade-8', mode: 'barehanded' });
    const n = act(s, { type: 'escape' });
    expect(n.board.dungeon).toEqual([...s.board.dungeon, ...s.board.room].slice(4));
    expect(n.board.room).toEqual(s.board.dungeon.slice(0, 4));
    expect(n.board.highlights).toEqual({ ...s.board.highlights, roomsExplored: 2 });
    conserved(n);
    invalid(n, { type: 'escape' }, 'consecutive-escape');
    invalid(n, { type: 'undo' }, 'nothing-to-undo');
  });
  it.each(configs)('blocks escape after a resolution for config %j', (config) => {
    const s = fixture({}, config);
    const n = act(s, { type: 'fight', cardId: 'club-4', mode: 'barehanded' });
    invalid(n, { type: 'escape' }, 'escape-after-resolution');
  });
  it('allows repeated escape only with that option enabled', () => {
    const s = fixture({}, { ...DEFAULT_CONFIG, allowConsecutiveEscapes: true });
    expect(act(act(s, { type: 'escape' }), { type: 'escape' }).board.highlights.roomsExplored).toBe(
      3,
    );
  });
  it('undo restores every board field, order, eligibility, and counter without accumulation', () => {
    const s = fixture({ weapon: 'diamond-5', kills: ['club-10'], health: 13 });
    let n: GameState = s;
    for (let i = 0; i < 3; i++) {
      n = act(n, { type: 'fight', cardId: 'club-4', mode: 'weapon' });
      n = act(n, { type: 'drink', cardId: 'heart-6' });
      n = act(n, { type: 'equip', cardId: 'diamond-7' });
      expect(n.board.highlights.roomsCleared).toBe(1);
      n = act(n, { type: 'undo' });
      expect(n).toEqual(s);
    }
    expect(act(n, { type: 'escape' }).board.highlights.roomsExplored).toBe(2);
  });
  it('undo after an escape does not restore the escaped room or allow consecutive escape', () => {
    const s = fixture({ dungeon: ['heart-2', 'club-2', 'diamond-2', 'heart-3', 'spade-a'] });
    const escaped = act(s, { type: 'escape' });
    let n = act(escaped, { type: 'drink', cardId: 'heart-2' });
    n = act(n, { type: 'undo' });
    expect(n).toEqual(escaped);
    invalid(n, { type: 'escape' }, 'consecutive-escape');
  });
  it('normal room completion resets the preceding-escape restriction', () => {
    const s = fixture({ dungeon: ['heart-2', 'club-2', 'diamond-2', 'heart-3', 'spade-a'] });
    let n = act(s, { type: 'escape' });
    n = act(n, { type: 'equip', cardId: 'diamond-2' });
    n = act(n, { type: 'drink', cardId: 'heart-2' });
    n = act(n, { type: 'fight', cardId: 'club-2', mode: 'weapon' });
    n = act(n, { type: 'next-room' });
    expect(n.board.previousRoomEscaped).toBe(false);
    expect(act(n, { type: 'escape' }).status).toBe('playing');
  });
  it('a JSON round-trip preserves the exact undo snapshot', () => {
    const s = fixture();
    const progressed = act(s, { type: 'drink', cardId: 'heart-6' });
    const restored = JSON.parse(JSON.stringify(progressed)) as GameState;
    expect(act(restored, { type: 'undo' })).toEqual(s);
  });
});

describe('final rooms, scores and terminal actions', () => {
  it.each([1, 2, 3, 4])('resolves every card in a final room of size %i', (count) => {
    const ids: CardId[] = ['heart-2', 'heart-3', 'heart-4', 'heart-5'];
    let s: GameState = fixture({ room: ids.slice(0, count), dungeon: [], health: 10 });
    invalid(s, { type: 'escape' }, 'final-room');
    for (let i = 0; i < count; i++) {
      s = act(s, { type: 'drink', cardId: ids[i] });
      expect(s.status).toBe(i === count - 1 ? 'won' : 'playing');
    }
    expect(s.status === 'won' && s.score).toBe(s.board.health);
    expect(s.board.highlights.roomsCleared).toBe(1);
    conserved(s);
  });
  it.each(configs)('never allows final-room escape for config %j', (config) =>
    invalid(fixture({ dungeon: [] }, config), { type: 'escape' }, 'final-room'),
  );
  it.each([1, 2, 3])('deals a final partial room from %i remaining cards', (count) => {
    const ids: CardId[] = ['heart-2', 'heart-3', 'heart-4'];
    const s = fixture({ room: ['heart-6'], dungeon: ids.slice(0, count), resolved: 3 });
    const n = act(s, { type: 'next-room' });
    expect(n.board.room).toHaveLength(count + 1);
    expect(n.board.dungeon).toEqual([]);
    expect(n.board.carriedCard).toBe('heart-6');
  });
  it('death on the last card takes precedence over win and room-clear counts', () => {
    const s = fixture({ room: ['club-4'], dungeon: [], health: 4 });
    const n = act(s, { type: 'fight', cardId: 'club-4', mode: 'barehanded' });
    expect(n.status).toBe('lost');
    expect(n.status === 'lost' && n.reason).toBe('death');
    expect(n.status !== 'playing' && n.score).toBe(0);
    expect(n.board.highlights.roomsCleared).toBe(0);
    expect(n.board.highlights.monstersDefeated).toBe(0);
  });
  it('scores only draw-pile monsters, not health or unresolved room monsters', () => {
    const s = fixture({
      health: 1,
      dungeon: ['club-a', 'spade-q', 'club-q', 'heart-2', 'diamond-2'],
    });
    const dead = act(s, { type: 'fight', cardId: 'club-4', mode: 'barehanded' });
    const abandoned = act(s, { type: 'abandon' });
    expect(lossScore(s.board.dungeon)).toBe(-38);
    expect(dead.status !== 'playing' && dead.score).toBe(-38);
    expect(abandoned.status !== 'playing' && abandoned.score).toBe(-38);
    expect(abandoned.status === 'lost' && abandoned.reason).toBe('abandoned');
  });
  it('abandoning an empty-monster draw pile is a loss with score zero', () => {
    const n = act(fixture({ dungeon: ['heart-2', 'diamond-2'] }), { type: 'abandon' });
    expect(n.status).toBe('lost');
    expect(n.status !== 'playing' && n.score).toBe(0);
  });
  it('no action, including undo or abandonment, can alter a terminal run', () => {
    const win = act(fixture({ room: ['heart-2'], dungeon: [] }), {
      type: 'drink',
      cardId: 'heart-2',
    });
    const loss = act(fixture(), { type: 'abandon' });
    const actions: Action[] = [
      { type: 'undo' },
      { type: 'escape' },
      { type: 'next-room' },
      { type: 'abandon' },
      { type: 'fight', cardId: 'club-4', mode: 'barehanded' },
      { type: 'equip', cardId: 'diamond-7' },
      { type: 'drink', cardId: 'heart-6' },
    ];
    for (const s of [win, loss]) for (const action of actions) invalid(s, action, 'run-ended');
  });
});

it('conserves all cards and preview parity through complete seeded runs under every configuration', () => {
  for (const config of configs)
    for (let seed = 0; seed < 32; seed++) {
      let s: GameState = createGame(`journey-${seed}`, config);
      let steps = 0;
      while (s.status === 'playing') {
        expect(steps++).toBeLessThan(100);
        conserved(s);
        freeze(s);
        let action: Action = { type: 'next-room' };
        if (!isRoomComplete(s.board)) {
          const weapon = s.board.room.find((id) => getCard(id).kind === 'weapon');
          const potion = s.board.room.find((id) => getCard(id).kind === 'potion');
          if (weapon) action = { type: 'equip', cardId: weapon };
          else if (potion) action = { type: 'drink', cardId: potion };
          else {
            const id = s.board.room[0];
            const withWeapon: Action = { type: 'fight', cardId: id, mode: 'weapon' };
            action =
              previewAction(s, withWeapon).type === 'invalid'
                ? { type: 'fight', cardId: id, mode: 'barehanded' }
                : withWeapon;
          }
        }
        const result = transition(s, action);
        expect(result.result).toEqual(previewAction(s, action));
        expect(result.result.type).not.toBe('invalid');
        s = result.state;
      }
      conserved(s);
    }
});

it('pins the version-1 cinder deck for replay compatibility', () => {
  expect(shuffledDeck('cinder')).toMatchInlineSnapshot(`
    [
      "spade-7",
      "heart-4",
      "diamond-6",
      "diamond-5",
      "club-q",
      "diamond-2",
      "heart-5",
      "club-a",
      "diamond-3",
      "spade-2",
      "spade-9",
      "spade-4",
      "diamond-7",
      "spade-5",
      "spade-8",
      "heart-6",
      "heart-2",
      "spade-10",
      "spade-a",
      "spade-j",
      "club-k",
      "heart-10",
      "spade-3",
      "club-3",
      "club-5",
      "club-7",
      "heart-9",
      "heart-3",
      "diamond-8",
      "diamond-10",
      "club-j",
      "diamond-9",
      "heart-7",
      "spade-q",
      "club-9",
      "diamond-4",
      "club-4",
      "spade-6",
      "club-6",
      "spade-k",
      "club-2",
      "club-10",
      "heart-8",
      "club-8",
    ]
  `);
});

it.each([1, 2, 3])('escaping with %i draw-pile cards preserves order and deals four', (count) => {
  const deck: CardId[] = ['heart-2', 'diamond-2', 'club-2'];
  const s = fixture({ dungeon: deck.slice(0, count) });
  const n = act(s, { type: 'escape' });
  const combined = [...s.board.dungeon, ...s.board.room];
  expect(n.board.room).toEqual(combined.slice(0, 4));
  expect(n.board.dungeon).toEqual(combined.slice(4));
  expect(n.board.carriedCard).toBe(null);
  conserved(n);
});

it('counts clear, escape, death as three explored and one cleared', () => {
  let s: GameState = fixture({
    room: ['diamond-10', 'club-2', 'spade-2', 'heart-2'],
    dungeon: ['heart-3', 'heart-4', 'heart-5', 'club-a', 'spade-a', 'club-k', 'spade-k'],
  });
  s = act(s, { type: 'equip', cardId: 'diamond-10' });
  s = act(s, { type: 'fight', cardId: 'club-2', mode: 'weapon' });
  s = act(s, { type: 'fight', cardId: 'spade-2', mode: 'barehanded' });
  s = act(s, { type: 'next-room' });
  s = act(s, { type: 'escape' });
  s = act(s, { type: 'fight', cardId: 'club-a', mode: 'barehanded' });
  s = act(s, { type: 'fight', cardId: 'spade-a', mode: 'barehanded' });
  expect(s.status).toBe('lost');
  expect(s.board.highlights.roomsExplored).toBe(3);
  expect(s.board.highlights.roomsCleared).toBe(1);
});
