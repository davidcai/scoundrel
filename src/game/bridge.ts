import type { CardId, GameResult, GameState } from '../engine';

/**
 * Typed EventBus between the React store and the Phaser scene (the ONLY
 * channel between them). No zustand / phaser / DOM imports — both sides import
 * this module, so it must stay dependency-free.
 *
 * Data flow (one direction of truth, per phaser-adoption-plan):
 *   store subscribe → emitSync → scene reconciles
 *   scene pointer events → emitIntent → PhaserBoard → store.selectCard
 */

/**
 * store → scene. `state` is nullable because the store's `game` is nullable
 * (title screen, abandon/finish) — the scene clears its board in that case.
 * `lastResult` is a choreography HINT only; diff-based reconciliation across
 * `(prevState, state)` is the single source of truth, including mount/hydrate
 * where `lastResult` is null.
 */
export interface BoardSyncPayload {
  state: GameState | null;
  prevState: GameState | null;
  lastResult: GameResult | null;
}

/** scene → store. Phaser never mutates game state; it only emits intents. */
export type BoardIntent = { type: 'cardClick'; cardId: CardId };

export type SyncListener = (payload: BoardSyncPayload) => void;
export type IntentListener = (intent: BoardIntent) => void;
export type Unsubscribe = () => void;

export interface BoardBridge {
  /**
   * Subscribe to store→scene sync payloads. If a sync was already emitted
   * (PhaserBoard emits an initial sync before the scene finishes booting),
   * the latest payload is replayed to the new subscriber immediately.
   * Returns an unsubscribe function.
   */
  onSync(listener: SyncListener): Unsubscribe;
  /** Subscribe to scene→store intents. Returns an unsubscribe function. */
  onIntent(listener: IntentListener): Unsubscribe;
  emitSync(payload: BoardSyncPayload): void;
  emitIntent(intent: BoardIntent): void;
  /** Remove all listeners and stop delivery. Idempotent. */
  destroy(): void;
}

export function createBoardBridge(): BoardBridge {
  const syncListeners = new Set<SyncListener>();
  const intentListeners = new Set<IntentListener>();
  let latestSync: BoardSyncPayload | null = null;
  let destroyed = false;

  return {
    onSync(listener) {
      if (destroyed) return () => undefined;
      syncListeners.add(listener);
      // Late-subscriber replay: the scene boots asynchronously after the game
      // is constructed, so it must not miss the initial/hydrate sync.
      if (latestSync !== null) listener(latestSync);
      return () => {
        syncListeners.delete(listener);
      };
    },

    onIntent(listener) {
      if (destroyed) return () => undefined;
      intentListeners.add(listener);
      return () => {
        intentListeners.delete(listener);
      };
    },

    emitSync(payload) {
      if (destroyed) return;
      latestSync = payload;
      // Iterate a copy so listeners may unsubscribe/subscribe during emit.
      for (const listener of [...syncListeners]) listener(payload);
    },

    emitIntent(intent) {
      if (destroyed) return;
      for (const listener of [...intentListeners]) listener(intent);
    },

    destroy() {
      destroyed = true;
      latestSync = null;
      syncListeners.clear();
      intentListeners.clear();
    },
  };
}
