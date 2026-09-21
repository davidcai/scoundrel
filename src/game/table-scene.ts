import Phaser from 'phaser';
import { type CardId, type GameState } from '../engine';
import { queueCardTextures, substituteMissingTextures, WHITE_KEY } from './card-textures';
import {
  runChoreography,
  runChoreographyInstant,
  TIMING,
  TweenTracker,
  type TweenHost,
  type TweenSpec,
} from './animations';
import { AMBIENCE, CARRIED_SHIMMER, HEAL_BURST, HP_BAR, planJuice } from './juice';
import type { BridgeCommand, RunEndedInfo, TableSceneApi, TerminalPresentation } from './scene-api';

/**
 * Play table scene with the Phase 2 motion set. Every tween is hand-authored
 * (docs/phaser-plan.md §4 Phase 2) and driven by structured commands from the
 * bridge; state stays authoritative — the tween-interruption policy snaps ALL
 * in-flight tweens to their end state (manual final-value writes) before a new
 * command choreographs, so the table can never lag visibly behind the store.
 *
 * Kill stack: last-killed on top, stepped offsets, NO rotation (the DOM stack
 * has none, and rotated textures trigger the open #7372 tearing bug).
 */

export const SCENE_KEY = 'scoundrel-table';
export const SCENE_READY_EVENT = 'scoundrel:scene-ready';

/** Canvas design resolution: 960×600 (see game.ts rationale). */
export const DESIGN_WIDTH = 960;
export const DESIGN_HEIGHT = 600;

const CARD_W = 120;
const CARD_H = 180; // 2:3 — matches the 1152×1728 artwork aspect

// Kill-stack fan offsets (40/16 at 85% card scale) matching the kill-stack
// step in WeaponReadout. Older kills peek left+down; last kill sits on top.
const KILL_STEP_X = 40;
const KILL_STEP_Y = 16;
const KILL_SCALE = 0.85;
const MAX_KILL_STEPS = 5; // guard against fanning into the room zone

// Gold family — 0xf0c169 is the DOM --accent-bright used by .selected-ring,
// so canvas ring/glow/badge/wash read as one system with the overlay.
const SELECTION_COLOR = 0xf0c169;
const CARRIED_TINT = 0xfff3c4;
const LIFT_PX = 8;

/** Room 2×2 grid, centered in the middle zone of the canvas. */
const ROOM_X0 = 316;
const ROOM_Y0 = 108;
const ROOM_GAP_X = 36;
const ROOM_GAP_Y = 24;

/** Weapon zone (left). */
const WEAPON_X = 52;
const WEAPON_Y = 210;

/** Kill-stack anchor: right edge fixed at x 932, growing leftward for older kills. */
const KILL_RIGHT = 932;
const KILL_Y0 = 120;

/** Deal-in origin: off the left edge (deck side), sliding right into the room. */
const DEAL_ORIGIN_X = ROOM_X0 - CARD_W * 1.3;

type Slot = { x: number; y: number };

/** Room slot n (0–3) in row-major order: top-left, top-right, bottom-left, bottom-right. */
function roomSlot(index: number): Slot {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: ROOM_X0 + col * (CARD_W + ROOM_GAP_X) + CARD_W / 2,
    y: ROOM_Y0 + row * (CARD_H + ROOM_GAP_Y) + CARD_H / 2,
  };
}

/** Kill-stack slot: index 0 = last kill at the anchor; older kills step left+down. */
function killSlot(indexFromTop: number): Slot {
  const step = Math.min(indexFromTop, MAX_KILL_STEPS);
  const width = CARD_W * KILL_SCALE;
  return {
    x: KILL_RIGHT - width / 2 - step * KILL_STEP_X,
    y: KILL_Y0 + (CARD_H * KILL_SCALE) / 2 + step * KILL_STEP_Y,
  };
}

function offPointerDown(sprite: Phaser.GameObjects.Sprite): void {
  sprite.off('pointerdown');
}

/** Kill-stack depths per post-state ordering: last kill on top. */
function applyKillDepths(killStack: readonly CardId[], sprites: Phaser.GameObjects.Sprite[]): void {
  sprites.forEach((sprite, position) => {
    const indexFromTop = killStack.length - 1 - position;
    sprite.setDepth(5 - Math.min(indexFromTop, MAX_KILL_STEPS));
  });
}

export class TableScene extends Phaser.Scene implements TableSceneApi {
  private roomSprites = new Map<CardId, Phaser.GameObjects.Sprite>();
  private weaponSprite: Phaser.GameObjects.Sprite | null = null;
  private killSprites: Phaser.GameObjects.Sprite[] = [];
  private glow: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Graphics | null = null;
  private carriedBadge: Phaser.GameObjects.Image | null = null;
  private carriedShimmer: Phaser.GameObjects.Image | null = null;
  private hpBarTrack: Phaser.GameObjects.Image | null = null;
  private hpBarFill: Phaser.GameObjects.Image | null = null;
  private hpBarFlash: Phaser.GameObjects.Image | null = null;
  private displayedHp = 0;
  private displayedMaxHp = 0;
  private deckText: Phaser.GameObjects.Text | null = null;
  private hpText: Phaser.GameObjects.Text | null = null;
  private hoverCbs = new Set<(cardId: CardId | null) => void>();
  private pointerDownCb: ((cardId: CardId) => void) | null = null;
  private flourishCompleteCb: ((info: RunEndedInfo) => void) | null = null;
  private selected: CardId | null = null;
  private carried: CardId | null = null;
  private reducedMotion = false;

  /** In-flight resolve/transition tweens (snapped by the interruption policy). */
  private flight: TweenTracker | null = null;
  /** In-flight selection lift tweens (snapped independently of resolve tweens). */
  private selectionFlight: TweenTracker | null = null;
  /** Looping carried-card shimmer (never snapped by resolve commands). */
  private shimmerFlight: TweenTracker | null = null;
  /** Looping backdrop ambience (never snapped; stopped on reduced-motion). */
  private ambientFlight: TweenTracker | null = null;
  private ambientSprites: Phaser.GameObjects.Image[] = [];
  /** Juice specs (HP drain/flash, strain flash, heal burst) merged into the next choreography. */
  private juiceSpecs: TweenSpec[] = [];

