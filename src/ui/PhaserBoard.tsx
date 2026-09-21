import { useLayoutEffect, useRef, useState } from 'react';
import type { GameResult, GameState } from '../engine';
import type { BoardBridge } from '../game/bridge';
import { useGameStore } from '../store/game-store';

/**
 * React mount wrapper for the Phaser board (official template-react-ts pattern,
 * adapted). Renders a plain container div; the Phaser.Game is created inside a
 * `useLayoutEffect` and destroyed on cleanup. All data flows through the
 * bridge — passed in by PlayScreen (which also feeds it the DOM hover events),
 * so nothing can go stale in the dep array.
 *
 * Guarantees:
 * - jsdom/test guard FIRST: under vitest (`MODE === 'test'`) or when WebGL is
 *   unavailable, nothing is rendered/mounted and phaser is NEVER imported
 *   (no WebGL in jsdom — keeps the RTL suite green without mocks). The DOM
 *   fallback in that case renders EXACTLY the pre-canvas UI (no `canvas-live`).
 * - Dynamic `import('phaser')` only — the engine (~355KB gz, no tree-shaking)
 *   stays out of the main chunk and only loads on the play board.
 * - StrictMode / rapid-route-toggle safety: `game.destroy(true)` only COMPLETES
 *   on the next animation frame (deferred destroy), so we never treat a
 *   constructing/destroying game as live. The local `disposed` flag — set
 *   synchronously in cleanup and re-checked after every await — is the single
 *   source of truth: if the async import resolves after cleanup, nothing is
 *   constructed; each mount owns an independent Phaser.Game, so a
 *   still-destroying old instance can never be touched or double-destroyed,
 *   and StrictMode's mount→cleanup→mount cycle yields exactly one live game.
 *
 * Canvas-live contract (Phase 2): the container div gains the `canvas-live`
 * class when the scene completes its FIRST reconcile (`sceneReady` on the
 * bridge) — not on boot start — and loses it on teardown/unmount. PlayScreen
 * is notified via `onLiveChange` in the same commit so the room's promotion
 * CSS and the transparent hit-layer swap atomically (no blank-room frame).
 * The bridge itself is owned (and destroyed) by PlayScreen.
 */

/**
 * Store snapshots carry `lastResult` after the parallel store-plumbing lane
 * lands; read defensively so this works before and after. (The store is not
 * imported here beyond `useGameStore` itself.)
 */
type FxSource = { game: GameState | null; lastResult?: GameResult | null };

function readLastResult(snapshot: FxSource): GameResult | null {
  return snapshot.lastResult ?? null;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) !== null;
  } catch {
    return false;
  }
}

/** Structural view — keeps any static phaser reference out of this file. */
interface DestroyableGame {
  destroy(removeCanvas: boolean): void;
}

interface PhaserBoardProps {
  /** Store⇄scene channel; owned and destroyed by PlayScreen. Null in test mode. */
  bridge: BoardBridge | null;
  /** Canvas-live flip: true on the scene's first reconcile, false on teardown. */
  onLiveChange?: (live: boolean) => void;
}

export function PhaserBoard({ bridge, onLiveChange }: PhaserBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);
  // Keep the latest callback without re-running the mount effect.
  const onLiveChangeRef = useRef(onLiveChange);
  onLiveChangeRef.current = onLiveChange;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    // ── Environment guards — before any phaser import ──────────────────────
    if (import.meta.env.MODE === 'test') return; // jsdom/RTL: never import phaser
    if (!hasWebGL()) return; // WebGL unavailable: render nothing (DOM fallback)
    if (bridge === null) return; // bridge not created yet (first render frame)

    let disposed = false;
    let game: DestroyableGame | null = null;

    const notifyLive = (value: boolean): void => {
      setLive(value);
      onLiveChangeRef.current?.(value);
    };

    // Initial sync (mount/hydrate/resume path: prevState null). The bridge
    // replays the latest payload to late subscribers, so the scene — which
    // finishes booting asynchronously — still receives it.
    const initial = useGameStore.getState();
    bridge.emitSync({
      state: initial.game,
      prevState: null,
      lastResult: readLastResult(initial),
    });

    const unsubscribeStore = useGameStore.subscribe((state, prevState) => {
      bridge.emitSync({
        state: state.game,
        prevState: prevState.game,
        lastResult: readLastResult(state),
      });
    });

    const unsubscribeIntent = bridge.onIntent((intent) => {
      if (intent.type !== 'cardClick') return;
      const { selectedCardId, selectCard } = useGameStore.getState();
      // Toggle semantics: clicking the selected card clears the selection.
      selectCard(selectedCardId === intent.cardId ? null : intent.cardId);
    });

    const unsubscribeReady = bridge.onSceneReady(() => notifyLive(true));

    void (async () => {
      const [phaserModule, sceneModule] = await Promise.all([
        import('phaser'),
        import('../game/board-scene'),
      ]);
      // Re-check after every await — see the StrictMode note above.
      if (disposed || !container.isConnected) return;

      // Dynamic namespace import (not a static import): phaser's types are
      // `export = Phaser` and this repo does not enable esModuleInterop, so
      // the template's `(await import('phaser')).default` form does not
      // typecheck; the runtime namespace carries the same named exports.
      const phaserGame = new phaserModule.Game({
        type: phaserModule.AUTO,
        parent: container,
        transparent: true,
        // Input is fully disabled: Phaser's input system registers
        // window-level mouse listeners that would intercept DOM clicks
        // anywhere on the page (the scene is decorative pixels; the DOM
        // layer owns all interaction — see plan "DOM hit-layer").
        input: false,
        scale: {
          mode: phaserModule.Scale.RESIZE,
          autoCenter: phaserModule.Scale.NO_CENTER,
        },
        scene: [], // added below with the bridge, pre-boot (queued by SceneManager)
      });
      phaserGame.scene.add(sceneModule.SCENE_KEY, sceneModule.BoardScene, true, { bridge });
      game = phaserGame;
    })();

    return () => {
      disposed = true;
      unsubscribeStore();
      unsubscribeIntent();
      unsubscribeReady();
      // Deferred destroy: completes next frame. `disposed` guarantees nothing
      // touches this instance afterwards and the next mount builds fresh.
      game?.destroy(true);
      game = null;
      notifyLive(false);
    };
    // The bridge identity is stable per PlayScreen mount — recreated only if
    // StrictMode replays PlayScreen's own bridge effect.
  }, [bridge]);

  if (import.meta.env.MODE === 'test') return null; // jsdom: render nothing

  return (
    <div
      ref={containerRef}
      className={live ? 'phaser-board canvas-live' : 'phaser-board'}
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true" // decorative canvas; the DOM hit-layer owns semantics
    />
  );
}
