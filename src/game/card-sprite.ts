import * as Phaser from 'phaser';
import type { CardId } from '../engine';
import { cardImageUrl } from '../ui/card-image';
import { createGlow, FX_COLOR, GLOW_STRENGTH, type GlowHandle } from './fx';
import type { Rect } from './board-layout';

/**
 * Card sprite factory (phaser-adoption-plan target architecture).
 *
 * - Texture: unique key `card-${cardId}`, loaded from the existing hashed
 *   `cardImageUrl(cardId)` URL — no asset duplication.
 * - While the texture loads, a rounded-rect placeholder is shown. The canvas
 *   renders ZERO text (plan rule), so the placeholder is a bare shape.
 * - Sprites are NOT interactive (see PhaserBoard: `input: false`). Per the
 *   plan, the canvas never receives pointer events — the DOM layer owns all
 *   input, in the spike and in Phase 2's hit-layer alike. Phaser registers
 *   window-level mouse listeners when its input system is enabled, which
 *   would intercept every DOM click on the page.
 *
 * Phase 3 (motion): the container also carries a CSS-mirrored card BACK
 * panel for the deal flip (a shapes-only stand-in for `.fx-card-back`) and
 * a lazily-created Glow filter for selection/hover emphasis. Phase 1a's
 * motion policy lives here as `snapTo`: kill the sprite's tweens, reset its
 * visual modifiers, and re-apply the shared layout rect — the ground truth
 * every tween must end at (e2e asserts resting geometry ≤1px).
 */

/** Mirrors .card background / border / radius in src/styles.css. */
export const PLACEHOLDER_COLOR = 0x0d1119;
export const PLACEHOLDER_BORDER = 0x0a0d13;
export const PLACEHOLDER_RADIUS = 12;

/** Card-back palette — mirrors `.fx-card-back` in src/styles.css. */
const BACK_PANEL = 0x141926;
const BACK_BORDER = 0x2c3650;
const BACK_GOLD = 0xd9a44a;
const BACK_GOLD_BRIGHT = 0xf0c169;

const TEXTURE_PREFIX = 'card-';
const FILE_COMPLETE_EVENT = 'filecomplete-image-';
const LOAD_ERROR_EVENT = 'loaderror';
/** Sprite alpha while the DOM hit-layer reports hover (glow unavailable). */
const HOVER_ALPHA = 0.82;

/**
 * Load keys queued per scene (phaser 4.2.1 does not type LoaderPlugin.exists,
 * so double-queueing the same texture is prevented here instead).
 */
const queuedLoads = new WeakMap<Phaser.Scene, Set<string>>();

function isQueued(scene: Phaser.Scene, key: string): boolean {
  return queuedLoads.get(scene)?.has(key) ?? false;
}

function markQueued(scene: Phaser.Scene, key: string): void {
  let keys = queuedLoads.get(scene);
  if (keys === undefined) {
    keys = new Set();
    queuedLoads.set(scene, keys);
  }
  keys.add(key);
}

export function cardTextureKey(cardId: CardId): string {
  return `${TEXTURE_PREFIX}${cardId}`;
}

/**
 * Queue any not-yet-loaded card textures (idempotent with createCardSprite's
 * queue bookkeeping) and return the texture keys still pending. Phase 4:
 * lets the scene gate the MOUNT deal on texture load so the flip reveal never
 * shows a placeholder mid-unfold. The loader cycle fires `complete` even when
 * individual files error — a pending key that errored simply never swaps.
 */
export function queueCardTextures(scene: Phaser.Scene, cardIds: readonly CardId[]): string[] {
  const pending: string[] = [];
  let queued = false;
  for (const cardId of cardIds) {
    const key = cardTextureKey(cardId);
    if (scene.textures.exists(key)) continue;
    const url = cardImageUrl(cardId);
    if (url === '' || isQueued(scene, key)) {
      // Unknown card id (never loads) or already queued by an earlier
      // createCardSprite call — still pending either way.
      pending.push(key);
      continue;
    }
    markQueued(scene, key);
    scene.load.image(key, url);
    pending.push(key);
    queued = true;
  }
  if (queued) scene.load.start();
  return pending;
}