  constructor(opts?: { reducedMotion?: boolean }) {
    super(SCENE_KEY);
    this.reducedMotion = opts?.reducedMotion === true;
  }

  preload(): void {
    queueCardTextures(this.load);
  }

  create(): void {
    // Placeholder substitution happens after loading completes: failed/missing
    // card assets get a generated suit-toned texture (CardView parity).
    substituteMissingTextures(this);

    this.glow = this.add.image(0, 0, WHITE_KEY).setVisible(false);
    this.ring = this.add.graphics().setVisible(false);
    this.carriedBadge = this.add
      .image(0, 0, WHITE_KEY)
      .setDisplaySize(12, 12)
      .setTint(SELECTION_COLOR)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(25)
      .setVisible(false);
    // Carried-card shimmer: gold fill-tint pulse, very low alpha, looping.
    this.carriedShimmer = this.add
      .image(0, 0, WHITE_KEY)
      .setDisplaySize(CARD_W + 10, CARD_H + 10)
      .setTint(CARRIED_SHIMMER.tint)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(CARRIED_SHIMMER.alphaMin)
      .setDepth(24)
      .setVisible(false);
    // Decorative HP bar (canvas-only): dark track + fill + damage flash.
    // Hidden until the first state render; hidden entirely under reduced motion.
    this.hpBarTrack = this.add
      .image(HP_BAR.x, HP_BAR.y, WHITE_KEY)
      .setOrigin(0, 0.5)
      .setDisplaySize(HP_BAR.width + 4, HP_BAR.height + 4)
      .setTint(0x1e293b)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(20)
      .setVisible(false);
    this.hpBarFill = this.add
      .image(HP_BAR.x, HP_BAR.y, WHITE_KEY)
      .setOrigin(0, 0.5)
      .setDisplaySize(HP_BAR.width, HP_BAR.height)
      .setTint(0x4bb477) // --hp (DOM hp-bar green)
      .setTintMode(Phaser.TintModes.FILL)
      .setDepth(21)
      .setVisible(false);
    this.hpBarFlash = this.add
      .image(HP_BAR.x, HP_BAR.y, WHITE_KEY)
      .setOrigin(0, 0.5)
      .setDisplaySize(HP_BAR.width + 4, HP_BAR.height + 4)
      .setTint(0xe0564f) // --danger (DOM damage red)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setDepth(22)
      .setVisible(false);
    this.deckText = this.add.text(16, 16, '', {
      fontSize: '20px',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    });
    // HP readout: exactly the Phase 1 position (reduced-motion baseline parity);
    // the decorative bar (motion-enabled only) sits beside it.
    this.hpText = this.add.text(16, DESIGN_HEIGHT - 36, '', {
      fontSize: '20px',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    });

    // Readiness marker for the React lane's whenReady()/e2e gate.
    this.events.emit(SCENE_READY_EVENT);

    // Backdrop ambience starts with the table (motion-enabled only).
    this.startAmbience();
  }

  // --- scene API -------------------------------------------------------------

  renderState(state: GameState | null, selectedCardId: CardId | null): void {
    this.snapFlight();
    this.clearTable();
    if (state === null) return;
    this.selected =
      selectedCardId !== null && state.room.includes(selectedCardId) ? selectedCardId : null;
    this.carried = state.carriedCardId;

    // Render only cards that exist — the room list is authoritative; stale ids
    // (a selection pointing at a resolved card) are ignored by the filter above.
    state.room.forEach((cardId, index) => {
      this.makeRoomSprite(cardId, roomSlot(index), state.carriedCardId);
    });

    if (state.weapon !== null) {
      this.weaponSprite = this.makeCardSprite(state.weapon, WEAPON_X, WEAPON_Y);
    }

    this.buildKillStack(state.killStack);
    this.deckText?.setText(String(state.dungeon.length));
    this.applyHp(state.hp, state.maxHp, false);
    this.refreshDecorations();
  }

  playCommand(
    command: BridgeCommand,
    state: GameState | null,
    _selectedCardId: CardId | null,
  ): void {
    // INTERRUPTION POLICY: snap every in-flight tween (resolve + selection lift)
    // to its end state before the new command choreographs. Commands never
    // queue behind animations; a selection clear never snaps resolve tweens —
    // the reverse (a command snapping a lift) is required for correctness.
    this.snapFlight();
    this.selectionFlight?.snapAll();
    this.selectionFlight = null;

    if (state === null) return;
    this.carried = state.carriedCardId;
    this.selected =
      this.selected !== null && state.room.includes(this.selected) ? this.selected : null;
    this.deckText?.setText(String(state.dungeon.length));

    // Phase 3 juice: camera shake keys off the command payload (big hits /
    // lethal blows); skipped entirely under reduced motion.
    const plan = planJuice(command);
    if (plan.cameraShake !== null && !this.reducedMotion) {
      this.cameras.main.shake(plan.cameraShake.durationMs, plan.cameraShake.intensity);
    }
    // HP drain/flash specs ride the same choreography as the command.
    this.juiceSpecs = this.applyHp(state.hp, state.maxHp, true);

    switch (command.kind) {
      case 'deal':
        this.playDeal(command, state);
        break;
      case 'attack':
        this.playAttack(command, state);
        break;
      case 'potion':
        this.playPotion(command, state);
        break;
      case 'weaponEquip':
        this.playWeaponEquip(command, state);
        break;
      case 'runAway':
        this.playRunAway(command);
        break;
      case 'terminal':
        this.playTerminal(command, state);
        break;
      case 'errorFeedback':
        this.playErrorFeedback();
        break;
      case 'rebuild':
        this.playRebuild(state);
        break;
      case 'noop':
        break;
    }
  }

