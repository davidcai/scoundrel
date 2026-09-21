import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  buildDeck,
  cardKind,
  type CardId,
  type GameAction,
  type GameResult,
  type GameState,
} from '../engine';
import { useGameStore } from '../store/game-store';
import {
  attachStoreBridge,
  mapResultToCommand,
  reconstructTerminalPresentation,
  snapshotModel,
} from './store-bridge';
import type { BridgeCommand, TableSceneApi } from './scene-api';

/**
 * Bridge unit tests with a stubbed scene — Phaser must NEVER load under vitest
 * (jsdom has no canvas/WebGL), so only the Phaser-free bridge is imported here.
 * The tween layer itself is unit-tested with a fake clock in animations.test.ts.
 */

// ---------------------------------------------------------------------------
// Stubbed scene
// ---------------------------------------------------------------------------

interface SceneStub {
  api: TableSceneApi;
  renders: { state: GameState | null; selection: CardId | null }[];
  selections: (CardId | null)[];
  commands: { command: BridgeCommand; state: GameState | null; selection: CardId | null }[];
  reducedCalls: boolean[];
  destroyed: boolean;
  click(cardId: CardId): void;
  /** Simulates the scene's post-flourish completion (contract: terminal → emit). */
  completeFlourish(outcome: 'won' | 'lost'): void;
}

function makeSceneStub(): SceneStub {
  const renders: { state: GameState | null; selection: CardId | null }[] = [];
  const selections: (CardId | null)[] = [];
  const commands: { command: BridgeCommand; state: GameState | null; selection: CardId | null }[] =
    [];
  const reducedCalls: boolean[] = [];
  let pointerDownCb: ((cardId: CardId) => void) | null = null;
  let flourishCb: ((info: { outcome: 'won' | 'lost' }) => void) | null = null;
  const stub: SceneStub = {
    api: {
      renderState(state, selection) {
        renders.push({ state, selection });
      },
      playCommand(command, state, selection) {
        commands.push({ command, state, selection });
        // Contract mimic: the real scene emits flourish completion only from
        // the terminal choreography (after it completes / instantly reduced).
        if (command.kind === 'terminal') flourishCb?.({ outcome: command.outcome });
      },
      setSelection(cardId) {
        selections.push(cardId);
      },
      setReducedMotion(reduced) {
        reducedCalls.push(reduced);
      },
      onCardPointerDown(cb) {
        pointerDownCb = cb;
      },
      onHoverChange(_cb) {
        return () => {
          /* not exercised here */
        };
      },
      onFlourishComplete(cb) {
        flourishCb = cb;
      },
      destroy() {
        stub.destroyed = true;
      },
    },
    renders,
    selections,
    commands,
    reducedCalls,
    destroyed: false,
    click(cardId) {
      pointerDownCb?.(cardId);
    },
    completeFlourish(outcome) {
      flourishCb?.({ outcome });
    },
  };
  return stub;
}

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  useGameStore.getState().reset();
});

const store = () => useGameStore;
const currentGame = (): GameState => {
  const game = store().getState().game;
  if (game === null) throw new Error('no active game');
  return game;
};
const act = (action: GameAction) => store().getState().act(action);

/** Any legal resolve for the first room card — deterministic act driver. */
function firstRoomAction(g: GameState): GameAction {
  const card = g.room[0] as CardId;
  const kind = cardKind(card);
  if (kind === 'monster') return { type: 'FightMonster', cardId: card, barehanded: true };
  if (kind === 'weapon') return { type: 'EquipWeapon', cardId: card };
  return { type: 'DrinkPotion', cardId: card };
}

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

// ---------------------------------------------------------------------------
// Result → tween-command mapping (pure)
// ---------------------------------------------------------------------------

