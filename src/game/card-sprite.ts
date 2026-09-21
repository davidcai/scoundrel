import * as Phaser from 'phaser';
import type { CardId } from '../engine';
import { cardImageUrl } from '../ui/card-image';
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
 */

/** Mirrors .card background / border / radius in src/styles.css. */
export const PLACEHOLDER_COLOR = 0x0d1119;
export const PLACEHOLDER_BORDER = 0x0a0d13;
export const PLACEHOLDER_RADIUS = 12;

const TEXTURE_PREFIX = 'card-';
const FILE_COMPLETE_EVENT = 'filecomplete-image-';
const LOAD_ERROR_EVENT = 'loaderror';
/** Sprite alpha while the DOM hit-layer reports hover (non-animated). */
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

export interface CardSpriteHandle {
  readonly cardId: CardId;
  readonly container: Phaser.GameObjects.Container;
  /** Reposition/resize after a board re-layout (e.g. Scale.RESIZE). */
  setRect(rect: Rect): void;
  /**
   * Non-animated hover state, bridged from the DOM hit-layer (Phase 2).
   * Alpha only — no tweens, no angle changes (phaserjs/phaser#7341).
   */
  setHovered(hovered: boolean): void;
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

  let destroyed = false;
  let image: Phaser.GameObjects.Image | null = null;

  const showTexture = (): void => {
    if (destroyed || !scene.textures.exists(key)) return;
    const loaded = scene.add.image(0, 0, key);
    loaded.setDisplaySize(rect.width, rect.height);
    image = loaded;
    placeholder.destroy();
    // Render the artwork behind any later-added children (none today).
    container.addAt(loaded, 0);
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
      container.setPosition(next.x + next.width / 2, next.y + next.height / 2);
      if (image !== null) {
        image.setDisplaySize(next.width, next.height);
      } else {
        drawPlaceholder(placeholder, next.width, next.height);
      }
    },
    setHovered(hovered: boolean): void {
      // Multiplicative tint can only darken, so a slight alpha dip stands in
      // for the DOM's brightness(1.08). Deliberately NOT a tween.
      container.setAlpha(hovered ? HOVER_ALPHA : 1);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      scene.load.off(fileCompleteEvent, showTexture);
      scene.load.off(LOAD_ERROR_EVENT, onLoadError);
      container.destroy();
    },
  };
}
