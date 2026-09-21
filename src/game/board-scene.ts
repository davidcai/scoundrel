import * as Phaser from 'phaser';
import type { CardId } from '../engine';
import { computeBoardLayout, MAX_ROOM_CARDS } from './board-layout';
import { createCardSprite, type CardSpriteHandle } from './card-sprite';
import type { BoardBridge, BoardSyncPayload } from './bridge';

export const SCENE_KEY = 'board';

/** Data passed via `game.scene.add(SCENE_KEY, BoardScene, true, { bridge })`. */
export interface BoardSceneData {
  bridge: BoardBridge;
}

/**
 * The single Phaser scene for the play-screen card table (Phase 0 decision:
 * the canvas owns the ROOM only — the weapon zone stays DOM).
 *
 * Geometry: Scale.RESIZE on the parent element; sprites are positioned by the
 * shared pure layout function `computeBoardLayout` (same function the DOM
 * hit-layer consumes), re-applied on every scale `resize`.
 *
 * Reconciliation: DIFF-BASED, and it is the single mechanism. On every bridge
 * sync — including mount/hydrate, where `prevState` and `lastResult` are null —
 * sprites are reconciled to `state.room`. `lastResult` is a choreography hint
 * only and is deliberately unused in this spike: no tweens here (and no angle
 * tweens ever — phaserjs/phaser#7341). No-op diff frames (the store emits two
 * notifications per resolve) reconcile to the same room and change nothing.
 */
export class BoardScene extends Phaser.Scene {
  private bridge: BoardBridge | null = null;
  private offSync: (() => void) | null = null;
  private lastSync: BoardSyncPayload | null = null;
  private readonly sprites = new Map<CardId, CardSpriteHandle>();

  constructor() {
    super(SCENE_KEY);
  }

  init(data: BoardSceneData | undefined): void {
    this.bridge = data?.bridge ?? null;
    this.offSync = null;
    this.lastSync = null;
  }

  create(): void {
    const bridge = this.bridge;
    if (bridge !== null) {
      // The bridge replays the latest sync (the initial/hydrate emit that
      // happened before this scene finished booting), so the board populates
      // immediately — including resume-from-save.
      this.offSync = bridge.onSync(this.applySync);
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  private readonly applySync = (payload: BoardSyncPayload): void => {
    this.lastSync = payload;
    this.reconcileRoom();
  };

  private readonly handleResize = (): void => {
    if (this.lastSync !== null) this.reconcileRoom();
  };

  /** Diff current sprites against `state.room`, positioned by the layout fn. */
  private reconcileRoom(): void {
    const payload = this.lastSync;
    const room = payload !== null && payload.state !== null ? payload.state.room : [];
    const count = Math.min(room.length, MAX_ROOM_CARDS);
    const layout = computeBoardLayout(this.scale.width, this.scale.height, count);

    // Removals: cards no longer in the room (resolved, fled, undone, run over).
    const nextIds = new Set<CardId>(room);
    for (const [cardId, sprite] of [...this.sprites]) {
      if (!nextIds.has(cardId)) {
        sprite.destroy();
        this.sprites.delete(cardId);
      }
    }

    // Additions + repositioning. Tolerates rooms with < 4 cards (fewer slots
    // are laid out) and > 4 defensively (extra cards would have no rect).
    room.forEach((cardId, index) => {
      const rect = layout.roomRects[index];
      if (rect === undefined) return;
      const existing = this.sprites.get(cardId);
      if (existing !== undefined) {
        existing.setRect(rect);
        return;
      }
      const sprite = createCardSprite(this, cardId, rect);
      // NOT interactive: per the plan, the canvas never receives pointer
      // events (the DOM layer owns all input; Phase 2's hit-layer emits
      // cardClick). Phaser's window-level input listeners must stay off —
      // they intercept DOM clicks anywhere on the page.
      this.sprites.set(cardId, sprite);
    });
  }

  private teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.offSync?.();
    this.offSync = null;
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.lastSync = null;
  }
}
