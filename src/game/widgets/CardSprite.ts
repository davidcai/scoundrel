import Phaser from 'phaser';
import { cardRank, cardSymbol, isRedCard, type CardId } from '../../engine';
import { registerSceneObject, unregisterSceneObject } from '../debug';
import { COLORS, FONT, RADIUS, rgb } from '../theme';

/**
 * Minimal card view for stage 3: artwork image (or graphics fallback with the
 * rank + suit symbol), gold selection ring, and a carried-over badge
 * placeholder. Grows into the full interactive card in stage 4.
 */

export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 252;

export interface CardSpriteOptions {
  onClick?: () => void;
}

/**
 * Stroke a dashed rectangle (Phaser Graphics has no native dash support).
 * Square corners are fine — this is a keyboard-focus outline, not card chrome.
 */
function drawDashedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  dash = 10,
  gap = 6,
): void {
  const step = dash + gap;
  for (let px = x; px < x + width; px += step) {
    const end = Math.min(px + dash, x + width);
    g.lineBetween(px, y, end, y);
    g.lineBetween(px, y + height, end, y + height);
  }
  for (let py = y; py < y + height; py += step) {
    const end = Math.min(py + dash, y + height);
    g.lineBetween(x, py, x, end);
    g.lineBetween(x + width, py, x + width, end);
  }
}

export class CardSprite extends Phaser.GameObjects.Container {
  readonly cardId: CardId;
  /** Click handler — invoked on pointerup over the card. */
  onClick: (() => void) | null = null;

  private readonly ring: Phaser.GameObjects.Graphics;
  /** Keyboard-focus outline (roving arrow-key focus), separate from `ring`. */
  private readonly focusRing: Phaser.GameObjects.Graphics;
  private focused = false;
  private readonly carriedBadge: Phaser.GameObjects.Container;
  /**
   * Child container holding the card art: the only layer hover/selection
   * tweens move, so the container's hit area never leaves the grid position.
   */
  private readonly bodyRoot: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cardId: CardId,
    opts: CardSpriteOptions = {},
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.cardId = cardId;
    this.onClick = opts.onClick ?? null;

    const width = CARD_WIDTH;
    const height = CARD_HEIGHT;
    this.setSize(width, height);
    this.bodyRoot = scene.add.container(0, 0);

    let fallback: Phaser.GameObjects.Graphics | null = null;
    if (scene.textures.exists(cardId)) {
      this.bodyRoot.add(scene.add.image(0, 0, cardId).setDisplaySize(width, height));
    } else {
      // Missing artwork: draw the suit-toned panel fallback (matches the
      // CardSprite contract — the app never depends on a texture being there).
      const suitColor = isRedCard(cardId) ? COLORS.suitRed : COLORS.suitLight;
      fallback = scene.add.graphics();
      fallback
        .fillStyle(rgb(COLORS.panel), 1)
        .fillRoundedRect(-width / 2, -height / 2, width, height, RADIUS.card);
      fallback
        .lineStyle(2, rgb(suitColor), 0.9)
        .strokeRoundedRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, RADIUS.card);
      const rank = scene.add
        .text(0, -34, cardRank(cardId).toUpperCase(), {
          fontFamily: FONT.display,
          fontSize: '44px',
          color: suitColor,
        })
        .setOrigin(0.5);
      const symbol = scene.add
        .text(0, 30, cardSymbol(cardId), {
          fontFamily: FONT.family,
          fontSize: '64px',
          color: suitColor,
        })
        .setOrigin(0.5);
      this.bodyRoot.add([fallback, rank, symbol]);
    }

    // Gold selection ring (hidden until setSelected). Lives outside bodyRoot
    // so the hover lift doesn't drag it along.
    this.ring = scene.add.graphics();
    this.ring
      .lineStyle(3, rgb(COLORS.goldBright), 1)
      .strokeRoundedRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8, RADIUS.card + 2);
    this.ring.setVisible(false);

    // Keyboard-focus indicator: thin dashed outline outside the selection
    // ring (white at ~65% — distinct from the thicker solid gold selection
    // ring). Its own layer so it never fights the hover/selection tweens.
    this.focusRing = scene.add.graphics();
    this.focusRing.lineStyle(2, rgb(COLORS.suitLight), 0.65);
    drawDashedRect(this.focusRing, -width / 2 - 8, -height / 2 - 8, width + 16, height + 16);
    this.focusRing.setVisible(false).setAlpha(0);

    // Carried-over badge placeholder (hidden until setCarried).
    this.carriedBadge = scene.add.container(width / 2 - 16, -height / 2 + 16);
    const badgeDot = scene.add.graphics();
    badgeDot.fillStyle(rgb(COLORS.gold), 1).fillCircle(0, 0, 12);
    const badgeArrow = scene.add
      .text(0, 0, '→', { fontFamily: FONT.family, fontSize: '16px', color: COLORS.goldInk })
      .setOrigin(0.5);
    this.carriedBadge.add([badgeDot, badgeArrow]);
    this.carriedBadge.setVisible(false);

    this.add([this.bodyRoot, this.ring, this.focusRing, this.carriedBadge]);

    // Hit area = card rect. Bound once at the FINAL position — hover/selection
    // tweens animate child layers, never the container, so the hit rect never
    // moves mid-tween.
    this.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerup', () => this.onClick?.());

    // Hover lift: shift the child layers up instead of the container, so the
    // hit area stays at the grid position. Skipped while selected.
    this.on('pointerover', () => {
      if (this.ring.visible) return;
      this.scene?.tweens.add({ targets: this.bodyRoot, y: -4, duration: 90, ease: 'Sine.easeOut' });
    });
    this.on('pointerout', () => {
      this.scene?.tweens.add({ targets: this.bodyRoot, y: 0, duration: 90, ease: 'Sine.easeOut' });
    });

    this.name = cardId;
    registerSceneObject(cardId, this);
  }

  setSelected(selected: boolean): this {
    if (this.ring.visible === selected) return this;
    this.ring.setVisible(selected);
    if (selected) {
      // Quick scale pop on the child layers — the container (and its hit area)
      // never move, so clicks stay bound to the final grid position.
      this.scene?.tweens.add({
        targets: this.ring,
        scale: { from: 0.94, to: 1 },
        duration: 100,
        ease: 'Back.easeOut',
      });
      this.scene?.tweens.add({
        targets: this.ring,
        alpha: { from: 0.4, to: 1 },
        duration: 100,
        ease: 'Sine.easeOut',
      });
    }
    return this;
  }

  setCarried(carried: boolean): this {
    this.carriedBadge.setVisible(carried);
    return this;
  }

  /**
   * Keyboard-focus indicator (roving arrow-key focus in PlayScene). Fully
   * independent of selection and of the pointer hover lift: a thin dashed
   * outline on its own layer with a subtle 80ms alpha fade — no scale tween,
   * so it cannot fight the hover animation on bodyRoot.
   */
  setFocused(focused: boolean): this {
    if (this.focused === focused) return this;
    this.focused = focused;
    this.focusRing.setVisible(true);
    const tweens = this.scene?.tweens;
    if (tweens) {
      tweens.add({
        targets: this.focusRing,
        alpha: focused ? 1 : 0,
        duration: 80,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (!focused && this.focusRing.active) this.focusRing.setVisible(false);
        },
      });
    } else {
      this.focusRing.setAlpha(focused ? 1 : 0);
      this.focusRing.setVisible(focused);
    }
    return this;
  }

  destroy(fromScene?: boolean): void {
    unregisterSceneObject(this.cardId);
    super.destroy(fromScene);
  }
}
