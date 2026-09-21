import * as Phaser from 'phaser';
import type { CardId } from '../engine';
import { loadSettings } from '../store/settings';
import { computeBoardLayout, MAX_ROOM_CARDS, type BoardLayout, type Rect } from './board-layout';
import { readRoomMetrics } from './board-metrics';
import { createCardSprite, type CardSpriteHandle } from './card-sprite';
import {
  confettiFall,
  emberFall,
  FX_COLOR,
  killSpark,
  pulseVignette,
  settleVignette,
  softFade,
  wipeReveal,
} from './fx';
import type { BoardBridge, BoardSyncPayload, CardHoverPayload } from './bridge';

export const SCENE_KEY = 'board';

/** Data passed via `game.scene.add(SCENE_KEY, BoardScene, true, { bridge })`. */
export interface BoardSceneData {
  bridge: BoardBridge;
}

/**
 * Beat durations (ms) — the canvas mirror of the Phase 1a motion language in
 * src/ui/motion.ts. Everything stays inside the 120–350ms envelope; terminal
 * FX are atmosphere, not movement beats.
 */
const DUR = {
  deal: 300,
  dealStagger: 70,
  flip: 260,
  flipDelay: 80,
  flight: 340,
  sweep: 280,
  sweepStagger: 45,
  dissolve: 260,
  rewind: 240,
  settle: 260,
  nudge: 150,
  wipe: 380,
  vignette: 280,
  terminal: 700,
  reducedFade: 120,
} as const;

/** Easings: settle = fast launch + long glide; exit = accelerate away. */
const EASE = {
  settle: 'Quint.easeOut', // ≈ cubic-bezier(0.22, 1, 0.36, 1)
  travel: 'Sine.easeInOut', // ≈ cubic-bezier(0.4, 0, 0.2, 1)
  exit: 'Cubic.easeIn', // ≈ cubic-bezier(0.5, 0, 0.75, 0.4)
  soft: 'Sine.easeOut',
  linear: 'Linear',
} as const;