  setReducedMotion(reduced: boolean): void {
    if (this.reducedMotion === reduced) return;
    this.reducedMotion = reduced;
    if (reduced) {
      // All juice becomes a no-op/instant: settle in-flight tweens, stop the
      // looping ambience + shimmer, hide the decorative HP bar. The static
      // frame matches the reduced-motion baseline (no motion-only decorations).
      this.snapFlight();
      this.stopAmbience();
      this.shimmerFlight?.snapAll();
      this.shimmerFlight = null;
    } else {
      this.startAmbience();
    }
    // Re-evaluate the HP visuals (bar hidden/shown, instant values).
    this.applyHp(this.displayedHp, this.displayedMaxHp, false);
  }

  setSelection(cardId: CardId | null): void {
    if (this.selected === cardId) return; // idempotent — selection sync relies on it
    // Finalize any in-flight LIFT only; resolve tweens are never touched here.
    this.selectionFlight?.snapAll();
    this.selectionFlight = null;

    const previous = this.selected !== null ? this.roomSprites.get(this.selected) : undefined;
    this.selected = cardId;
    this.refreshDecorations(); // ring/glow move to the new card instantly

    const specs: TweenSpec[] = [];
    if (previous !== undefined) {
      specs.push(liftSpec(previous, false, 0));
    }
    const target = cardId !== null ? this.roomSprites.get(cardId) : undefined;
    if (target !== undefined) {
      specs.push(liftSpec(target, true, 0));
    }
    if (specs.length > 0) {
      if (this.reducedMotion) {
        runChoreographyInstant(specs);
      } else {
        const tracker = new TweenTracker();
        runChoreography(this.tweenHost(), tracker, specs);
        this.selectionFlight = tracker;
      }
    }
  }

  onCardPointerDown(cb: (cardId: CardId) => void): void {
    this.pointerDownCb = cb;
  }

  onHoverChange(cb: (cardId: CardId | null) => void): () => void {
    this.hoverCbs.add(cb);
    return () => {
      this.hoverCbs.delete(cb);
    };
  }

  onFlourishComplete(cb: (info: RunEndedInfo) => void): void {
    this.flourishCompleteCb = cb;
  }

  destroy(): void {
    this.hoverCbs.clear();
    this.pointerDownCb = null;
    this.flourishCompleteCb = null;
    this.snapFlight();
    this.selectionFlight?.snapAll();
    this.selectionFlight = null;
    this.clearTable();
  }

  // --- tween host + interruption policy ---------------------------------------

  /** Adapts the Phaser tween/timer systems to the Phaser-free TweenHost seam. */
  private tweenHost(): TweenHost {
    return {
      add: (spec) => {
        const tween = this.tweens.add({
          targets: spec.target,
          ...spec.to,
          duration: spec.durationMs,
          ease: spec.ease ?? 'Linear',
          delay: spec.delayMs ?? 0,
          yoyo: spec.yoyo === true,
          repeat: spec.repeat ?? 0,
          onComplete: () => spec.onSettle?.(),
        });
        return { stop: () => tween.stop() };
      },
      delayedCall: (ms, cb) => {
        const timer = this.time.delayedCall(ms, () => cb());
        return { stop: () => timer.remove(false) };
      },
    };
  }

  private snapFlight(): void {
    this.flight?.snapAll();
    this.flight = null;
  }

  private startChoreography(specs: TweenSpec[], onComplete?: () => void): void {
    const done = () => {
      onComplete?.();
      this.refreshDecorations();
    };
    // Juice specs (HP drain/flash, strain, burst) ride the same flight so the
    // interruption policy snaps them together with the command's tweens.
    const all = [...specs, ...this.juiceSpecs];
    this.juiceSpecs = [];
    if (this.reducedMotion) {
      // Jump straight to end states; the gate/follow-up logic sees completion.
      runChoreographyInstant(all, done);
      this.flight = null;
      return;
    }
    const tracker = new TweenTracker();
    this.flight = tracker;
    runChoreography(this.tweenHost(), tracker, all, done);
  }

  // --- juice -------------------------------------------------------------------

  /**
   * Decorative HP visual (canvas-only): the fill drains smoothly on HP change
   * and flashes red on damage. The DOM `role="meter"` in the Hud stays
   * canonical (plan §3) — this is presentation only. Under reduced motion (or
   * the first render) the values are written instantly. Returns the specs that
   * ride the current choreography.
   */
  private applyHp(hp: number, maxHp: number, animate: boolean): TweenSpec[] {
    const from = this.displayedHp;
    this.displayedHp = hp;
    this.displayedMaxHp = maxHp;

    const specs: TweenSpec[] = [];
    const fill = this.hpBarFill;
    const showBar = !this.reducedMotion && maxHp > 0 && fill !== null;
    this.hpBarTrack?.setVisible(showBar);
    fill?.setVisible(showBar);

    if (!showBar || fill === null) {
      this.hpText?.setText(`${hp}/${maxHp}`);
      return specs;
    }
    if (!animate || this.reducedMotion || from === hp) {
      fill.setScale((HP_BAR.width / 2) * Math.max(0, hp / maxHp), HP_BAR.height / 2);
      this.hpText?.setText(`${hp}/${maxHp}`);
      return specs;
    }

    const drainBaseScale = HP_BAR.width / 2; // fill scale at full HP
    const toScale = drainBaseScale * Math.max(0, hp / maxHp);
    specs.push({
      target: fill,
      from: { scaleX: fill.scaleX },
      to: { scaleX: toScale },
      durationMs: TIMING.hpDrain.durationMs,
      ease: TIMING.hpDrain.ease,
      onUpdate: (t) => {
        // The readout follows the draining bar (ratio derived from the fill).
        const ratio = Math.max(0, Math.min(1, t.scaleX / drainBaseScale));
        this.hpText?.setText(`${Math.round(ratio * maxHp)}/${maxHp}`);
      },
      onSettle: () => this.hpText?.setText(`${hp}/${maxHp}`),
    });
    if (hp < from) {
      // Damage flash: red pulse over the bar (yoyo — snaps write the rest state).
      const flash = this.hpBarFlash;
      if (flash !== null) {
        flash.setVisible(true);
        specs.push({
          target: flash,
          from: { alpha: 0 },
          to: { alpha: 0.5 },
          durationMs: TIMING.hpFlash.durationMs,
          ease: TIMING.hpFlash.ease,
          yoyo: true,
          onSettle: () => flash.setAlpha(0),
        });
      }
    }
    return specs;
  }

