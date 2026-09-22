import type { CardId, GameResult, GameState } from '../engine';

/**
 * Typed EventBus between the React store and the Phaser scene (the ONLY
 * channel between them). No zustand / phaser / DOM imports — both sides import
 * this module, so it must stay dependency-free.
 *
 * Data flow (one direction of truth, per phaser-adoption-plan):
 *   store subscribe → emitSync → scene reconciles
 *   DOM hover (PlayScreen) → emitCardHover → scene tints the sprite
 *   scene first reconcile → emitSceneReady → wrapper promotes the canvas live
 *   scene pointer events → emitIntent → PhaserBoard → store.selectCard
 */

/**
 * store → scene. `state` is nullable because the store's `game` is nullable
 * (title screen, abandon/finish) — the scene clears its board in that case.
 * `lastResult` is a choreography HINT only; diff-based reconciliation across
 * `(prevState, state)` is the single source of truth, including mount/hydrate
 * where `lastResult` is null.
 *
 * `selectedCardId` (Phase 3) rides the same sync: selection changes emit a
 * payload whose `state`/`prevState` are identical — the scene treats that as
 * a glow-only beat and never kills in-flight choreography for it.
 *
 * `runResumed` (Phase 3) is true for a run restored from storage: the scene's
 * first reconcile for such a run is static (no mount deal).
 */
export interface BoardSyncPayload {
  state: GameState | null;
  prevState: GameState | null;
  lastResult: GameResult | null;
  selectedCardId: CardId | null;
  runResumed: boolean;
}

/**
 * store → scene, transient (no replay): the DOM hit-layer's hover state for a
 * room card. Phase 3: the scene answers with the glow preset (the alpha dip
 * remains as the no-WebGL fallback). The canvas itself never receives pointer
 * events — the DOM hit-layer owns all of them.
 */
export interface CardHoverPayload {
  cardId: CardId;
  over: boolean;
}

/** scene → store. Phaser never mutates game state; it only emits intents. */
export type BoardIntent = { type: 'cardClick'; cardId: CardId };

export type SyncListener = (payload: BoardSyncPayload) => void;
export type HoverListener = (payload: CardHoverPayload) => void;
export type SceneReadyListener = () => void;
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
  /**
   * Subscribe to store→scene hover payloads. Transient state — NO replay.
   * Returns an unsubscribe function.
   */
  onCardHover(listener: HoverListener): Unsubscribe;
  /**
   * Subscribe to the scene's one-shot "first reconcile completed" signal
   * (PhaserBoard flips the canvas live on it). Emitted at most once per
   * scene instance; no replay. Returns an unsubscribe function.
   */
  onSceneReady(listener: SceneReadyListener): Unsubscribe;
  /** Subscribe to scene→store intents. Returns an unsubscribe function. */
  onIntent(listener: IntentListener): Unsubscribe;
  emitSync(payload: BoardSyncPayload): void;
  emitCardHover(payload: CardHoverPayload): void;
  emitSceneReady(): void;
  emitIntent(intent: BoardIntent): void;
  /** Remove all listeners and stop delivery. Idempotent. */
  destroy(): void;
}

export function createBoardBridge(): BoardBridge {
  const syncListeners = new Set<SyncListener>();
  const hoverListeners = new Set<HoverListener>();
  const readyListeners = new Set<SceneReadyListener>();
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

    onCardHover(listener) {
      if (destroyed) return () => undefined;
      hoverListeners.add(listener);
      return () => {
        hoverListeners.delete(listener);
      };
    },

    onSceneReady(listener) {
      if (destroyed) return () => undefined;
      readyListeners.add(listener);
      return () => {
        readyListeners.delete(listener);
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

    emitCardHover(payload) {
      if (destroyed) return;
      for (const listener of [...hoverListeners]) listener(payload);
    },

    emitSceneReady() {
      if (destroyed) return;
      for (const listener of [...readyListeners]) listener();
    },

    emitIntent(intent) {
      if (destroyed) return;
      for (const listener of [...intentListeners]) listener(intent);
    },

    destroy() {
      destroyed = true;
      latestSync = null;
      syncListeners.clear();
      hoverListeners.clear();
      readyListeners.clear();
      intentListeners.clear();
    },
  };
}