/** The face visual — the loaded artwork or, until it arrives, the placeholder. */
type FaceVisual = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

export interface CardSpriteHandle {
  readonly cardId: CardId;
  readonly container: Phaser.GameObjects.Container;
  /** Reposition/resize after a board re-layout (e.g. Scale.RESIZE). */
  setRect(rect: Rect): void;
  /**
   * Non-animated hover state, bridged from the DOM hit-layer. Upgraded in
   * Phase 3: a soft glow when the WebGL filter is available, the original
   * alpha dip as fallback (placeholder phase / Canvas renderer).
   */
  setHovered(hovered: boolean): void;
  /** Selection emphasis — the DOM `.selected-ring` stays the a11y contract. */
  setSelected(selected: boolean): void;
  /** Deal state: opaque back panel on top, ready for playFlipReveal. */
  showBack(): void;
  /**
   * Two-phase scaleX flip (back folds away, face unfolds). Deliberately no
   * angle tweens (phaserjs/phaser#7341) and no onComplete chaining — the
   * motion policy's kill+snap path restores the resting state instead.
   */
  playFlipReveal(durationMs: number, delayMs: number): void;
  /**
   * Motion-policy snap: kill every tween on this sprite (container, face,
   * back, glow), reset visual modifiers, apply the layout rect. Idempotent.
   */
  snapTo(rect: Rect): void;
  /**
   * {@link snapTo} without the reposition: kill tweens and reset visual
   * modifiers, leaving the container where it is (departure beats tween
   * from the frozen state).
   */
  freeze(): void;
  /** Dim the face (wasted potion dissolve). Tint when the texture is loaded. */
  setDimmed(dim: boolean): void;
  /** One-shot gold glow pulse (carried-card emphasis). False = unavailable. */
  pulseGlow(delayMs: number): boolean;
  destroy(): void;
}

function drawPlaceholder(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
): void {
  graphics.clear();
  graphics.fillStyle(PLACEHOLDER_COLOR, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, PLACEHOLDER_RADIUS);
  graphics.lineStyle(1, PLACEHOLDER_BORDER, 1);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, PLACEHOLDER_RADIUS);
}

/**
 * The CSS-styled card back, in shapes only (zero text — plan rule): dark
 * textured panel, inner gold frame, and a centered diamond emblem.
 */
function drawCardBack(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.fillStyle(BACK_PANEL, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, PLACEHOLDER_RADIUS);
  graphics.lineStyle(1, BACK_BORDER, 1);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, PLACEHOLDER_RADIUS);
  const inset = Math.max(6, Math.min(width, height) * 0.05);
  graphics.lineStyle(1, BACK_GOLD, 0.3);
  graphics.strokeRoundedRect(
    -width / 2 + inset,
    -height / 2 + inset,
    width - inset * 2,
    height - inset * 2,
    Math.max(0, PLACEHOLDER_RADIUS - inset),
  );
  const size = Math.min(width, height) * 0.18;
  graphics.lineStyle(2, BACK_GOLD_BRIGHT, 0.55);
  graphics.strokePoints(
    [
      new Phaser.Math.Vector2(0, -size),
      new Phaser.Math.Vector2(size, 0),
      new Phaser.Math.Vector2(0, size),
      new Phaser.Math.Vector2(-size, 0),
      new Phaser.Math.Vector2(0, -size),
    ],
    true,
  );
}

