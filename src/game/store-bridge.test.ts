import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  cardKind,
  type CardId,
  type GameAction,
  type GameResult,
  type GameState,
} from '../engine';
import { useGameStore } from '../store/game-store';
import { attachStoreBridge, mapResultToCommand, snapshotModel } from './store-bridge';
import type { TableSceneApi } from './scene-api';

/**
 * Bridge unit tests with a stubbed scene — Phaser must NEVER load under vitest
 * (jsdom has no canvas/WebGL), so only the Phaser-free bridge is imported here.
 */

// ---------------------------------------------------------------------------
// Stubbed scene
// ---------------------------------------------------------------------------

interface SceneStub {
  api: TableSceneApi;
  renders: { state: GameState | null; selection: CardId | null }[];
  selections: (CardId | null)[];
  destroyed: boolean;
  click(cardId: CardId): void;
}

function makeSceneStub(): SceneStub {
  const renders: { state: GameState | null; selection: CardId | null }[] = [];
  const selections: (CardId | null)[] = [];
  let pointerDownCb: ((cardId: CardId) => void) | null = null;
  const stub: SceneStub = {
    api: {
      renderState(state, selection) {
        renders.push({ state, selection });
      },
      setSelection(cardId) {
        selections.push(cardId);
      },
      onCardPointerDown(cb) {
        pointerDownCb = cb;
      },
      onHoverChange(_cb) {
        return () => {
          /* not exercised here */
        };
      },
      destroy() {
        stub.destroyed = true;
      },
    },
    renders,
    selections,
    destroyed: false,
    click(cardId) {
      pointerDownCb?.(cardId);
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

// ---------------------------------------------------------------------------
// Result → command mapping (pure)
// ---------------------------------------------------------------------------

useGameStore.getState().startRun('map-test', DEFAULT_CONFIG);
const SAMPLE_STATE = currentGame();

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
      expect(() => mapResultToCommand(result, SAMPLE_STATE)).not.toThrow();
    }
  });

  it('maps resolve/room-transition/terminal results to render', () => {
    const render: GameResult['type'][] = [
      'RoomDealt',
      'MonsterDefeated',
      'WeaponEquipped',
      'PotionQuaffed',
      'RanAway',
      'GameWon',
      'GameLost',
    ];
    for (const result of ALL_RESULTS.filter((r) => render.includes(r.type))) {
      expect(mapResultToCommand(result, SAMPLE_STATE).kind).toBe('render');
    }
  });

  it('maps UndoDone (and defensively RunStarted) to rebuild', () => {
    expect(mapResultToCommand({ type: 'UndoDone' }, SAMPLE_STATE).kind).toBe('rebuild');
    expect(
      mapResultToCommand({ type: 'RunStarted', seed: 's', config: DEFAULT_CONFIG }, SAMPLE_STATE)
        .kind,
    ).toBe('rebuild');
  });

  it('maps no-op results (RunAwayBlocked, InvalidAction) to noop — driven by lastResult, never the diff', () => {
    expect(
      mapResultToCommand({ type: 'RunAwayBlocked', reason: 'already-engaged' }, SAMPLE_STATE).kind,
    ).toBe('noop');
    expect(
      mapResultToCommand({ type: 'InvalidAction', reason: 'not-a-monster' }, SAMPLE_STATE).kind,
    ).toBe('noop');
  });

  it('degrades to noop when there is no state to render', () => {
    for (const result of ALL_RESULTS) {
      expect(mapResultToCommand(result, null).kind).toBe('noop');
    }
  });

  it('throws on a result variant outside the union (runtime guard)', () => {
    expect(() =>
      mapResultToCommand({ type: 'NotARealResult' } as unknown as GameResult, SAMPLE_STATE),
    ).toThrow(/Unhandled GameResult variant/);
  });

  it('exposes the acted-on card for Phase 2 sprite targeting', () => {
    const defeated = mapResultToCommand(
      {
        type: 'MonsterDefeated',
        cardId: 'club-2',
        damage: 0,
        usedWeaponId: null,
        weaponBroke: false,
      },
      SAMPLE_STATE,
    );
    expect(defeated).toEqual({ kind: 'render', cardId: 'club-2' });
    const dealt = mapResultToCommand(
      { type: 'RoomDealt', cards: [], carriedFrom: null },
      SAMPLE_STATE,
    );
    expect(dealt).toEqual({ kind: 'render', cardId: null });
  });
});

