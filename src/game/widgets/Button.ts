import Phaser from 'phaser';
import { registerSceneObject, unregisterSceneObject } from '../debug';
import { COLORS, FONT, RADIUS, rgb } from '../theme';

/**
 * Container-based button ported from the old `.btn` CSS: rounded rect with a
 * subtle scale pulse on hover/press, themed per variant.
 */

export type ButtonVariant = 'primary' | 'default' | 'danger' | 'ghost';

interface VariantStyle {
  fill: number | null;
  stroke: number | null;
  /** CSS color string for the label. */
  text: string;
}

const VARIANTS: Record<ButtonVariant, { normal: VariantStyle; hover: VariantStyle }> = {
  // .btn.primary — solid gold, dark ink text.
  primary: {
    normal: { fill: rgb(COLORS.gold), stroke: rgb(COLORS.goldBright), text: COLORS.goldInk },
    hover: { fill: rgb(COLORS.goldBright), stroke: rgb(COLORS.goldBright), text: COLORS.goldInk },
  },
  // .btn — outlined panel surface.
  default: {
    normal: { fill: rgb(COLORS.panelLight), stroke: rgb(COLORS.border), text: COLORS.text },
    hover: { fill: rgb(COLORS.panelLighter), stroke: rgb(COLORS.gold), text: COLORS.goldBright },
  },
  // .btn.danger — red fill.
  danger: {
    normal: { fill: rgb(COLORS.danger), stroke: rgb(COLORS.dangerDark), text: '#ffffff' },
    hover: { fill: 0xea6b64, stroke: rgb(COLORS.dangerDark), text: '#ffffff' },
  },
  // .btn.ghost — transparent, muted text.
  ghost: {
    normal: { fill: null, stroke: null, text: COLORS.muted },
    hover: { fill: null, stroke: null, text: COLORS.gold },
  },
};

export interface ButtonOptions {
  variant?: ButtonVariant;
  width?: number;
  height?: number;
  fontSize?: number;
  onClick?: () => void;
  /** Stable id for the debug registry / e2e tooling (also used as `name`). */
  debugId?: string;
}

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 56;
const SCALE_DURATION = 80;
const SCALE_HOVER = 1.03;
const SCALE_PRESS = 0.97;

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly variant: ButtonVariant;
  private readonly onClick: (() => void) | null;
  private readonly debugId: string | null;
  private readonly hitArea: Phaser.Geom.Rectangle;

  private enabled = true;
  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: ButtonOptions = {}) {
    super(scene, x, y);
    this.variant = opts.variant ?? 'default';
    this.onClick = opts.onClick ?? null;
    this.debugId = opts.debugId ?? null;

    const width = opts.width ?? DEFAULT_WIDTH;
    const height = opts.height ?? DEFAULT_HEIGHT;
    this.setSize(width, height);

    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: FONT.family,
        fontSize: `${opts.fontSize ?? FONT.size.small + 2}px`,
        color: VARIANTS[this.variant].normal.text,
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.redraw();

    // Centered hit area so clicks keep working while the container is scaled.
    this.hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    this.on('pointerover', this.handleOver, this);
    this.on('pointerout', this.handleOut, this);
    this.on('pointerdown', this.handleDown, this);
    this.on('pointerup', this.handleUp, this);
    // Released (or cancelled) off the button: release the pressed state only.
    this.on('pointerupoutside', this.handleReleaseOnly, this);
    this.on('pointercancel', this.handleReleaseOnly, this);

    if (this.debugId !== null) {
      this.name = this.debugId;
      registerSceneObject(this.debugId, this);
    }
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    if (enabled) {
      this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
      this.setAlpha(1);
    } else {
      this.hovered = false;
      this.pressed = false;
      this.disableInteractive();
      this.setAlpha(0.45);
      this.scaleTween(1);
    }
    this.redraw();
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  destroy(fromScene?: boolean): void {
    if (this.debugId !== null) unregisterSceneObject(this.debugId);
    super.destroy(fromScene);
  }

  private handleOver(): void {
    if (!this.enabled) return;
    this.hovered = true;
    this.redraw();
    this.scaleTween(SCALE_HOVER);
  }

  private handleOut(): void {
    this.hovered = false;
    this.pressed = false;
    this.redraw();
    this.scaleTween(1);
  }

  private handleDown(): void {
    if (!this.enabled) return;
    this.pressed = true;
    this.redraw();
    this.scaleTween(SCALE_PRESS);
  }

  private handleUp(): void {
    const wasPressed = this.pressed;
    this.pressed = false;
    this.redraw();
    this.scaleTween(this.hovered ? SCALE_HOVER : 1);
    if (wasPressed && this.enabled) this.onClick?.();
  }

  private handleReleaseOnly(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.redraw();
    this.scaleTween(this.hovered ? SCALE_HOVER : 1);
  }

  private scaleTween(to: number): void {
    this.scene?.tweens.add({
      targets: this,
      scale: to,
      duration: SCALE_DURATION,
      ease: 'Sine.easeOut',
    });
  }

  private colors(): VariantStyle {
    const styles = VARIANTS[this.variant];
    return this.hovered || this.pressed ? styles.hover : styles.normal;
  }

  private redraw(): void {
    const { fill, stroke, text } = this.colors();
    const { width, height } = this;
    const g = this.bg;
    g.clear();
    if (fill !== null)
      g.fillStyle(fill, 1).fillRoundedRect(-width / 2, -height / 2, width, height, RADIUS.button);
    if (stroke !== null) {
      g.lineStyle(1, stroke, 1).strokeRoundedRect(
        -width / 2 + 0.5,
        -height / 2 + 0.5,
        width - 1,
        height - 1,
        RADIUS.button,
      );
    }
    if (this.pressed) {
      g.fillStyle(0x000000, 0.15).fillRoundedRect(
        -width / 2,
        -height / 2,
        width,
        height,
        RADIUS.button,
      );
    }
    this.label.setColor(text);
  }
}
