import Phaser from 'phaser';
import type { CardId } from '../engine';
import { useGameStore } from '../store/game-store';
import { attachStoreBridge, type StoreBridge } from './store-bridge';
import { DESIGN_HEIGHT, DESIGN_WIDTH, SCENE_READY_EVENT, TableScene } from './table-scene';

/**
 * Design resolution rationale (checked against `assets/*.jpg`, 1152×1728 → a
 * clean 2:3 card aspect): at a 120×180 card the layout is weapon zone (52–172)
 * + 2×2 room grid (316–592, 24px gaps) + kill stack zone (616–932, 40/16px fan
 * steps) — every zone fits with margins, and 960×600 is an 8:5 (16:10) box, a
 * standard aspect-ratio CSS unit for the sized play container that Phase 1's
 * layout restructure needs. FIT scales it to any container; `antialias: true`
 * for JPEG card art (NEVER `pixelArt`), and Phaser 4 has no resolution/dpr
 * config, so the fixed 960×600 backbuffer + FIT is the crispness baseline.
 */
export { DESIGN_HEIGHT, DESIGN_WIDTH };

/** The public handle the React play screen codes against. */
export interface PlayTableHandle {
  destroy(): void;
  /** Resolves once the scene + all textures are loaded (or placeholder-substituted). */
  whenReady(): Promise<void>;
  /** Sprite pointerover/pointerout; the callback receives the hovered CardId or null. */
  onHover(cb: (cardId: CardId | null) => void): () => void;
  /** dataURL via the renderer's snapshot (promise-wrapped). */
  snapshot(): Promise<string>;
}

const handles = new WeakMap<HTMLElement, PlayTableHandle>();

/** Defensive mitigation for phaserjs/phaser#7372 (WebGL rotated-texture tearing
 * in multi-texture batches): cap parallel texture units at 1, per the issue's
 * own cited workaround. Guarded — the CanvasRenderer has no renderNodes. */
function applyBug7372Mitigation(game: Phaser.Game): void {
  const renderer = game.renderer as {
    renderNodes?: { setMaxParallelTextureUnits?: (value?: number) => void };
  } | null;
  if (renderer?.renderNodes?.setMaxParallelTextureUnits !== undefined) {
    renderer.renderNodes.setMaxParallelTextureUnits(1);
  }
}

/**
 * Creates the Phaser play table inside `container`. Idempotent per container:
 * a second call with the same container returns the existing handle (the
 * create-once guard that protects against StrictMode double-effect / HMR
 * overlap; React owns the actual create/destroy lifecycle).
 */
export function createPlayTable(
  container: HTMLElement,
  opts?: { reducedMotion?: boolean },
): PlayTableHandle {
  const existing = handles.get(container);
  if (existing !== undefined) return existing;

  const tableScene = new TableScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    antialias: true, // JPEG card art — never pixelArt
    backgroundColor: '#0f172a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent: container,
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
    },
    // The DOM room mirror overlays the room sprites exactly (it is the
    // pointer-input proxy for e2e, plan §4 Phase 1). Phaser additionally binds
    // window-level mousedown/mouseup listeners (`inputWindowEvents`), which
    // would hit-test sprites UNDER the mirror on every mirror click — the
    // sprite toggle plus the mirror's React toggle double-fire and net out to
    // no selection. Window events off: canvas-level listeners stay, so clicks
    // outside the mirror still reach the canvas, while clicks over the cards
    // go through the mirror alone.
    input: { windowEvents: false },
    scene: [tableScene],
  });

  // The renderer is created during the async boot; apply now and again on READY.
  try {
    applyBug7372Mitigation(game);
  } catch {
    /* renderer not yet available */
  }
  game.events.once('ready', () => applyBug7372Mitigation(game));

  let readyResolve: (() => void) | null = null;
  const ready = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  let bridge: StoreBridge | null = null;
  let destroyed = false;

  // Scene-systems boot gate. Phaser defers scene creation until the game's
  // `ready` event (SceneManager.bootQueue runs first within that same emit),
  // so `tableScene.events` is undefined at construction time — the
  // SCENE_READY subscriptions must be attached here, not immediately. By the
  // time this handler runs the scene exists and its async preload has not
  // completed, so create() (which emits SCENE_READY_EVENT) cannot have fired.
  game.events.once('ready', () => {
    // Readiness marker for the React lane's whenReady()/e2e gate.
    tableScene.events.once(SCENE_READY_EVENT, () => {
      if (destroyed) return;
      container.dataset.tableReady = 'true';
      readyResolve?.();
    });

    // Snapshot-first-sync + seq-gated cue consumption, wired only once the scene
    // can actually render (all textures loaded or placeholder-substituted).
    tableScene.events.once(SCENE_READY_EVENT, () => {
      if (destroyed) return;
      bridge = attachStoreBridge(tableScene, useGameStore, {
        reducedMotion: opts?.reducedMotion === true,
      });
    });
  });

  const handle: PlayTableHandle = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      handles.delete(container);
      delete container.dataset.tableReady;
      bridge?.destroy();
      bridge = null;
      game.destroy(true); // Phaser 4 destroy is asynchronous — callers must not rely on sync teardown
    },
    whenReady() {
      return ready;
    },
    onHover(cb) {
      return tableScene.onHoverChange(cb);
    },
    snapshot() {
      return ready.then(
        () =>
          new Promise<string>((resolve, reject) => {
            const renderer = game.renderer;
            if (!renderer) {
              reject(new Error('play table has no renderer to snapshot'));
              return;
            }
            renderer.snapshot((snapshot) => {
              if (snapshot instanceof HTMLCanvasElement) {
                resolve(snapshot.toDataURL('image/png'));
              } else if ('src' in snapshot) {
                resolve(snapshot.src);
              } else {
                reject(new Error('unsupported snapshot payload'));
              }
            }, 'image/png');
          }),
      );
    },
  };

  handles.set(container, handle);
  return handle;
}