  /** Weapon-strain flash (bridge-derived break): the held weapon couldn't cut the kill. */
  private playWeaponStrain(specs: TweenSpec[]): void {
    const weapon = this.weaponSprite;
    if (weapon === null || this.reducedMotion) return;
    // Quick white strain flash over the weapon card + a 3px nudge (yoyo).
    const flash = this.add
      .image(weapon.x, weapon.y, WHITE_KEY)
      .setDisplaySize(CARD_W + 8, CARD_H + 8)
      .setTint(0xffffff)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setDepth(50);
    specs.push({
      target: flash,
      from: { alpha: 0 },
      to: { alpha: 0.7 },
      durationMs: TIMING.strain.durationMs,
      ease: TIMING.strain.ease,
      yoyo: true,
      onSettle: () => flash.destroy(),
    });
    specs.push({
      target: weapon,
      from: { x: weapon.x },
      to: { x: weapon.x - 4 },
      durationMs: TIMING.strain.durationMs,
      ease: TIMING.strain.ease,
      yoyo: true,
    });
  }

  /** PotionQuaffed heal burst: tiny green motes radiating from the quaffed card. */
  private playHealBurst(specs: TweenSpec[], x: number, y: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < HEAL_BURST.moteCount; i += 1) {
      // Deterministic spread (index-based) — no RNG, snapshot-friendly.
      const angle = (i / HEAL_BURST.moteCount) * Math.PI * 2 + (i % 2) * 0.35;
      const dist = HEAL_BURST.minDistance + (i % 3) * HEAL_BURST.distanceJitter;
      const size = HEAL_BURST.baseSize + (i % 3) * 2;
      const mote = this.add
        .image(x, y, WHITE_KEY)
        .setDisplaySize(size, size)
        .setTint(HEAL_BURST.tint)
        .setTintMode(Phaser.TintModes.FILL)
        .setDepth(35);
      specs.push({
        target: mote,
        from: { x, y, alpha: 0.85 },
        to: { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist - 8, alpha: 0 },
        durationMs: TIMING.burst.durationMs + (i % 3) * 70,
        ease: TIMING.burst.ease,
        onSettle: () => mote.destroy(),
      });
    }
  }

  /** Backdrop ambience: slow dust/ember motes, very low alpha, depth -10 (behind all). */
  private startAmbience(): void {
    if (this.reducedMotion || this.ambientFlight !== null) return;
    const specs: TweenSpec[] = [];
    for (let i = 0; i < AMBIENCE.moteCount; i += 1) {
      const x = 40 + ((i * 137) % (DESIGN_WIDTH - 80));
      const y0 = 60 + ((i * 211) % (DESIGN_HEIGHT - 120));
      const size = 3 + (i % 3) * 2;
      const restAlpha = AMBIENCE.alphaMin + ((i % 4) / 3) * (AMBIENCE.alphaMax - AMBIENCE.alphaMin);
      const mote = this.add
        .image(x, y0, WHITE_KEY)
        .setDisplaySize(size, size)
        .setTint(i % 3 === 0 ? AMBIENCE.emberTint : AMBIENCE.dustTint)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(restAlpha)
        .setDepth(-10); // behind everything, non-interactive (no hit area)
      this.ambientSprites.push(mote);
      specs.push({
        target: mote,
        from: { y: y0, alpha: restAlpha },
        to: { y: y0 - AMBIENCE.driftPx, alpha: restAlpha * 0.4 },
        durationMs: AMBIENCE.loopMsMin + (i % 5) * (AMBIENCE.loopMsJitter / 5),
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delayMs: (i % 6) * (AMBIENCE.delayMsMax / 6),
      });
    }
    const tracker = new TweenTracker();
    runChoreography(this.tweenHost(), tracker, specs);
    this.ambientFlight = tracker;
  }

  /** Stops and destroys the ambience motes (reduced motion / destroy). */
  private stopAmbience(): void {
    this.ambientFlight?.snapAll(); // yoyo motes settle back to their rest state
    this.ambientFlight = null;
    this.ambientSprites.forEach((mote) => mote.destroy());
    this.ambientSprites = [];
  }

  // --- sprite inventory -------------------------------------------------------

  private makeCardSprite(cardId: CardId, x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, cardId);
    sprite.setDisplaySize(CARD_W, CARD_H);
    return sprite;
  }

  private makeRoomSprite(
    cardId: CardId,
    slot: Slot,
    carriedId: CardId | null,
  ): Phaser.GameObjects.Sprite {
    const sprite = this.makeCardSprite(cardId, slot.x, slot.y);
    sprite.setData('slot', { ...slot });
    sprite.setInteractive({ cursor: 'pointer' });
    if (carriedId !== null && carriedId === cardId) sprite.setTint(CARRIED_TINT);

    sprite.on('pointerdown', () => this.pointerDownCb?.(cardId));
    sprite.on('pointerover', () => this.hoverCbs.forEach((cb) => cb(cardId)));
    sprite.on('pointerout', () => this.hoverCbs.forEach((cb) => cb(null)));
    this.roomSprites.set(cardId, sprite);
    return sprite;
  }

  private makeKillSprite(cardId: CardId, slot: Slot, depth: number): Phaser.GameObjects.Sprite {
    const sprite = this.makeCardSprite(cardId, slot.x, slot.y);
    sprite.setDisplaySize(CARD_W * KILL_SCALE, CARD_H * KILL_SCALE);
    sprite.setDepth(depth);
    sprite.setInteractive({ cursor: 'pointer' });
    sprite.on('pointerover', () => this.hoverCbs.forEach((cb) => cb(cardId)));
    sprite.on('pointerout', () => this.hoverCbs.forEach((cb) => cb(null)));
    this.killSprites.push(sprite);
    return sprite;
  }

  /** Static kill-stack layout (Phase 1 parity; used by renderState). */
  private buildKillStack(killStack: readonly CardId[]): void {
    killStack.forEach((cardId) => {
      const indexFromTop = killStack.length - 1 - this.killSprites.length;
      const slot = killSlot(indexFromTop);
      this.makeKillSprite(cardId, slot, 5 - Math.min(indexFromTop, MAX_KILL_STEPS));
    });
  }

  /** Destroys every card sprite and hides decorations. */
  private clearTable(): void {
    this.roomSprites.forEach((sprite) => sprite.destroy());
    this.roomSprites.clear();
    this.weaponSprite?.destroy();
    this.weaponSprite = null;
    this.killSprites.forEach((sprite) => sprite.destroy());
    this.killSprites = [];
    this.glow?.setVisible(false);
    this.ring?.setVisible(false);
    this.carriedBadge?.setVisible(false);
    this.carriedShimmer?.setVisible(false);
    this.shimmerFlight?.snapAll();
    this.shimmerFlight = null;
  }

  /** Canonical (un-lifted, un-shaken) slot carried on the sprite. */
  private slot(sprite: Phaser.GameObjects.Sprite): Slot {
    const data = sprite.getData('slot') as Slot | undefined;
    return data ?? { x: sprite.x, y: sprite.y };
  }

  /** Re-flow remaining room sprites into their post-state slots. */
  private reSlotRoom(state: GameState, specs: TweenSpec[], delayMs: number): void {
    state.room.forEach((cardId, index) => {
      const sprite = this.roomSprites.get(cardId);
      if (sprite === undefined) return;
      const slot = roomSlot(index);
      const current = this.slot(sprite);
      if (current.x === slot.x && current.y === slot.y) return;
      sprite.setData('slot', { ...slot });
      specs.push({
        target: sprite,
        to: { x: slot.x, y: slot.y },
        durationMs: TIMING.reflow.durationMs,
        ease: TIMING.reflow.ease,
        delayMs,
      });
    });
  }

  /** Floating ephemeral canvas text — digits/signs only, no i18n text in canvas. */
  private floatText(x: number, y: number, text: string, color: string, delayMs: number): TweenSpec {
    const label = this.add
      .text(x, y, text, {
        fontSize: '26px',
        color,
        fontStyle: 'bold',
        fontFamily: 'system-ui, sans-serif',
      })
      .setOrigin(0.5)
      .setDepth(40);
    return {
      target: label,
      from: { x, y, alpha: 1 },
      to: { y: y - 34, alpha: 0 },
      durationMs: TIMING.float.durationMs,
      ease: TIMING.float.ease,
      delayMs,
      onSettle: () => label.destroy(),
    };
  }

  /** Full-canvas tinted wash (fill-tint API — setTintFill was removed in v4). */
  private wash(
    color: number,
    alpha: number,
    durationMs: number,
    ease: string,
    delayMs: number,
  ): TweenSpec {
    const overlay = this.add
      .image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, WHITE_KEY)
      .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
      .setTint(color)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setDepth(90);
    return { target: overlay, from: { alpha: 0 }, to: { alpha }, durationMs, ease, delayMs };
  }

  // --- choreographies ---------------------------------------------------------

  /** dealCard: room cards slide into the room, staggered; a carried card slides forward. */
  private playDeal(
    command: { cards: readonly CardId[]; carriedFrom: CardId | null },
    state: GameState,
  ): void {
    const specs: TweenSpec[] = [];
    command.cards.forEach((cardId, index) => {
      const slot = roomSlot(index);
      const existing = this.roomSprites.get(cardId);
      if (existing !== undefined) {
        // Carried card: already on the table — slides forward into its new slot.
        existing.setData('slot', { ...slot });
        if (this.carried !== null && this.carried === cardId) existing.setTint(CARRIED_TINT);
        specs.push({
          target: existing,
          to: { x: slot.x, y: slot.y },
          durationMs: TIMING.deal.durationMs,
          ease: TIMING.deal.ease,
          delayMs: index * TIMING.deal.staggerMs,
        });
        return;
      }
      const sprite = this.makeRoomSprite(cardId, slot, state.carriedCardId);
      sprite.setPosition(DEAL_ORIGIN_X, slot.y);
      sprite.setAlpha(0);
      specs.push({
        target: sprite,
        from: { x: DEAL_ORIGIN_X, y: slot.y, alpha: 0 },
        to: { x: slot.x, y: slot.y, alpha: 1 },
        durationMs: TIMING.deal.durationMs,
        ease: TIMING.deal.ease,
        delayMs: index * TIMING.deal.staggerMs,
      });
    });
    this.startChoreography(specs);
  }

  /** attackImpact (+ stackDrop for weapon kills): lunge, impact, damage number. */
  private playAttack(
    command: {
      cardId: CardId;
      damage: number;
      usedWeaponId: CardId | null;
      killCardId: CardId | null;
      weaponBreak: boolean;
    },
    state: GameState,
  ): void {
    const specs: TweenSpec[] = [];
    const victim = this.roomSprites.get(command.cardId);
    if (victim === undefined) return;
    const vx = victim.x;
    const vy = victim.y;

    // 1. Attacker lunge: the weapon leaps from its zone to the target.
    if (command.usedWeaponId !== null && this.weaponSprite !== null) {
      const weapon = this.weaponSprite;
      specs.push({
        target: weapon,
        to: { x: vx, y: vy },
        durationMs: TIMING.lunge.durationMs,
        ease: TIMING.lunge.ease,
      });
      specs.push({
        target: weapon,
        to: { x: WEAPON_X, y: WEAPON_Y },
        durationMs: TIMING.retreat.durationMs,
        ease: TIMING.retreat.ease,
        delayMs: TIMING.lunge.durationMs + TIMING.impact.durationMs,
      });
    } else if (command.weaponBreak) {
      // Weapon-strain flash: barehanded kill while the held weapon couldn't
      // cut it (bridge-derived via previewFight — never keyed to the vestigial
      // weaponBroke flag or the every-equip discardedWeaponId).
      this.playWeaponStrain(specs);
    }

    // 2. Victim reaction pulse (yoyo — snapping writes the rest state).
    specs.push({
      target: victim,
      to: { scaleX: victim.scaleX * 1.08, scaleY: victim.scaleY * 1.08 },
      durationMs: TIMING.impact.durationMs,
      ease: TIMING.impact.ease,
      yoyo: true,
      delayMs: TIMING.lunge.durationMs,
    });

    // 3. Floating damage number.
    specs.push(
      this.floatText(
        vx,
        vy - CARD_H / 2 - 10,
        `-${command.damage}`,
        '#fca5a5',
        TIMING.lunge.durationMs + 80,
      ),
    );

    const postImpact = TIMING.lunge.durationMs + TIMING.impact.durationMs;
    if (command.killCardId !== null) {
      // stackDrop: the defeated monster joins the kill stack, last-killed on top.
      this.roomSprites.delete(command.cardId);
      offPointerDown(victim);
      victim.setDepth(20); // flies above the table
      this.killSprites.push(victim);
      const anchor = killSlot(0);
      specs.push({
        target: victim,
        to: {
          x: anchor.x,
          y: anchor.y,
          scaleX: victim.scaleX * KILL_SCALE,
          scaleY: victim.scaleY * KILL_SCALE,
        },
        durationMs: TIMING.stackDrop.durationMs,
        ease: TIMING.stackDrop.ease,
        delayMs: postImpact + 40,
      });
      applyKillDepths(state.killStack, this.killSprites);
    } else {
      // Barehanded kill: no stack join — the monster drops off the table.
      this.roomSprites.delete(command.cardId);
      offPointerDown(victim);
      specs.push({
        target: victim,
        to: { alpha: 0, y: vy + 44 },
        durationMs: TIMING.exit.durationMs,
        ease: TIMING.exit.ease,
        delayMs: postImpact + 40,
        onSettle: () => victim.destroy(),
      });
    }

    // 4. Remaining room cards settle into their new slots.
    this.reSlotRoom(state, specs, postImpact + 60);
    this.startChoreography(specs);
  }

  /** potion: glow pulse on the quaffed card + HP visual feedback. */
  private playPotion(
    command: { cardId: CardId; healed: number; wasted: boolean },
    state: GameState,
  ): void {
    const specs: TweenSpec[] = [];
    const card = this.roomSprites.get(command.cardId);
    if (card === undefined) return;
    const cx = card.x;
    const cy = card.y;

    // Glow pulse over the quaffed card (fill-tinted wash, yoyo).
    const flash = this.add
      .image(cx, cy, WHITE_KEY)
      .setDisplaySize(CARD_W + 10, CARD_H + 10)
      .setTint(command.wasted ? 0x98a2b8 : HEAL_BURST.tint) // --muted / heal green
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setDepth(card.depth + 1);
    specs.push({
      target: flash,
      to: { alpha: command.wasted ? 0.35 : 0.6 },
      durationMs: TIMING.glow.durationMs,
      ease: TIMING.glow.ease,
      yoyo: true,
      onSettle: () => flash.destroy(),
    });

    // Heal burst: tiny green motes (gray/none when wasted — the glow covers it).
    if (!command.wasted && command.healed > 0) {
      this.playHealBurst(specs, cx, cy);
    }

    // HP visual feedback: the canvas readout pulses (the DOM meter stays canonical).
    if (this.hpText !== null) {
      const hp = this.hpText;
      specs.push({
        target: hp,
        to: { scaleX: 1.25, scaleY: 1.25 },
        durationMs: TIMING.glow.durationMs,
        ease: TIMING.glow.ease,
        yoyo: true,
        delayMs: TIMING.glow.durationMs,
      });
    }

    // Floating heal number: +healed (dimmed when wasted).
    const healColor = command.wasted || command.healed === 0 ? '#98a2b8' : '#7ed99a';
    specs.push(this.floatText(cx, cy - CARD_H / 2 - 10, `+${command.healed}`, healColor, 140));

    // The quaffed card leaves the table.
    this.roomSprites.delete(command.cardId);
    offPointerDown(card);
    specs.push({
      target: card,
      to: { alpha: 0, scaleX: card.scaleX * 0.9, scaleY: card.scaleY * 0.9 },
      durationMs: TIMING.exit.durationMs,
      ease: TIMING.exit.ease,
      delayMs: TIMING.glow.durationMs,
      onSettle: () => card.destroy(),
    });

    this.reSlotRoom(state, specs, TIMING.exit.durationMs);
    this.startChoreography(specs);
  }

  /** weapon pickup: weapon slides to its zone; the old kill stack sweeps to discard. */
  private playWeaponEquip(
    command: {
      cardId: CardId;
      discardedWeaponId: CardId | null;
      discardedMonsterIds: readonly CardId[];
    },
    state: GameState,
  ): void {
    const specs: TweenSpec[] = [];
    const card = this.roomSprites.get(command.cardId);
    if (card === undefined) return;
    this.roomSprites.delete(command.cardId);

    // Old weapon fades toward discard (set on every equip, incl. honest swaps).
    if (this.weaponSprite !== null && command.discardedWeaponId !== null) {
      const old = this.weaponSprite;
      specs.push({
        target: old,
        to: { alpha: 0, x: old.x - 34 },
        durationMs: TIMING.exit.durationMs,
        ease: TIMING.exit.ease,
        onSettle: () => old.destroy(),
      });
    }
    // Old kill stack sweeps away with the old weapon.
    command.discardedMonsterIds.forEach((_, index) => {
      const sprite = this.killSprites[index];
      if (sprite === undefined) return;
      offPointerDown(sprite);
      specs.push({
        target: sprite,
        to: { x: KILL_RIGHT + 70, alpha: 0 },
        durationMs: TIMING.sweep.durationMs,
        ease: TIMING.sweep.ease,
        delayMs: index * TIMING.sweep.staggerMs,
        onSettle: () => sprite.destroy(),
      });
    });
    this.killSprites = [];

    // The picked-up weapon slides from its room slot into the weapon zone.
    offPointerDown(card);
    this.weaponSprite = card;
    specs.push({
      target: card,
      to: { x: WEAPON_X, y: WEAPON_Y },
      durationMs: 280,
      ease: TIMING.deal.ease,
      delayMs: 60,
    });

    this.reSlotRoom(state, specs, 120);
    this.startChoreography(specs);
  }

  /** run-away sweep: the room sweeps out before the fresh room deals in. */
  private playRunAway(command: { newCards: readonly CardId[] }): void {
    const specs: TweenSpec[] = [];

    const olds = [...this.roomSprites.values()];
    this.roomSprites.clear();
    olds.forEach((sprite, index) => {
      offPointerDown(sprite);
      specs.push({
        target: sprite,
        to: { x: sprite.x - 90, alpha: 0 },
        durationMs: TIMING.sweep.durationMs,
        ease: TIMING.sweep.ease,
        delayMs: index * TIMING.sweep.staggerMs,
        onSettle: () => sprite.destroy(),
      });
    });
    const sweepTail = olds.length * TIMING.sweep.staggerMs;

    command.newCards.forEach((cardId, index) => {
      const slot = roomSlot(index);
      const sprite = this.makeRoomSprite(cardId, slot, null);
      sprite.setPosition(slot.x, slot.y - 70);
      sprite.setAlpha(0);
      specs.push({
        target: sprite,
        from: { x: slot.x, y: slot.y - 70, alpha: 0 },
        to: { x: slot.x, y: slot.y, alpha: 1 },
        durationMs: TIMING.deal.durationMs,
        ease: TIMING.deal.ease,
        delayMs: sweepTail + 80 + index * TIMING.deal.staggerMs,
      });
    });
    this.startChoreography(specs);
  }

  /** win/lose flourish: terminal-diff reconstruction first, then the flourish. */
  private playTerminal(
    command: { outcome: 'won' | 'lost'; reconstruction: TerminalPresentation | null },
    state: GameState,
  ): void {
    const specs: TweenSpec[] = [];
    let reconTail = 0;

    const reconstruction = command.reconstruction;
    if (reconstruction !== null) {
      reconTail = this.playReconstruction(reconstruction, state, specs);
      if (reconstruction.weaponBreak) this.playWeaponStrain(specs);
    }

    const flourishStart = reconTail + 80;
    if (command.outcome === 'won') {
      // Celebratory: gold wash + a pulse across the survivors (weapon + kills).
      specs.push(this.wash(SELECTION_COLOR, 0.22, 320, 'Sine.easeInOut', flourishStart));
      const survivors: Phaser.GameObjects.Sprite[] = [];
      if (this.weaponSprite !== null) survivors.push(this.weaponSprite);
      survivors.push(...this.killSprites);
      survivors.forEach((sprite, index) => {
        specs.push({
          target: sprite,
          to: { scaleX: sprite.scaleX * 1.08, scaleY: sprite.scaleY * 1.08 },
          durationMs: TIMING.flourish.durationMs,
          ease: TIMING.flourish.ease,
          yoyo: true,
          delayMs: flourishStart + index * 40, // tighter cadence (≤4 survivors)
        });
      });
    } else {
      // Dark: the table dims behind the loss.
      specs.push(this.wash(0x020617, 0.45, 380, 'Sine.easeIn', flourishStart));
    }

    // The run-ended gate fires exactly when the flourish completes (instantly
    // under reduced motion — the end state IS "completed").
    this.startChoreography(specs, () => this.flourishCompleteCb?.({ outcome: command.outcome }));
  }

  /** Reconstructs the killing blow / final resolve from the diff; returns its tail time. */
  private playReconstruction(
    reconstruction: TerminalPresentation,
    state: GameState,
    specs: TweenSpec[],
  ): number {
    let tail = 0;
    if (reconstruction.killAppendedId !== null) {
      const sprite = this.roomSprites.get(reconstruction.killAppendedId);
      if (sprite !== undefined) {
        this.roomSprites.delete(reconstruction.killAppendedId);
        sprite.setDepth(20);
        offPointerDown(sprite);
        this.killSprites.push(sprite);
        const anchor = killSlot(0);
        specs.push({
          target: sprite,
          to: {
            x: anchor.x,
            y: anchor.y,
            scaleX: sprite.scaleX * KILL_SCALE,
            scaleY: sprite.scaleY * KILL_SCALE,
          },
          durationMs: TIMING.stackDrop.durationMs,
          ease: TIMING.stackDrop.ease,
        });
        applyKillDepths(state.killStack, this.killSprites);
        tail = TIMING.stackDrop.durationMs;
      }
    }
    for (const cardId of reconstruction.removedFromRoom) {
      const sprite = this.roomSprites.get(cardId);
      if (sprite === undefined) continue;
      this.roomSprites.delete(cardId);
      offPointerDown(sprite);
      specs.push({
        target: sprite,
        to: { alpha: 0, y: sprite.y + 40 },
        durationMs: TIMING.exit.durationMs,
        ease: TIMING.exit.ease,
        delayMs: 100, // bounds the reconstruction tail so the won flourish
        onSettle: () => sprite.destroy(), // completes under the fail-open gate
      });
      tail = Math.max(tail, 100 + TIMING.exit.durationMs);
    }
    for (const cardId of reconstruction.addedToRoom) {
      const index = state.room.indexOf(cardId);
      const slot = roomSlot(Math.max(0, index));
      const sprite = this.makeRoomSprite(cardId, slot, null);
      sprite.setPosition(slot.x, slot.y - 70);
      sprite.setAlpha(0);
      specs.push({
        target: sprite,
        from: { x: slot.x, y: slot.y - 70, alpha: 0 },
        to: { x: slot.x, y: slot.y, alpha: 1 },
        durationMs: TIMING.deal.durationMs,
        ease: TIMING.deal.ease,
      });
      tail = Math.max(tail, TIMING.deal.durationMs);
    }
    return tail;
  }

  /** error feedback: subtle shake — driven from lastResult, never the diff. */
  private playErrorFeedback(): void {
    // Reduced motion: nothing (the DOM live region announces the block/reason).
    if (this.reducedMotion) return;
    const specs: TweenSpec[] = [];
    let index = 0;
    for (const sprite of this.roomSprites.values()) {
      const slot = this.slot(sprite);
      specs.push({
        target: sprite,
        from: { x: slot.x },
        to: { x: slot.x + 6 },
        durationMs: TIMING.shake.durationMs,
        ease: TIMING.shake.ease,
        yoyo: true,
        repeat: 2,
        delayMs: index * 20,
      });
      index += 1;
    }
    this.startChoreography(specs);
  }

  /** Undo/mismatch: cross-fade rebuild from authoritative state. */
  private playRebuild(state: GameState | null): void {
    const specs: TweenSpec[] = [];

    // Fade the current table out.
    const olds: Phaser.GameObjects.Sprite[] = [...this.roomSprites.values(), ...this.killSprites];
    if (this.weaponSprite !== null) olds.push(this.weaponSprite);
    this.roomSprites.clear();
    this.killSprites = [];
    this.weaponSprite = null;
    olds.forEach((sprite) => {
      offPointerDown(sprite);
      specs.push({
        target: sprite,
        to: { alpha: 0 },
        durationMs: TIMING.crossFade.durationMs,
        ease: TIMING.crossFade.ease,
        onSettle: () => sprite.destroy(),
      });
    });

    // Fade the restored state in at its final layout.
    if (state !== null) {
      state.room.forEach((cardId, index) => {
        const slot = roomSlot(index);
        const sprite = this.makeRoomSprite(cardId, slot, state.carriedCardId);
        sprite.setAlpha(0);
        specs.push({
          target: sprite,
          to: { alpha: 1 },
          durationMs: TIMING.crossFade.durationMs,
          ease: TIMING.crossFade.ease,
          delayMs: 60,
        });
      });
      if (state.weapon !== null) {
        const weapon = this.makeCardSprite(state.weapon, WEAPON_X, WEAPON_Y);
        weapon.setAlpha(0);
        this.weaponSprite = weapon;
        specs.push({
          target: weapon,
          to: { alpha: 1 },
          durationMs: TIMING.crossFade.durationMs,
          ease: TIMING.crossFade.ease,
          delayMs: 60,
        });
      }
      state.killStack.forEach((cardId) => {
        const indexFromTop = state.killStack.length - 1 - this.killSprites.length;
        const sprite = this.makeKillSprite(
          cardId,
          killSlot(indexFromTop),
          5 - Math.min(indexFromTop, MAX_KILL_STEPS),
        );
        sprite.setAlpha(0);
        specs.push({
          target: sprite,
          to: { alpha: 1 },
          durationMs: TIMING.crossFade.durationMs,
          ease: TIMING.crossFade.ease,
          delayMs: 60,
        });
      });
    }
    this.startChoreography(specs);
  }

  // --- decorations ------------------------------------------------------------

  private refreshDecorations(): void {
    // Carried-card badge + looping shimmer follow the carried sprite's slot.
    // The shimmer reads the card as special; skipped entirely under reduced
    // motion (static minimal frame).
    const carriedSprite = this.carried !== null ? this.roomSprites.get(this.carried) : undefined;
    if (this.carriedBadge !== null) {
      if (carriedSprite !== undefined) {
        const slot = this.slot(carriedSprite);
        this.carriedBadge
          .setPosition(slot.x + CARD_W / 2 - 12, slot.y - CARD_H / 2 + 12)
          .setVisible(true);
      } else {
        this.carriedBadge.setVisible(false);
      }
    }
    if (this.carriedShimmer !== null) {
      const shimmerOn = carriedSprite !== undefined && !this.reducedMotion;
      if (carriedSprite !== undefined && this.shimmerFlight !== null) {
        const slot = this.slot(carriedSprite);
        this.carriedShimmer.setPosition(slot.x, slot.y);
      }
      this.carriedShimmer.setVisible(shimmerOn);
      if (shimmerOn) {
        if (this.shimmerFlight === null) {
          // Start the looping shimmer (never snapped by resolve commands).
          const shimmer = this.carriedShimmer;
          const specs: TweenSpec[] = [
            {
              target: shimmer,
              from: { alpha: CARRIED_SHIMMER.alphaMin },
              to: { alpha: CARRIED_SHIMMER.alphaMax },
              durationMs: CARRIED_SHIMMER.loopMs,
              ease: CARRIED_SHIMMER.ease,
              yoyo: true,
              repeat: -1,
            },
          ];
          const tracker = new TweenTracker();
          runChoreography(this.tweenHost(), tracker, specs);
          this.shimmerFlight = tracker;
        }
      } else if (this.shimmerFlight !== null) {
        this.shimmerFlight.snapAll(); // settles the shimmer at its rest alpha
        this.shimmerFlight = null;
      }
    }

    // Selection: fill-tinted glow pad behind the card (v4 tint-fill API) + gold
    // stroke ring on top, matching the DOM `.selected-ring` indicator. Anchored
    // to the canonical slot so lifts don't drag the ring.
    const target = this.selected !== null ? this.roomSprites.get(this.selected) : undefined;
    if (this.glow === null || this.ring === null || target === undefined) {
      this.glow?.setVisible(false);
      this.ring?.setVisible(false);
      return;
    }
    const slot = this.slot(target);
    this.glow
      .setPosition(slot.x, slot.y)
      .setDisplaySize(CARD_W + 14, CARD_H + 14)
      .setTint(SELECTION_COLOR)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.28)
      .setDepth(target.depth - 1)
      .setVisible(true);
    this.ring
      .clear()
      .lineStyle(3, SELECTION_COLOR, 1)
      .strokeRect(slot.x - CARD_W / 2 - 5, slot.y - CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10)
      .setDepth(30)
      .setVisible(true);
  }
}

/** Selected-card lift / deselect settle as a tracked spec (selection lifts are
 * tracked separately so a selection change never snaps resolve tweens). */
function liftSpec(sprite: Phaser.GameObjects.Sprite, lift: boolean, delayMs: number): TweenSpec {
  const slot = sprite.getData('slot') as Slot | undefined;
  const baseY = slot?.y ?? sprite.y;
  return lift
    ? {
        target: sprite,
        to: { y: baseY - LIFT_PX },
        durationMs: TIMING.lift.durationMs,
        ease: TIMING.lift.ease,
        delayMs,
      }
    : {
        target: sprite,
        to: { y: baseY },
        durationMs: TIMING.lift.durationMs,
        ease: TIMING.lift.ease,
        delayMs,
      };
}