/** Anything the motion-policy sweep must clear before the next reconcile. */
interface TransientFx {
  dispose(): void;
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
 * only; the diff decides, the hint decorates.
 *
 * Motion policy (Phase 3, load-bearing): on every ACTION sync, in-flight
 * tweens are killed and sprites snap to the shared layout rects BEFORE the
 * new beat starts — `tween.stop()` fires onStop, not onComplete, so no beat
 * ever chains post-kill logic off complete; cleanup is idempotent on both
 * paths. Sprites tween only x/y/scale/scaleX/alpha (no angle tweens —
 * phaserjs/phaser#7341). Selection-only syncs (identical state and result)
 * update the glow and never kill a running deal. Tab visibility: on the
 * game's pause/resume events, tweens are killed and the board snaps to the
 * last sync's state (RAF throttling makes in-flight tweens untrustworthy).
 *
 * Every tween ENDS at a `computeBoardLayout` rect: departures leave the room
 * entirely, arrivals land on their slot, survivors re-center — resting
 * geometry is asserted by e2e to ≤1px.
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
  private lastLayout: BoardLayout | null = null;
  /** Container size `lastLayout` was computed for — dedupes boot-time RESIZE events. */
  private lastLayoutSize: { w: number; h: number } | null = null;
  private readonly rectById = new Map<CardId, Rect>();
  /** Pre-snap positions of surviving sprites — the from-points of recenter tweens. */
  private readonly stalePositions = new Map<CardId, { x: number; y: number }>();
  private readonly transientFx = new Set<TransientFx>();
  /** True once a sync with a dealt room has been seen (resumed counts). */
  private dealtOnce = false;
  private readyEmitted = false;

  constructor() {
    super(SCENE_KEY);
  }

  init(data: BoardSceneData | undefined): void {
    this.bridge = data?.bridge ?? null;
    this.offSync = null;
    this.offHover = null;
    this.lastSync = null;
    this.sprites.clear();
    this.hoveredCards.clear();
    this.lastLayout = null;
    this.lastLayoutSize = null;
    this.rectById.clear();
    this.stalePositions.clear();
    this.transientFx.clear();
    this.dealtOnce = false;
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
    this.game.events.on(Phaser.Core.Events.PAUSE, this.handlePause, this);
    this.game.events.on(Phaser.Core.Events.RESUME, this.handleResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  private readonly applySync = (payload: BoardSyncPayload): void => {
    const previous = this.lastSync;
    this.lastSync = payload;
    // Selection changes re-emit the identical state and result object — a
    // glow-only beat. Killing tweens here would snap a deal mid-flight;
    // the motion policy's kill → reconcile → choreograph applies to beats
    // where the game state or the result actually moved.
    const actionBeat =
      payload.state !== payload.prevState || payload.lastResult !== previous?.lastResult;
    if (!actionBeat) {
      this.applySelection(payload.selectedCardId);
      return;
    }
    this.killTransientFx();
    this.applySelection(payload.selectedCardId);
    const departed = this.reconcileRoom();
    this.choreograph(payload, departed);
  };

  private readonly applyHover = (payload: CardHoverPayload): void => {
    if (payload.over) this.hoveredCards.add(payload.cardId);
    else this.hoveredCards.delete(payload.cardId);
    this.sprites.get(payload.cardId)?.setHovered(payload.over);
  };

  private readonly handleResize = (): void => {
    // Phaser fires RESIZE during boot/parent adoption with the SAME size the
    // first sync already laid out for — snapping then would kill a deal that
    // just started (observed: mount deal dead on arrival). Only a real size
    // change is the policy's kill-and-snap path.
    if (
      this.lastLayoutSize !== null &&
      this.lastLayoutSize.w === this.scale.width &&
      this.lastLayoutSize.h === this.scale.height
    ) {
      return;
    }
    if (this.lastSync === null) return;
    // Resize mid-beat is the policy's kill-and-snap path: geometry moves to
    // the fresh layout rects; the next sync re-choreographs from there.
    this.snapReconcile();
  };

  private readonly handlePause = (): void => {
    // Tab hidden: RAF throttling makes in-flight tweens untrustworthy — kill
    // everything and snap to the last sync's state.
    this.snapReconcile();
  };

  private readonly handleResume = (): void => {
    this.snapReconcile();
  };

  /**
   * The `.room` element — the canvas container's parent — whose computed
   * style is the shared metrics source (same element the DOM hook observes).
   */
  private roomElement(): HTMLElement | null {
    const parent = (this.game?.scale?.parent ?? null) as HTMLElement | null;
    return parent?.parentElement ?? null;
  }

  /**
   * Diff current sprites against `state.room`, positioned by the layout fn.
   * Existing sprites are SNAPPED (kill tweens, reset visuals, apply rect) —
   * the resting ground truth; survivors that moved are tweened from their
   * pre-snap positions by the choreographer. Sprites removed from the room
   * are returned for the choreographer to fly out (they must not be destroyed
   * here — the departure animation IS the visual).
   */
  private reconcileRoom(): Map<CardId, CardSpriteHandle> {
    const payload = this.lastSync;
    const room = payload !== null && payload.state !== null ? payload.state.room : [];
    const count = Math.min(room.length, MAX_ROOM_CARDS);
    const layout = computeBoardLayout(
      this.scale.width,
      this.scale.height,
      count,
      readRoomMetrics(this.roomElement()),
    );
    this.lastLayout = layout;
    this.lastLayoutSize = { w: this.scale.width, h: this.scale.height };
    this.rectById.clear();
    this.stalePositions.clear();

    // Removals: cards no longer in the room (resolved, fled, undone, run over).
    // They are frozen (in-flight tweens killed, visuals reset) so the
    // departure beat starts clean even if the card was mid-deal.
    const nextIds = new Set<CardId>(room);
    const departed = new Map<CardId, CardSpriteHandle>();
    for (const [cardId, sprite] of [...this.sprites]) {
      if (!nextIds.has(cardId)) {
        sprite.freeze();
        departed.set(cardId, sprite);
        this.sprites.delete(cardId);
      }
    }

    // Additions + repositioning. Tolerates rooms with < 4 cards (fewer slots
    // are laid out) and > 4 defensively (extra cards would have no rect).
    room.forEach((cardId, index) => {
      const rect = layout.roomRects[index];
      if (rect === undefined) return;
      this.rectById.set(cardId, rect);
      const existing = this.sprites.get(cardId);
      if (existing !== undefined) {
        const from = { x: existing.container.x, y: existing.container.y };
        existing.snapTo(rect);
        this.stalePositions.set(cardId, from);
        existing.setHovered(this.hoveredCards.has(cardId));
        return;
      }
      const sprite = createCardSprite(this, cardId, rect);
      // NOT interactive: per the plan, the canvas never receives pointer
      // events (the DOM layer owns all input; the hit-layer emits cardClick).
      this.sprites.set(cardId, sprite);
    });

    // One-shot: the first reconcile (clear-board included) is complete — the
    // wrapper may now promote the canvas to the room's primary renderer.
    if (!this.readyEmitted && this.bridge !== null) {
      this.readyEmitted = true;
      this.bridge.emitSceneReady();
    }
    return departed;
  }

  private applySelection(selectedCardId: CardId | null): void {
    for (const [cardId, sprite] of this.sprites) {
      sprite.setSelected(cardId === selectedCardId);
    }
  }

  // ── Motion policy ───────────────────────────────────────────────────────

  /** Kill every transient FX object (departing sprites, emitters, camera fx). */
  private killTransientFx(): void {
    for (const fx of [...this.transientFx]) {
      try {
        fx.dispose();
      } catch {
        /* scene tearing down */
      }
    }
    this.transientFx.clear();
  }

  /** Kill → snap → reconcile, with no choreography (resize/pause/resume). */
  private snapReconcile(): void {
    this.killTransientFx();
    const departed = this.reconcileRoom();
    this.disposeQuietly(departed);
  }

  private trackTransient(dispose: () => void): void {
    this.transientFx.add({ dispose });
  }

  private trackEmitter(emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
    const entry: TransientFx = {
      dispose: (): void => {
        try {
          emitter.stop();
          emitter.destroy();
        } catch {
          /* already destroyed */
        }
      },
    };
    this.transientFx.add(entry);
    // Natural completion: self-destruct so the scene stays clean.
    emitter.once(Phaser.GameObjects.Particles.Events.COMPLETE, () => {
      this.transientFx.delete(entry);
      try {
        emitter.destroy();
      } catch {
        /* already destroyed */
      }
    });
  }

  /** Register a departing sprite for the policy sweep; returns the entry. */
  private trackDeparture(sprite: CardSpriteHandle): TransientFx {
    const entry: TransientFx = {
      dispose: (): void => {
        this.tweens.killTweensOf(sprite.container);
        sprite.destroy();
      },
    };
    this.transientFx.add(entry);
    return entry;
  }

  /** Tween-completion cleanup for a tracked departure (idempotent). */
  private finishDeparture(entry: TransientFx, sprite: CardSpriteHandle): void {
    this.transientFx.delete(entry);
    this.tweens.killTweensOf(sprite.container);
    sprite.destroy();
  }

  private disposeQuietly(departed: Map<CardId, CardSpriteHandle>): void {
    for (const sprite of departed.values()) sprite.destroy();
  }

  /** Quietly dispose every departure except one already claimed by a beat. */
  private disposeQuietlyExcept(departed: Map<CardId, CardSpriteHandle>, keep: CardId): void {
    for (const [cardId, sprite] of departed) {
      if (cardId === keep) continue;
      sprite.destroy();
    }
  }

  // ── Choreography ────────────────────────────────────────────────────────

  private choreograph(payload: BoardSyncPayload, departed: Map<CardId, CardSpriteHandle>): void {
    const state = payload.state;
    if (state === null) {
      // Run gone (abandon/finish/reset): the board is already cleared — make
      // sure no stand-in lingers.
      this.disposeQuietly(departed);
      return;
    }
    const result = payload.lastResult;
    const prevRoom = payload.prevState?.room ?? [];
    const nextRoom = state.room;
    const arrived = nextRoom.filter((id) => !prevRoom.includes(id));
    const survivors = nextRoom.filter((id) => prevRoom.includes(id));
    const reduced = this.reducedMotionNow();

    // Terminal results replace per-action results and carry no cardId: the
    // board stays mounted (under the GameOver overlay) and celebrates.
    if (result !== null && (result.type === 'GameWon' || result.type === 'GameLost')) {
      this.playTerminalFx(result.type, reduced, departed);
      return;
    }
    if (state.phase !== 'playing') {
      this.disposeQuietly(departed);
      return;
    }

    // First sync with a dealt room: staggered deal-in + flip reveal from the
    // deck edge — unless the run was resumed from storage (static reconcile).
    if (!this.dealtOnce) {
      this.dealtOnce = true;
      if (nextRoom.length === 0 || payload.runResumed) {
        this.disposeQuietly(departed);
        return;
      }
      if (reduced) {
        this.reducedFadeIn([...nextRoom]);
        return;
      }
      this.dealIn([...nextRoom], state.carriedCardId, 0);
      this.playWipe();
      return;
    }

    if (reduced) {
      // Reduced motion: opacity-only ≤120ms or nothing — arrivals fade in at
      // their rects, departures vanish, no camera FX, no celebrations beyond
      // a single soft fade (handled in playTerminalFx).
      this.disposeQuietly(departed);
      this.reducedFadeIn(arrived);
      return;
    }

    switch (result?.type) {
      case 'RoomDealt': {
        this.sweepToDeckEdge(departed, 0); // normally empty — defensive
        this.dealIn(arrived, null, 0);
        const carried = result.carriedFrom;
        if (carried !== null && survivors.includes(carried)) {
          // The carried card stayed mounted: travel it into the new room's
          // first slot and mark the re-entry with a distinct emphasis.
          this.settleFromStale(carried, DUR.settle, 0);
          this.sprites.get(carried)?.pulseGlow(0);
        }
        this.playWipe();
        break;
      }
      case 'RanAway': {
        this.sweepToDeckEdge(departed, 0);
        this.dealIn(arrived, null, 140);
        this.settleSurvivors(survivors, 0);
        break;
      }
      case 'MonsterDefeated': {
        this.settleSurvivors(survivors, 0);
        this.flyToKillHandoff(departed.get(result.cardId));
        this.disposeQuietlyExcept(departed, result.cardId);
        if (result.damage > 0) {
          this.cameras.main.shake(120, 0.004);
          const vignette = pulseVignette(this, FX_COLOR.danger, 0.55, DUR.vignette);
          if (vignette !== null) this.trackTransient(vignette.dispose);
        }
        break;
      }
      case 'PotionQuaffed': {
        this.settleSurvivors(survivors, 0);
        this.dissolvePotion(departed.get(result.cardId), result.wasted);
        this.disposeQuietlyExcept(departed, result.cardId);
        break;
      }
      case 'WeaponEquipped': {
        this.settleSurvivors(survivors, 0);
        this.sweepToWeaponZone(departed.get(result.cardId));
        this.disposeQuietlyExcept(departed, result.cardId);
        break;
      }
      case 'UndoDone': {
        // Quiet rewind: re-appearing cards rise back in from the bottom edge
        // (where resolution took them); survivors re-center; no celebration.
        this.rewindIn(arrived);
        this.settleSurvivors(survivors, 0);
        this.disposeQuietly(departed);
        break;
      }
      case 'RunAwayBlocked':
      case 'InvalidAction': {
        // Small canvas nudge only — the DOM announcer/tooltip explains.
        this.disposeQuietly(departed);
        this.nudgeRoom();
        break;
      }
      default: {
        // Null result with a diff: a fresh run replaced a live one (seeded
        // URL over an active run) — choreograph like a full-room swap.
        if (departed.size > 0 || arrived.length > 0) {
          this.sweepToDeckEdge(departed, 0);
          this.settleSurvivors(survivors, 0);
          this.dealIn(arrived.length > 0 ? arrived : [...nextRoom], null, 140);
          this.playWipe();
        } else {
          this.disposeQuietly(departed);
        }
        break;
      }
    }
  }

  /** Staggered deal: fly in from the deck edge with a card-back flip reveal. */
  private dealIn(ids: readonly CardId[], carriedId: CardId | null, baseDelay: number): void {
    const layout = this.lastLayout;
    if (layout === null) return;
    // The carried card re-enters last, with a distinct emphasis pulse.
    const ordered =
      carriedId !== null && ids.includes(carriedId)
        ? [...ids.filter((id) => id !== carriedId), carriedId]
        : [...ids];
    const deckX = this.scale.width + layout.cardWidth;
    ordered.forEach((id, i) => {
      const rect = this.rectById.get(id);
      const sprite = this.sprites.get(id);
      if (rect === undefined || sprite === undefined) return;
      const delay = baseDelay + i * DUR.dealStagger;
      const targetX = rect.x + rect.width / 2;
      const targetY = rect.y + rect.height / 2;
      sprite.container.setPosition(deckX, targetY - 10);
      sprite.container.setAlpha(0);
      sprite.container.setScale(0.96);
      sprite.showBack();
      this.tweens.add({
        targets: sprite.container,
        x: targetX,
        y: targetY,
        scale: 1,
        duration: DUR.deal,
        delay,
        ease: EASE.settle,
      });
      this.tweens.add({
        targets: sprite.container,
        alpha: 1,
        duration: 110,
        delay,
        ease: EASE.soft,
      });
      sprite.playFlipReveal(DUR.flip, delay + DUR.flipDelay);
      if (id === carriedId) sprite.pulseGlow(delay + DUR.flip + 60);
    });
  }

  /** Tween a surviving sprite from its pre-snap position to its new rect. */
  private settleFromStale(cardId: CardId, durationMs: number, delayMs: number): void {
    const from = this.stalePositions.get(cardId);
    if (from === undefined) return; // new sprite or position unchanged
    this.stalePositions.delete(cardId);
    const rect = this.rectById.get(cardId);
    const sprite = this.sprites.get(cardId);
    if (rect === undefined || sprite === undefined) return;
    const targetX = rect.x + rect.width / 2;
    const targetY = rect.y + rect.height / 2;
    if (Math.abs(from.x - targetX) < 0.5 && Math.abs(from.y - targetY) < 0.5) return;
    sprite.container.setPosition(from.x, from.y);
    this.tweens.add({
      targets: sprite.container,
      x: targetX,
      y: targetY,
      duration: durationMs,
      delay: delayMs,
      ease: EASE.travel,
    });
  }

  private settleSurvivors(survivors: readonly CardId[], delayMs: number): void {
    for (const id of survivors) this.settleFromStale(id, DUR.settle, delayMs);
  }

  /** Departures sweep toward the deck edge (canvas trailing edge) and fade. */
  private sweepToDeckEdge(departed: Map<CardId, CardSpriteHandle>, baseDelay: number): void {
    const layout = this.lastLayout;
    const deckX = this.scale.width + (layout?.cardWidth ?? 200);
    let index = 0;
    for (const sprite of departed.values()) {
      const delay = baseDelay + index * DUR.sweepStagger;
      const entry = this.trackDeparture(sprite);
      sprite.container.setDepth(60); // departs over the remaining room
      this.tweens.add({
        targets: sprite.container,
        x: deckX,
        y: '+=14',
        alpha: 0,
        duration: DUR.sweep,
        delay,
        ease: EASE.exit,
        onComplete: (): void => {
          this.finishDeparture(entry, sprite);
        },
      });
      index += 1;
    }
  }

  /**
   * MonsterDefeated: spark at the hit, then the monster flies toward the
   * kill-stack side and hands off at the canvas edge (Phase 0: the canvas
   * owns the room only — the kill stack is DOM territory), scaling to the
   * stack's 0.85 and fading across the final third.
   */
  private flyToKillHandoff(sprite: CardSpriteHandle | undefined): void {
    if (sprite === undefined) return;
    const spark = killSpark(this, sprite.container.x, sprite.container.y);
    if (spark !== null) this.trackEmitter(spark);
    const entry = this.trackDeparture(sprite);
    const layout = this.lastLayout;
    const handoffY = this.scale.height + (layout?.cardHeight ?? 200) * 0.55;
    const handoffX = Math.max(sprite.container.x, this.scale.width * 0.65);
    sprite.container.setDepth(60);
    this.tweens.add({
      targets: sprite.container,
      x: handoffX,
      y: handoffY,
      scale: 0.85,
      duration: DUR.flight,
      ease: EASE.travel,
      onComplete: (): void => {
        this.finishDeparture(entry, sprite);
      },
    });
    this.tweens.add({
      targets: sprite.container,
      alpha: 0,
      duration: DUR.flight * 0.3,
      delay: DUR.flight * 0.7,
      ease: EASE.soft,
    });
  }

  /** PotionQuaffed: dissolve in place. Wasted = shorter and dimmed. */
  private dissolvePotion(sprite: CardSpriteHandle | undefined, wasted: boolean): void {
    if (sprite === undefined) return;
    const entry = this.trackDeparture(sprite);
    if (wasted) sprite.setDimmed(true);
    this.tweens.add({
      targets: sprite.container,
      alpha: 0,
      scale: wasted ? 1.04 : 1.1,
      duration: wasted ? 180 : DUR.dissolve,
      ease: EASE.exit,
      onComplete: (): void => {
        this.finishDeparture(entry, sprite);
      },
    });
  }

  /** WeaponEquipped: the equipped weapon sweeps out toward the weapon zone. */
  private sweepToWeaponZone(sprite: CardSpriteHandle | undefined): void {
    if (sprite === undefined) return;
    const entry = this.trackDeparture(sprite);
    const cardWidth = this.lastLayout?.cardWidth ?? 160;
    sprite.container.setDepth(60);
    this.tweens.add({
      targets: sprite.container,
      x: -cardWidth,
      y: this.scale.height + cardWidth * 0.85,
      scale: 0.92,
      duration: DUR.sweep,
      ease: EASE.exit,
      onComplete: (): void => {
        this.finishDeparture(entry, sprite);
      },
    });
    this.tweens.add({
      targets: sprite.container,
      alpha: 0,
      duration: DUR.sweep * 0.5,
      delay: DUR.sweep * 0.5,
      ease: EASE.soft,
    });
  }

  /** UndoDone: re-appearing cards rise quietly back in from the bottom edge. */
  private rewindIn(ids: readonly CardId[]): void {
    ids.forEach((id, i) => {
      const rect = this.rectById.get(id);
      const sprite = this.sprites.get(id);
      if (rect === undefined || sprite === undefined) return;
      const targetX = rect.x + rect.width / 2;
      const targetY = rect.y + rect.height / 2;
      sprite.container.setPosition(targetX, this.scale.height + rect.height * 0.4);
      sprite.container.setAlpha(0);
      this.tweens.add({
        targets: sprite.container,
        y: targetY,
        alpha: 1,
        duration: DUR.rewind,
        delay: i * 40,
        ease: EASE.travel,
      });
    });
  }

  /** RunAwayBlocked / InvalidAction: a small canvas nudge (≤3px, 150ms). */
  private nudgeRoom(): void {
    const targets = [...this.sprites.values()].map((sprite) => sprite.container);
    if (targets.length === 0) return;
    this.tweens.add({
      targets,
      x: '+=3',
      duration: DUR.nudge / 4,
      yoyo: true,
      repeat: 1,
      ease: EASE.linear,
    });
  }

  /** Reduced-motion arrivals: opacity-only fade at their rects (≤120ms). */
  private reducedFadeIn(ids: readonly CardId[]): void {
    for (const id of ids) {
      const sprite = this.sprites.get(id);
      if (sprite === undefined) continue;
      sprite.container.setAlpha(0);
      this.tweens.add({
        targets: sprite.container,
        alpha: 1,
        duration: DUR.reducedFade,
        ease: EASE.soft,
      });
    }
  }

  private playWipe(): void {
    const wipe = wipeReveal(this, DUR.wipe);
    if (wipe !== null) this.trackTransient(wipe.dispose);
  }

  /** Terminal results: celebrate — the board stays under the GameOver overlay. */
  private playTerminalFx(
    outcome: 'GameWon' | 'GameLost',
    reduced: boolean,
    departed: Map<CardId, CardSpriteHandle>,
  ): void {
    this.disposeQuietly(departed);
    if (reduced) {
      // Reduced motion: a single soft fade in the outcome's color.
      const fade = softFade(
        this,
        outcome === 'GameWon' ? FX_COLOR.gold : FX_COLOR.danger,
        400,
        outcome === 'GameWon' ? 0.14 : 0.18,
      );
      if (fade !== null) this.trackTransient(fade.dispose);
      return;
    }
    if (outcome === 'GameWon') {
      const confetti = confettiFall(this, this.scale.width);
      if (confetti !== null) this.trackEmitter(confetti);
      const glow = pulseVignette(this, FX_COLOR.gold, 0.35, DUR.terminal);
      if (glow !== null) this.trackTransient(glow.dispose);
    } else {
      const embers = emberFall(this, this.scale.width);
      if (embers !== null) this.trackEmitter(embers);
      this.cameras.main.shake(160, 0.005);
      const vignette = settleVignette(this, FX_COLOR.danger, 0.5, DUR.terminal);
      if (vignette !== null) this.trackTransient(vignette.dispose);
    }
  }

  /** Read fresh at each sync — the persisted setting plus the OS media query. */
  private reducedMotionNow(): boolean {
    if (loadSettings().reducedMotion) return true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.game?.events.off(Phaser.Core.Events.PAUSE, this.handlePause, this);
    this.game?.events.off(Phaser.Core.Events.RESUME, this.handleResume, this);
    this.offSync?.();
    this.offSync = null;
    this.offHover?.();
    this.offHover = null;
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.hoveredCards.clear();
    this.rectById.clear();
    this.stalePositions.clear();
    // Scene destroy tears down every child (sprites, emitters, rectangles);
    // the registry just forgets them.
    this.transientFx.clear();
    this.lastSync = null;
  }
}