describe('attachStoreBridge', () => {
  it('first sync renders the full current state and seeds seq — no replay of pre-mount results', () => {
    useGameStore.getState().startRun('seeded', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    // Snapshot first sync: the full room rendered statically, once.
    expect(stub.renders).toHaveLength(1);
    expect(stub.renders[0]).toMatchObject({
      state: currentGame(),
      selection: null,
    });

    // The pre-mount result (RoomDealt) is NOT replayed; the next action adds
    // exactly one render.
    act(firstRoomAction(currentGame()));
    expect(stub.renders).toHaveLength(2);
    expect(stub.renders[1]!.state!.room).toEqual(currentGame().room);

    bridge.destroy();
  });

  it('empty store first sync renders null and picks up startRun via the cue sheet', () => {
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    expect(stub.renders).toEqual([{ state: null, selection: null }]);

    useGameStore.getState().startRun('late-start', DEFAULT_CONFIG);
    expect(stub.renders).toHaveLength(2);
    expect(stub.renders[1]!.state!.room).toEqual(currentGame().room);
    bridge.destroy();
  });

  it('no-op results (RunAwayBlocked, InvalidAction) flow through the mapping without a render', () => {
    useGameStore.getState().startRun('noop-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    act({ type: 'RunAway' }); // legal → RanAway render
    expect(stub.renders).toHaveLength(2);
    const blocked = stub.renders.at(-1)!.state!;
    expect(blocked.room).toEqual(currentGame().room);

    act({ type: 'RunAway' }); // twice in a row → RunAwayBlocked, no-op state
    expect(store().getState().lastResult!.result.type).toBe('RunAwayBlocked');
    expect(stub.renders).toHaveLength(2); // no render, and not lost to the diff either

    act({ type: 'EnterNextRoom' }); // InvalidAction (room-not-resolved)
    expect(store().getState().lastResult!.result.type).toBe('InvalidAction');
    expect(stub.renders).toHaveLength(2);

    bridge.destroy();
  });

  it('undo triggers a full rebuild via the diff fallback (no forward payload)', () => {
    useGameStore.getState().startRun('undo-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

    const roomBefore = currentGame().room;
    act(firstRoomAction(currentGame()));
    expect(currentGame().room).not.toEqual(roomBefore);
    const afterResolve = stub.renders.length;

    act({ type: 'UndoToRoomStart' });
    const last = stub.renders.at(-1)!;
    expect(last.state!.room).toEqual(roomBefore); // restored from roomSnapshot
    expect(stub.renders.length).toBeGreaterThan(afterResolve);

    bridge.destroy();
  });

  it('any state mismatch without a fresh result rebuilds the scene (diff fallback)', () => {
    useGameStore.getState().startRun('drift-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    const before = stub.renders.length;

    // Simulate a state change that bypasses the result channel entirely.
    const g = currentGame();
    useGameStore.setState({ game: { ...g, hp: g.hp - 3 } });

    expect(stub.renders).toHaveLength(before + 1);
    expect(stub.renders.at(-1)!.state!.hp).toBe(g.hp - 3);

    // A second identical-state notification does NOT rebuild (model matches).
    useGameStore.setState({ game: { ...currentGame() } });
    expect(stub.renders).toHaveLength(before + 1);

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
    store().getState().selectCard('spade-a');
    const lastRender = stub.renders.at(-1)!.state!;
    if (lastRender.room.includes('spade-a')) throw new Error('test setup assumption broken');
    expect(stub.selections.at(-1)).toBeNull();

    // Canvas toggle: clicking the same card again deselects (PlayScreen parity).
    store().getState().selectCard(target);
    stub.click(target);
    expect(store().getState().selectedCardId).toBeNull();
    expect(stub.selections.at(-1)).toBeNull();

    // Clear on resolve: the selected card leaves the room — selection is filtered off,
    // and the trailing selectCard(null) notification changes nothing further.
    const other = room[0] as CardId;
    store().getState().selectCard(other);
    const selectionsBefore = stub.selections.length;
    act(firstRoomAction(currentGame()));
    if (other !== undefined) {
      expect(stub.selections.at(-1)).toBeNull(); // ring-off on the act notification
    }
    store().getState().selectCard(null); // PlayScreen's second notification
    expect(stub.selections.length).toBe(selectionsBefore + 1); // idempotent clear: no extra

    bridge.destroy();
  });

  it('terminal results still render from state before React switches screens', () => {
    useGameStore.getState().startRun('terminal-run', DEFAULT_CONFIG);
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());

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
    expect(currentGame().phase).toBe('lost');
    const last = stub.renders.at(-1)!;
    expect(last.state!.phase).toBe('lost');

    bridge.destroy();
  });

  it('destroy unsubscribes from the store', () => {
    const stub = makeSceneStub();
    const bridge = attachStoreBridge(stub.api, store());
    expect(stub.destroyed).toBe(false);
    bridge.destroy();
    expect(stub.destroyed).toBe(true);

    const before = stub.renders.length;
    useGameStore.getState().startRun('after-destroy', DEFAULT_CONFIG);
    expect(stub.renders).toHaveLength(before);
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