export function createCardSprite(
  scene: Phaser.Scene,
  cardId: CardId,
  rect: Rect,
): CardSpriteHandle {
  const key = cardTextureKey(cardId);
  const fileCompleteEvent = `${FILE_COMPLETE_EVENT}${key}`;

  const container = scene.add.container(rect.x + rect.width / 2, rect.y + rect.height / 2);

  const placeholder = scene.add.graphics();
  drawPlaceholder(placeholder, rect.width, rect.height);
  container.add(placeholder);

  // Card back: drawn once per rect, sits ABOVE the face while visible.
  const backPanel = scene.add.graphics();
  drawCardBack(backPanel, rect.width, rect.height);
  backPanel.setVisible(false);
  container.add(backPanel);

  let destroyed = false;
  let image: Phaser.GameObjects.Image | null = null;
  let glow: GlowHandle | null = null;
  let hovered = false;
  let selected = false;
  let dimmed = false;
  /** Duration of the unfold half-flip, reused if the texture lands mid-flip. */
  let flipHalf = 130;
  /**
   * The face visual's intended DISPLAY width (the current layout rect's
   * width). For the placeholder/graphics visuals this equals their natural
   * drawn size (scale 1); for the loaded Image it maps to the texture's
   * native pixel width (an 1152px artwork shows at 192px → scaleX ≈ 0.167).
   * ALL face scaleX math must go through restFaceScaleX — a raw `scaleX: 1`
   * tween target would render the texture at natural size (the Phase 3
   * "oversized, butt-joined, clipped" first-frame bug).
   */
  let faceWidth = rect.width;
  let faceHeight = rect.height;

  const faceVisual = (): FaceVisual => image ?? placeholder;

  /** The face's resting scaleX for its current visual: display width / natural width. */
  const restFaceScaleX = (): number => {
    if (image !== null && image.width > 0) return faceWidth / image.width;
    return 1; // placeholder & friends are drawn at the rect's own size
  };

  const glowStrength = (): number => {
    if (selected) return GLOW_STRENGTH.selected;
    if (hovered) return GLOW_STRENGTH.hover;
    return 0;
  };

  /** Applies the wanted glow, lazily attaching it to the loaded texture.
   * Falls back to the alpha dip when filters are unavailable. */
  const refreshGlow = (): void => {
    const strength = glowStrength();
    if (strength > 0 && glow === null && image !== null) {
      glow = createGlow(image, FX_COLOR.gold);
    }
    if (glow !== null) {
      glow.set(strength);
      container.setAlpha(1);
      return;
    }
    // Filter unavailable (or placeholder phase): alpha fallback.
    container.setAlpha(hovered && !selected ? HOVER_ALPHA : 1);
  };

  const showTexture = (): void => {
    if (destroyed || !scene.textures.exists(key)) return;
    const loaded = scene.add.image(0, 0, key);
    // Current display size (setRect may have re-laid-out since creation).
    loaded.setDisplaySize(faceWidth, faceHeight);
    // A texture landing mid-flip must not pop the face full-size under the
    // folding back: inherit the squash and restart the unfold. The squash
    // progress lives on the placeholder's scale (1 = rect width); the image's
    // equivalent visual width is that fraction × its own resting scale.
    // (`restFaceScaleX` cannot be used here — `image` is not assigned yet.)
    const restX = loaded.width > 0 ? faceWidth / loaded.width : 1;
    const midFlip = backPanel.visible;
    scene.tweens.killTweensOf(placeholder);
    loaded.scaleX = midFlip ? placeholder.scaleX * restX : restX;
    if (dimmed) loaded.setTint(0x98a2b8);
    image = loaded;
    placeholder.destroy();
    // Face renders behind the back panel (added above it).
    container.addAt(loaded, 0);
    if (midFlip) {
      scene.tweens.add({
        targets: loaded,
        scaleX: restX,
        duration: flipHalf,
        ease: 'Cubic.easeOut',
      });
    }
    refreshGlow();
  };

  const onLoadError = (file: Phaser.Loader.File): void => {
    if (destroyed || file.key !== key) return;
    // Keep the placeholder (missing artwork must never render as text/blank).
    scene.load.off(LOAD_ERROR_EVENT, onLoadError);
  };

  const url = cardImageUrl(cardId);
  if (scene.textures.exists(key)) {
    showTexture();
  } else if (url !== '' && !isQueued(scene, key)) {
    // Post-preload loading: queue the file, then kick the loader. Files added
    // while the loader is already running are picked up by its update loop.
    markQueued(scene, key);
    scene.load.image(key, url);
    scene.load.once(fileCompleteEvent, showTexture);
    scene.load.on(LOAD_ERROR_EVENT, onLoadError);
    scene.load.start();
  }
  // url === '' (unknown card id) → placeholder stays; nothing to load.

  return {
    cardId,
    container,
    setRect(next: Rect): void {
      faceWidth = next.width;
      faceHeight = next.height;
      container.setPosition(next.x + next.width / 2, next.y + next.height / 2);
      if (image !== null) {
        image.setDisplaySize(next.width, next.height);
      } else {
        drawPlaceholder(placeholder, next.width, next.height);
      }
      drawCardBack(backPanel, next.width, next.height);
    },
    setHovered(next: boolean): void {
      hovered = next;
      if (glow !== null || image !== null) {
        refreshGlow();
      } else {
        // Multiplicative tint can only darken, so a slight alpha dip stands
        // in for the DOM's brightness(1.08). Deliberately NOT a tween.
        container.setAlpha(hovered ? HOVER_ALPHA : 1);
      }
    },
    setSelected(next: boolean): void {
      selected = next;
      refreshGlow();
    },
    setDimmed(next: boolean): void {
      dimmed = next;
      if (image !== null) {
        if (dimmed) image.setTint(FX_COLOR.mist);
        else image.clearTint();
      }
    },
    showBack(): void {
      backPanel.setVisible(true);
      backPanel.scaleX = 1;
      const face = faceVisual();
      face.visible = true;
      face.scaleX = restFaceScaleX();
    },
    playFlipReveal(durationMs: number, delayMs: number): void {
      flipHalf = Math.max(40, Math.round(durationMs / 2));
      // Phase 1 — the back folds away (squash to zero width).
      scene.tweens.add({
        targets: backPanel,
        scaleX: 0,
        duration: flipHalf,
        delay: delayMs,
        ease: 'Cubic.easeIn',
      });
      // Phase 2 — the face unfolds from the crossover point. Started with its
      // own delay (never chained off onComplete: tween.stop() fires onStop).
      // The unfold lands on the face's RESTING display scale — for a loaded
      // image that is faceWidth/textureWidth, NOT 1 (a raw 1 renders the
      // texture at its natural pixel size).
      const face = faceVisual();
      const restX = restFaceScaleX();
      face.scaleX = 0;
      scene.tweens.add({
        targets: face,
        scaleX: restX,
        duration: flipHalf,
        delay: delayMs + flipHalf,
        ease: 'Cubic.easeOut',
      });
    },
    snapTo(next: Rect): void {
      this.freeze();
      this.setRect(next);
    },
    /**
     * Kill every tween this sprite owns and reset visual modifiers, leaving
     * the container position untouched (the departure beats tween from the
     * frozen state).
     */
    freeze(): void {
      scene.tweens.killTweensOf(container);
      scene.tweens.killTweensOf(placeholder);
      scene.tweens.killTweensOf(backPanel);
      if (image !== null) scene.tweens.killTweensOf(image);
      glow?.killTweens(scene);
      container.setAlpha(1);
      container.setScale(1);
      container.setDepth(0);
      backPanel.setVisible(false);
      backPanel.scaleX = 1;
      const face = faceVisual();
      face.visible = true;
      // Resting display scale, not raw 1 — a raw 1 pops a loaded texture to
      // its natural pixel size (departure beats would fly giant cards).
      face.scaleX = restFaceScaleX();
    },
    pulseGlow(delayMs: number): boolean {
      if (image === null) return false;
      if (glow === null) glow = createGlow(image, FX_COLOR.gold);
      if (glow === null) return false;
      glow.set(glowStrength()); // establish the yoyo baseline
      return glow.pulse(scene, GLOW_STRENGTH.pulse, 400, delayMs);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.load.off(fileCompleteEvent, showTexture);
      scene.load.off(LOAD_ERROR_EVENT, onLoadError);
      glow?.destroy();
      glow = null;
      container.destroy();
    },
  };
}
