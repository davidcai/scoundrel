import { describe, expect, it } from 'vitest';
import {
  createBoardBridge,
  type BoardIntent,
  type BoardSyncPayload,
  type CardHoverPayload,
} from '../src/game/bridge';
import { DEFAULT_CONFIG, createInitialState, type CardId, type GameState } from '../src/engine';

// Payload factories — identity matters (replay must deliver the SAME object).
const stateA = createInitialState('seed-a', DEFAULT_CONFIG);

function syncPayload(state: GameState | null = stateA): BoardSyncPayload {
  // Fresh object per call — tests distinguish payloads by identity (toBe).
  return {
    state,
    prevState: null,
    lastResult: null,
    selectedCardId: null,
    runResumed: false,
  };
}

const hoverPayload = (cardId: CardId = 'club-8', over = true): CardHoverPayload => ({
  cardId,
  over,
});

const clickIntent = (cardId: CardId = 'club-8'): BoardIntent => ({ type: 'cardClick', cardId });

describe('sync channel (store → scene)', () => {
  it('delivers every sync to all subscribers', () => {
    const bridge = createBoardBridge();
    const seen: BoardSyncPayload[] = [];
    bridge.onSync((p) => seen.push(p));
    bridge.onSync((p) => seen.push(p));
    const first = syncPayload();
    const second = syncPayload();
    bridge.emitSync(first);
    bridge.emitSync(second);
    // Fan-out is per-emit across listeners: [l1(first), l2(first), l1(second), l2(second)].
    expect(seen).toHaveLength(4);
    expect(seen[0]).toBe(first);
    expect(seen[1]).toBe(first);
    expect(seen[2]).toBe(second);
    expect(seen[3]).toBe(second);
  });

  it('stops delivering after unsubscribe', () => {
    const bridge = createBoardBridge();
    const seen: BoardSyncPayload[] = [];
    const unsub = bridge.onSync((p) => seen.push(p));
    const payload = syncPayload();
    bridge.emitSync(payload);
    unsub();
    bridge.emitSync(syncPayload());
    expect(seen).toEqual([payload]);
  });

  it('replays the latest sync to a late subscriber (boot after initial emit)', () => {
    const bridge = createBoardBridge();
    const initial = syncPayload();
    bridge.emitSync(initial);
    const seen: BoardSyncPayload[] = [];
    bridge.onSync((p) => seen.push(p));
    // Delivered synchronously at subscribe time — the scene must not miss
    // the initial/hydrate sync even though it subscribed late.
    expect(seen).toEqual([initial]);
    expect(seen[0]).toBe(initial);
  });

  it('replays only the latest sync when several were emitted before subscribing', () => {
    const bridge = createBoardBridge();
    bridge.emitSync(syncPayload());
    const latest = syncPayload();
    bridge.emitSync(latest);
    const seen: BoardSyncPayload[] = [];
    bridge.onSync((p) => seen.push(p));
    expect(seen).toEqual([latest]);
  });

  it('does not double-deliver the replayed sync to earlier subscribers', () => {
    const bridge = createBoardBridge();
    const early: BoardSyncPayload[] = [];
    bridge.onSync((p) => early.push(p));
    bridge.emitSync(syncPayload());
    const before = early.length;
    bridge.onSync(() => undefined); // late subscriber triggers replay
    expect(early.length).toBe(before);
  });
});

describe('hover channel (transient)', () => {
  it('delivers hover payloads to subscribers and stops after unsubscribe', () => {
    const bridge = createBoardBridge();
    const seen: CardHoverPayload[] = [];
    const unsub = bridge.onCardHover((p) => seen.push(p));
    bridge.emitCardHover(hoverPayload('club-8', true));
    unsub();
    bridge.emitCardHover(hoverPayload('club-8', false));
    expect(seen).toEqual([hoverPayload('club-8', true)]);
  });

  it('does not replay hover state to late subscribers', () => {
    const bridge = createBoardBridge();
    bridge.emitCardHover(hoverPayload('club-8', true));
    const seen: CardHoverPayload[] = [];
    bridge.onCardHover((p) => seen.push(p));
    // Nothing until the NEXT hover event — hover is transient.
    expect(seen).toEqual([]);
    const next = hoverPayload('diamond-5', false);
    bridge.emitCardHover(next);
    expect(seen).toEqual([next]);
  });
});

describe('sceneReady channel (one-shot by scene contract)', () => {
  it('delivers the ready signal to subscribers', () => {
    const bridge = createBoardBridge();
    let readyCount = 0;
    bridge.onSceneReady(() => {
      readyCount += 1;
    });
    bridge.emitSceneReady();
    expect(readyCount).toBe(1);
  });

  it('does not replay the ready signal to late subscribers', () => {
    const bridge = createBoardBridge();
    bridge.emitSceneReady();
    let readyCount = 0;
    bridge.onSceneReady(() => {
      readyCount += 1;
    });
    // No replay — contrast with onSync. The one-shot-ness ("emitted at most
    // once per scene instance") is the scene's contract; the bridge only
    // promises not to store and replay the signal.
    expect(readyCount).toBe(0);
  });

  it('stops delivering after unsubscribe', () => {
    const bridge = createBoardBridge();
    let readyCount = 0;
    const unsub = bridge.onSceneReady(() => {
      readyCount += 1;
    });
    unsub();
    bridge.emitSceneReady();
    expect(readyCount).toBe(0);
  });
});

