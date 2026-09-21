import * as Phaser from 'phaser';
import type { CardId } from '../engine';
import { computeBoardLayout, MAX_ROOM_CARDS } from './board-layout';
import { readRoomMetrics } from './board-metrics';
import { createCardSprite, type CardSpriteHandle } from './card-sprite';
import type { BoardBridge, BoardSyncPayload, CardHoverPayload } from './bridge';

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
 * shared pure layout function `computeBoardLayout` fed by the SAME metrics
 * path as the DOM hit-layer (readRoomMetrics of the `.room` computed style),
 * re-applied on every scale `resize` — the scene's sprite rects and the
 * hit-layer button rects agree to the pixel by construction.
 *
 * Reconciliation: DIFF-BASED, and it is the single mechanism. On every bridge
 * sync — including mount/hydrate, where `prevState` and `lastResult` are null —
 * sprites are reconciled to `state.room`. `lastResult` is a choreography hint
 * only and is deliberately unused in this spike: no tweens here (and no angle
 * tweens ever — phaserjs/phaser#7341). No-op diff frames (the store emits two
 * notifications per resolve) reconcile to the same room and change nothing.
 *
 * After its FIRST reconcile completes, the scene emits `sceneReady` on the
 * bridge — the signal the wrapper uses to promote the canvas live.
 */
export class BoardScene extends Phaser.Scene {
  private bridge: BoardBridge | null = null;
  private offSync: (() => void) | null = null;
  private offHover: (() => void) | null = null;
  private lastSync: BoardSyncPayload | null = null;
  private readonly sprites = new Map<CardId, CardSpriteHandle>();
  private readonly hoveredCards = new Set<CardId>();
  private readyEmitted = false;

  constructor() {
    super(SCENE_KEY);
  }

  init(data: BoardSceneData | undefined): void {
    this.bridge = data?.bridge ?? null;
    this.offSync = null;
    this.offHover = null;
    this.lastSync = null;
    this.readyEmitted = false;
  }

  create(): void {
    const bridge = this.bridge;
    if (bridge !== null) {
      // The bridge replays the latest sync (the initial/hydrate emit that
      // happened before this scene finished booting), so the board populates
      // immediately — including resume-from-save.
      this.offSync = bridge.onSync(this.applySync);
      this.offHover = bridge.onCardHover(this.applyHover);
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  private readonly applySync = (payload: BoardSyncPayload): void => {
    this.lastSync = payload;
    this.reconcileRoom();
  };

  private readonly applyHover = (payload: CardHoverPayload): void => {
    if (payload.over) this.hoveredCards.add(payload.cardId);
    else this.hoveredCards.delete(payload.cardId);
    this.sprites.get(payload.cardId)?.setHovered(payload.over);
  };

  private readonly handleResize = (): void => {
    if (this.lastSync !== null) this.reconcileRoom();
  };

  /**
   * The `.room` element — the canvas container's parent — whose computed
   * style is the shared metrics source (same element the DOM hook observes).
   */
  private roomElement(): HTMLElement | null {
    const parent = (this.game?.scale?.parent ?? null) as HTMLElement | null;
    return parent?.parentElement ?? null;
  }

  /** Diff current sprites against `state.room`, positioned by the layout fn. */
  private reconcileRoom(): void {
    const payload = this.lastSync;
    const room = payload !== null && payload.state !== null ? payload.state.room : [];
    const count = Math.min(room.length, MAX_ROOM_CARDS);
    const layout = computeBoardLayout(
      this.scale.width,
      this.scale.height,
      count,
      readRoomMetrics(this.roomElement()),
    );

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
        existing.setHovered(this.hoveredCards.has(cardId));
        return;
      }
      const sprite = createCardSprite(this, cardId, rect);
      // NOT interactive: per the plan, the canvas never receives pointer
      // events (the DOM layer owns all input; Phase 2's hit-layer emits
      // cardClick). Phaser's window-level input listeners must stay off —
      // they intercept DOM clicks anywhere on the page.
      this.sprites.set(cardId, sprite);
    });

    // One-shot: the first reconcile (clear-board included) is complete — the
    // wrapper may now promote the canvas to the room's primary renderer.
    if (!this.readyEmitted && this.bridge !== null) {
      this.readyEmitted = true;
      this.bridge.emitSceneReady();
    }
  }

  private teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.offSync?.();
    this.offSync = null;
    this.offHover?.();
    this.offHover = null;
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.hoveredCards.clear();
    this.lastSync = null;
  }
}