useGameStore.getState().startRun('map-test', DEFAULT_CONFIG);
const SAMPLE_STATE = currentGame();
const SAMPLE_MODEL = snapshotModel(SAMPLE_STATE)!;
const ALL_RESULTS: GameResult[] = [
  { type: 'RunStarted', seed: 's', config: DEFAULT_CONFIG },
  { type: 'RoomDealt', cards: [], carriedFrom: null },
  {
    type: 'MonsterDefeated',
    cardId: 'club-2',
    damage: 0,
    usedWeaponId: null,
    weaponBroke: false,
  },
  { type: 'WeaponEquipped', cardId: 'diamond-4', discardedWeaponId: null, discardedMonsterIds: [] },
  { type: 'PotionQuaffed', cardId: 'heart-2', healed: 0, wasted: false },
  { type: 'RanAway', newCards: [] },
  { type: 'RunAwayBlocked', reason: 'twice-in-a-row' },
  { type: 'UndoDone' },
  { type: 'InvalidAction', reason: 'not-in-room' },
  { type: 'GameWon', score: 10, seed: 's', config: DEFAULT_CONFIG },
  { type: 'GameLost', score: -5, seed: 's', config: DEFAULT_CONFIG },
];

describe('mapResultToCommand (exhaustiveness guard over GameResult)', () => {
  it('maps every GameResult variant — a future variant fails this loop at compile time', () => {
    // Every union member is constructed here; adding an engine variant without
    // a mapping branch makes `mapResultToCommand`'s `never` branch a type error.
    expect(ALL_RESULTS).toHaveLength(11);
    for (const result of ALL_RESULTS) {
      expect(() => mapResultToCommand(result, SAMPLE_STATE, SAMPLE_MODEL)).not.toThrow();
    }
  });

  it('maps RoomDealt/RanAway to staggered deal choreographies', () => {
    expect(
      mapResultToCommand(
        { type: 'RoomDealt', cards: ['club-2'], carriedFrom: null },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toEqual({
      kind: 'deal',
      cards: ['club-2'],
      carriedFrom: null,
    });
    expect(
      mapResultToCommand({ type: 'RanAway', newCards: ['club-3'] }, SAMPLE_STATE, SAMPLE_MODEL),
    ).toEqual({
      kind: 'runAway',
      newCards: ['club-3'],
    });
  });

  it('maps MonsterDefeated to attackImpact, marking weapon kills for the stack drop', () => {
    expect(
      mapResultToCommand(
        {
          type: 'MonsterDefeated',
          cardId: 'club-2',
          damage: 2,
          usedWeaponId: 'diamond-6',
          weaponBroke: false,
        },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toEqual({
      kind: 'attack',
      cardId: 'club-2',
      damage: 2,
      usedWeaponId: 'diamond-6',
      killCardId: 'club-2', // weapon kill → stackDrop
      weaponBreak: false, // the weapon cut it — no strain flash
    });
    expect(
      mapResultToCommand(
        {
          type: 'MonsterDefeated',
          cardId: 'club-2',
          damage: 2,
          usedWeaponId: null,
          weaponBroke: false,
        },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toMatchObject({ kind: 'attack', killCardId: null, weaponBreak: false }); // barehanded → table exit
  });

  it('maps PotionQuaffed and WeaponEquipped with their full payloads', () => {
    expect(
      mapResultToCommand(
        { type: 'PotionQuaffed', cardId: 'heart-4', healed: 4, wasted: false },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toEqual({ kind: 'potion', cardId: 'heart-4', healed: 4, wasted: false });
    expect(
      mapResultToCommand(
        {
          type: 'WeaponEquipped',
          cardId: 'diamond-8',
          discardedWeaponId: 'diamond-4',
          discardedMonsterIds: ['club-2'],
        },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toEqual({
      kind: 'weaponEquip',
      cardId: 'diamond-8',
      discardedWeaponId: 'diamond-4',
      discardedMonsterIds: ['club-2'],
    });
  });

  it('maps no-op results to errorFeedback — driven by lastResult, never the diff', () => {
    expect(
      mapResultToCommand(
        { type: 'RunAwayBlocked', reason: 'already-engaged' },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ).kind,
    ).toBe('errorFeedback');
    expect(
      mapResultToCommand(
        { type: 'InvalidAction', reason: 'not-a-monster' },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ).kind,
    ).toBe('errorFeedback');
  });

  it('maps UndoDone (and defensively RunStarted) to a cross-fade rebuild', () => {
    expect(mapResultToCommand({ type: 'UndoDone' }, SAMPLE_STATE, SAMPLE_MODEL).kind).toBe(
      'rebuild',
    );
    expect(
      mapResultToCommand(
        { type: 'RunStarted', seed: 's', config: DEFAULT_CONFIG },
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ).kind,
    ).toBe('rebuild');
  });

  it('degrades to noop for motion commands when there is no state to render', () => {
    // Error feedback is state-independent (a shake needs no table diff).
    for (const result of ALL_RESULTS.filter(
      (r) => r.type !== 'RunAwayBlocked' && r.type !== 'InvalidAction',
    )) {
      expect(mapResultToCommand(result, null, SAMPLE_MODEL).kind).toBe('noop');
    }
    expect(
      mapResultToCommand({ type: 'RunAwayBlocked', reason: 'final-room' }, null, SAMPLE_MODEL).kind,
    ).toBe('errorFeedback');
    expect(
      mapResultToCommand({ type: 'InvalidAction', reason: 'game-over' }, null, SAMPLE_MODEL).kind,
    ).toBe('errorFeedback');
  });

  it('throws on a result variant outside the union (runtime guard)', () => {
    expect(() =>
      mapResultToCommand(
        { type: 'NotARealResult' } as unknown as GameResult,
        SAMPLE_STATE,
        SAMPLE_MODEL,
      ),
    ).toThrow(/Unhandled GameResult variant/);
  });
});

describe('terminal reconstruction (GameWon/GameLost replace the base result)', () => {
  it('derives the killing blow from the pre/post state diff', () => {
    const pre = snapshotModel({
      ...SAMPLE_STATE,
      hp: 20,
      room: ['club-a', 'heart-2'],
      weapon: null,
      killStack: [],
    })!;
    const post = {
      ...SAMPLE_STATE,
      phase: 'lost' as const,
      hp: 6, // 14 damage from the a-of-clubs, barehanded
      room: ['heart-2'] as CardId[],
      killStack: [] as CardId[],
    };
    expect(reconstructTerminalPresentation(pre, post)).toEqual({
      hpDelta: -14,
      hpBefore: 20,
      hpAfter: 6,
      killAppendedId: null, // barehanded: no stack join
      removedFromRoom: ['club-a'],
      addedToRoom: [],
      weaponBefore: null,
      weaponAfter: null,
      weaponBreak: false, // no pre-action state passed → nothing to derive from
    });
  });

  it('derives the final weapon-kill stack append (withTerminal swallowed the drop)', () => {
    const pre = snapshotModel({
      ...SAMPLE_STATE,
      hp: 5,
      room: ['club-2', 'club-3'],
      weapon: 'diamond-9',
      killStack: ['club-4'],
    })!;
    const post = {
      ...SAMPLE_STATE,
      phase: 'lost' as const,
      hp: 3,
      room: ['club-3'] as CardId[],
      killStack: ['club-4', 'club-2'] as CardId[],
      weapon: 'diamond-9' as CardId | null,
    };
    expect(reconstructTerminalPresentation(pre, post)).toEqual({
      hpDelta: -2,
      hpBefore: 5,
      hpAfter: 3,
      killAppendedId: 'club-2',
      removedFromRoom: ['club-2'],
      addedToRoom: [],
      weaponBefore: 'diamond-9',
      weaponAfter: 'diamond-9',
      weaponBreak: false, // weapon kill — clean cut
    });
  });

  it('terminal commands carry the reconstruction into the scene', () => {
    const pre = snapshotModel({ ...SAMPLE_STATE, hp: 10, room: ['club-2'] });
    const post = { ...SAMPLE_STATE, phase: 'lost' as const, hp: 4, room: [] };
    const command = mapResultToCommand(
      { type: 'GameLost', score: -10, seed: 's', config: DEFAULT_CONFIG },
      post,
      pre,
    );
    expect(command).toMatchObject({
      kind: 'terminal',
      outcome: 'lost',
      reconstruction: { hpDelta: -6, killAppendedId: null, removedFromRoom: ['club-2'] },
    });
  });
});

describe('weapon-break re-derivation (previewFight on the retained pre-action state)', () => {
  // Built via the engine: previewFight(pre, cardId, false) mirrors the reducer's
  // FightMonster gating exactly, so a barehand kill whose WEAPON path was illegal
  // with `weapon-too-weak` is the derivable "the weapon failed" cue.
  const tooWeakPre: GameState = {
    ...SAMPLE_STATE,
    weapon: 'diamond-4', // value 4
    killStack: ['club-3'], // threshold = 2
    room: ['club-4', 'heart-5'] as CardId[], // monster 4 ≥ 3 → weapon path illegal
  };

  it('weapon too weak + barehanded kill → the weapon strained (flash derived)', () => {
    const command = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-4',
        damage: 4,
        usedWeaponId: null,
        weaponBroke: false,
      },
      tooWeakPre,
      snapshotModel(tooWeakPre),
      tooWeakPre,
    );
    expect(command).toEqual({
      kind: 'attack',
      cardId: 'club-4',
      damage: 4,
      usedWeaponId: null,
      killCardId: null,
      weaponBreak: true,
    });
  });

  it('weapon kill → no flash (the weapon cut it; degradation is not a break)', () => {
    const command = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-4',
        damage: 0,
        usedWeaponId: 'diamond-4',
        weaponBroke: false, // the engine's vestigial flag — ignored either way
      },
      tooWeakPre,
      snapshotModel(tooWeakPre),
      tooWeakPre,
    );
    expect(command).toMatchObject({ kind: 'attack', killCardId: 'club-4', weaponBreak: false });
  });

  it('barehanded kill with a weapon whose path is legal → no flash (honest choice)', () => {
    const strongPre: GameState = {
      ...tooWeakPre,
      weapon: 'diamond-a', // 14 — the weapon path is legal for club-4
      killStack: [], // fresh weapon: no threshold, the cut is legal
    };
    const command = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-4',
        damage: 4,
        usedWeaponId: null,
        weaponBroke: false,
      },
      strongPre,
      snapshotModel(strongPre),
      strongPre,
    );
    expect(command).toMatchObject({ kind: 'attack', weaponBreak: false });
  });

  it('barehanded kill with no weapon held → no flash', () => {
    const unarmedPre: GameState = { ...tooWeakPre, weapon: null, killStack: [] };
    const command = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-4',
        damage: 4,
        usedWeaponId: null,
        weaponBroke: false,
      },
      unarmedPre,
      snapshotModel(unarmedPre),
      unarmedPre,
    );
    expect(command).toMatchObject({ kind: 'attack', weaponBreak: false });
  });

  it('weaponDegradation off → the weapon path is always legal → never a flash', () => {
    const lenientPre: GameState = {
      ...tooWeakPre,
      config: { ...DEFAULT_CONFIG, weaponDegradation: false },
    };
    const command = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-4',
        damage: 4,
        usedWeaponId: null,
        weaponBroke: false,
      },
      lenientPre,
      snapshotModel(lenientPre),
      lenientPre,
    );
    expect(command).toMatchObject({ kind: 'attack', weaponBreak: false });
  });

  it('WeaponEquipped NEVER flashes — discardedWeaponId fires on honest swaps too', () => {
    const command = mapResultToCommand(
      {
        type: 'WeaponEquipped',
        cardId: 'diamond-6',
        discardedWeaponId: 'diamond-4', // voluntary upgrade — nothing broke
        discardedMonsterIds: ['club-2', 'club-3'],
      },
      tooWeakPre,
      snapshotModel(tooWeakPre),
      tooWeakPre,
    );
    expect(command).toEqual({
      kind: 'weaponEquip',
      cardId: 'diamond-6',
      discardedWeaponId: 'diamond-4',
      discardedMonsterIds: ['club-2', 'club-3'],
      // structurally: no weaponBreak key on the equip path at all
    });
  });

  it('terminal reconstruction derives the break for the killing blow via previewFight', () => {
    const pre = snapshotModel({ ...tooWeakPre, hp: 20, room: ['club-4', 'heart-5'] as CardId[] })!;
    const post: GameState = {
      ...tooWeakPre,
      phase: 'lost',
      hp: 16,
      room: ['heart-5'] as CardId[],
    };
    const reconstruction = reconstructTerminalPresentation(pre, post, tooWeakPre);
    expect(reconstruction).toMatchObject({
      hpDelta: -4,
      killAppendedId: null,
      removedFromRoom: ['club-4'],
      weaponBreak: true,
    });
  });

  it('terminal weapon kill → no break flash in the reconstruction', () => {
    const pre = snapshotModel({
      ...SAMPLE_STATE,
      hp: 5,
      room: ['club-2'],
      weapon: 'diamond-9',
      killStack: ['club-4'],
    })!;
    const post: GameState = {
      ...SAMPLE_STATE,
      phase: 'lost',
      hp: 3,
      room: [] as CardId[],
      killStack: ['club-4', 'club-2'] as CardId[],
      weapon: 'diamond-9',
    };
    const command = mapResultToCommand(
      { type: 'GameLost', score: -10, seed: 's', config: DEFAULT_CONFIG },
      post,
      pre,
      SAMPLE_STATE,
    );
    expect(command).toMatchObject({
      kind: 'terminal',
      reconstruction: { killAppendedId: 'club-2', weaponBreak: false },
    });
  });
});