describe('intent channel (scene → store)', () => {
  it('delivers intents to subscribers', () => {
    const bridge = createBoardBridge();
    const seen: BoardIntent[] = [];
    bridge.onIntent((i) => seen.push(i));
    const intent = clickIntent('diamond-4');
    bridge.emitIntent(intent);
    expect(seen).toEqual([intent]);
    expect(seen[0]).toBe(intent);
  });

  it('stops delivering after unsubscribe', () => {
    const bridge = createBoardBridge();
    const seen: BoardIntent[] = [];
    const unsub = bridge.onIntent((i) => seen.push(i));
    unsub();
    bridge.emitIntent(clickIntent());
    expect(seen).toEqual([]);
  });
});

describe('emit-time listener mutation (iterated copy)', () => {
  it('lets a listener unsubscribe itself mid-emit without breaking others', () => {
    const bridge = createBoardBridge();
    const selfSeen: BoardSyncPayload[] = [];
    const otherSeen: BoardSyncPayload[] = [];
    let unsubSelf: () => void = () => undefined;
    unsubSelf = bridge.onSync((p) => {
      selfSeen.push(p);
      unsubSelf();
    });
    bridge.onSync((p) => otherSeen.push(p));
    bridge.emitSync(syncPayload());
    bridge.emitSync(syncPayload());
    // The self-unsubscribed listener saw exactly the first emit; the other
    // listener kept receiving every emit.
    expect(selfSeen).toHaveLength(1);
    expect(otherSeen).toHaveLength(2);
  });

  it('still delivers the current emit to a listener removed mid-emit', () => {
    const bridge = createBoardBridge();
    const firstSeen: BoardSyncPayload[] = [];
    const secondSeen: BoardSyncPayload[] = [];
    let unsubSecond: () => void = () => undefined;
    bridge.onSync(() => {
      // Remove the other listener while the emit is in flight — the copy
      // already contains it, so it must still see this payload.
      unsubSecond();
    });
    unsubSecond = bridge.onSync((p) => secondSeen.push(p));
    bridge.onSync((p) => firstSeen.push(p));
    const payload = syncPayload();
    bridge.emitSync(payload);
    expect(secondSeen).toEqual([payload]);
    bridge.emitSync(syncPayload());
    expect(secondSeen).toEqual([payload]); // gone for subsequent emits
    expect(firstSeen).toHaveLength(2);
  });

  it('delivers the in-flight sync to a listener added mid-emit, exactly once', () => {
    const bridge = createBoardBridge();
    const lateSeen: BoardSyncPayload[] = [];
    let midCount = 0;
    bridge.onSync(() => {
      if (midCount === 0) {
        midCount += 1;
        // emitSync assigns latestSync BEFORE fanning out, so subscribing
        // mid-emit replays the in-flight payload to the new listener:
        // it misses nothing and receives it exactly once (no double
        // delivery from the current emit's iteration, which iterates a
        // snapshot taken before the mutation).
        bridge.onSync((p) => lateSeen.push(p));
      }
    });
    const first = syncPayload();
    bridge.emitSync(first);
    expect(lateSeen).toHaveLength(1);
    expect(lateSeen[0]).toBe(first);
    bridge.emitSync(syncPayload());
    expect(lateSeen).toHaveLength(2);
  });
});

describe('destroy', () => {
  it('stops delivery on every channel and drops the replay cache', () => {
    const bridge = createBoardBridge();
    const syncSeen: BoardSyncPayload[] = [];
    const hoverSeen: CardHoverPayload[] = [];
    let readyCount = 0;
    const intentSeen: BoardIntent[] = [];
    bridge.onSync((p) => syncSeen.push(p));
    bridge.onCardHover((p) => hoverSeen.push(p));
    bridge.onSceneReady(() => {
      readyCount += 1;
    });
    bridge.onIntent((i) => intentSeen.push(i));
    bridge.emitSync(syncPayload()); // warms the replay cache
    bridge.destroy();
    bridge.emitSync(syncPayload());
    bridge.emitCardHover(hoverPayload());
    bridge.emitSceneReady();
    bridge.emitIntent(clickIntent());
    // One delivery from before destroy; nothing after.
    expect(syncSeen).toHaveLength(1);
    expect(hoverSeen).toEqual([]);
    expect(readyCount).toBe(0);
    expect(intentSeen).toEqual([]);
  });

  it('is idempotent and makes post-destroy subscriptions no-ops', () => {
    const bridge = createBoardBridge();
    bridge.emitSync(syncPayload());
    bridge.destroy();
    expect(() => bridge.destroy()).not.toThrow();
    const seen: BoardSyncPayload[] = [];
    const unsub = bridge.onSync((p) => seen.push(p));
    expect(() => unsub()).not.toThrow();
    bridge.emitSync(syncPayload());
    expect(seen).toEqual([]);
  });
});