describe('attachStoreBridge', () => {
  it('first sync renders the full current state and seeds seq — no replay of pre-mount results', () => {
    useGameStore.getState().startRun('seeded', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    // Snapshot first sync: the full room rendered statically, once — no command.
    expect(stub.renders).toHaveLength(1);
    expect(stub.renders[0]).toMatchObject({ state: currentGame(), selection: null });
    expect(stub.commands).toHaveLength(0);

    // The pre-mount result (RoomDealt) is NOT replayed; the next action adds
    // exactly one command.
    act(firstRoomAction(currentGame()));
    expect(stub.commands).toHaveLength(1);
    expect(stub.commands[0]!.command.kind).toMatch(/attack|potion|weaponEquip/);
    expect(stub.commands[0]!.state!.room).toEqual(currentGame().room);

    bridge.destroy();
  });

  it('empty store first sync renders null and picks up startRun via the cue sheet', () => {
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    expect(stub.renders).toEqual([{ state: null, selection: null }]);
    expect(stub.commands).toHaveLength(0);

    useGameStore.getState().startRun('late-start', DEFAULT_CONFIG);
    expect(stub.commands).toHaveLength(1);
    expect(stub.commands[0]!.command).toEqual({
      kind: 'deal',
      cards: currentGame().room,
      carriedFrom: null,
    });
    bridge.destroy();
  });

  it('no-op results flow through the mapping as error feedback (never the diff)', () => {
    useGameStore.getState().startRun('noop-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    act({ type: 'RunAway' }); // legal → runAway sweep
    expect(stub.commands.at(-1)!.command.kind).toBe('runAway');

    act({ type: 'RunAway' }); // twice in a row → RunAwayBlocked
    expect(store().getState().lastResult!.result.type).toBe('RunAwayBlocked');
    expect(stub.commands.at(-1)!.command).toEqual({ kind: 'errorFeedback' });

    act({ type: 'EnterNextRoom' }); // InvalidAction (room-not-resolved)
    expect(store().getState().lastResult!.result.type).toBe('InvalidAction');
    expect(stub.commands.at(-1)!.command).toEqual({ kind: 'errorFeedback' });

    // No render was triggered for the no-ops (state did not change).
    expect(stub.renders).toHaveLength(1);
    bridge.destroy();
  });

  it('undo triggers a cross-fade rebuild command and never fires the run-ended gate', () => {
    useGameStore.getState().startRun('undo-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const runEnded: string[] = [];
    const bridge = attachStoreBridge(stub.api, store());
    bridge.onRunEnded((info) => runEnded.push(info.outcome));

    const roomBefore = currentGame().room;
    act(firstRoomAction(currentGame()));
    expect(currentGame().room).not.toEqual(roomBefore);

    act({ type: 'UndoToRoomStart' });
    const rebuild = stub.commands.at(-1)!.command;
    expect(rebuild).toEqual({ kind: 'rebuild' });
    expect(stub.commands.at(-1)!.state!.room).toEqual(roomBefore); // restored from roomSnapshot
    expect(runEnded).toEqual([]); // rebuild never reaches the flourish path

    bridge.destroy();
  });

  it('any state mismatch without a fresh result rebuilds the scene (diff fallback)', () => {
    useGameStore.getState().startRun('drift-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    const before = stub.commands.length;

    // Simulate a state change that bypasses the result channel entirely.
    const g = currentGame();
    useGameStore.setState({ game: { ...g, hp: g.hp - 3 } });

    expect(stub.commands).toHaveLength(before + 1);
    expect(stub.commands.at(-1)!.command).toEqual({ kind: 'rebuild' });
    expect(stub.commands.at(-1)!.state!.hp).toBe(g.hp - 3);

    // A second identical-state notification does NOT rebuild (model matches).
    useGameStore.setState({ game: { ...currentGame() } });
    expect(stub.commands).toHaveLength(before + 1);

    bridge.destroy();
  });

  it('selection is filtered to room cards, cleared when the card resolves, and sync is idempotent', () => {
    useGameStore.getState().startRun('sel-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    const room = currentGame().room;
    const target = room[1] as CardId;

    store().getState().selectCard(target);
    expect(stub.selections).toEqual([target]);

    // Ring-off: selecting a card not in the room clears the visible selection.
    const g = currentGame();
    const outsider = buildDeck().find(
      (id) => !g.room.includes(id) && g.weapon !== id && !g.killStack.includes(id),
    ) as CardId;
    store().getState().selectCard(outsider);
    expect(stub.selections.at(-1)).toBeNull();

    // Canvas toggle: clicking the same card again deselects (PlayScreen parity).
    store().getState().selectCard(target);
    stub.click(target);
    expect(store().getState().selectedCardId).toBeNull();
    expect(stub.selections.at(-1)).toBeNull();

    // Clear on resolve: the selected card leaves the room — selection is filtered
    // off, and the trailing selectCard(null) notification changes nothing further.
    const other = room[0] as CardId;
    store().getState().selectCard(other);
    const selectionsBefore = stub.selections.length;
    act(firstRoomAction(currentGame()));
    expect(stub.selections.at(-1)).toBeNull(); // ring-off on the act notification
    store().getState().selectCard(null); // PlayScreen's second notification
    expect(stub.selections.length).toBe(selectionsBefore + 1); // idempotent clear: no extra

    bridge.destroy();
  });

  it('onRunEnded fires exactly once after the terminal flourish, never on undo', () => {
    useGameStore.getState().startRun('gate-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const runEnded: string[] = [];
    const bridge = attachStoreBridge(stub.api, store());
    bridge.onRunEnded((info) => runEnded.push(info.outcome));

    fightToDeath();

    const terminal = stub.commands.filter((c) => c.command.kind === 'terminal');
    expect(terminal).toHaveLength(1);
    expect(terminal[0]!.command).toMatchObject({ kind: 'terminal', outcome: 'lost' });
    expect(terminal[0]!.state!.phase).toBe('lost');
    // The stub already simulated the post-flourish completion: the gate fired
    // exactly once, after the flourish (the scene emits only from the terminal
    // choreography; undo/rebuild commands never reach it — see the undo test).
    expect(runEnded).toEqual(['lost']);

    bridge.destroy();
  });

  it('the run-ended gate re-arms for a fresh run on the same table', () => {
    useGameStore.getState().startRun('gate-run-2', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const runEnded: string[] = [];
    const bridge = attachStoreBridge(stub.api, store());
    bridge.onRunEnded((info) => runEnded.push(info.outcome));

    fightToDeath();
    expect(runEnded).toEqual(['lost']);

    // Replay-style restart on the same table: a new run publishes a fresh deal.
    useGameStore.getState().startRun('gate-run-3', DEFAULT_CONFIG);
    expect(stub.commands.at(-1)!.command.kind).toBe('deal');

    bridge.destroy();
  });

  it('reduced motion is forwarded to the scene at attach time', () => {
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store(), { reducedMotion: true });
    expect(stub.reducedCalls).toEqual([true]);
    bridge.destroy();
  });

  it('destroy unsubscribes from the store and detaches the gate', () => {
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    expect(stub.destroyed).toBe(false);
    bridge.destroy();
    expect(stub.destroyed).toBe(true);

    const before = stub.commands.length;
    useGameStore.getState().startRun('after-destroy', DEFAULT_CONFIG);
    expect(stub.commands).toHaveLength(before);
  });

  it('mirrors the model with deck count and kill stack (render parity fields)', () => {
    const model = snapshotModel(SAMPLE_STATE);
    expect(model).not.toBeNull();
    expect(model!.deckCount).toBe(SAMPLE_STATE.dungeon.length);
    expect(model!.killStack).toEqual(SAMPLE_STATE.killStack);

    const clone = snapshotModel({ ...SAMPLE_STATE });
    expect(clone).toEqual(model);
  });
});
