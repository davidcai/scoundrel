import Phaser from 'phaser';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';
import { Button } from './Button';

/**
 * Modal confirm dialog ported from the old `.confirm-overlay` / `.confirm-card`
 * CSS: dimmed full-screen scrim, centered panel with title + body, and
 * Cancel/confirm actions. Escape closes (while the dialog exists); clicking
 * the scrim acts as cancel, matching the old overlay's click-to-dismiss.
 */

export interface DialogOptions {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Stable ids for the debug registry / e2e tooling. */
  cancelDebugId?: string;
  confirmDebugId?: string;
}

const WIDTH = 460;
const HEIGHT = 250;
const DEPTH = 200;
/** COLORS.overlay (`rgba(3, 5, 9, 0.82)`) as Phaser fill arguments. */
const SCRIM = { color: 0x030509, alpha: 0.82 };

export class Dialog extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, opts: DialogOptions) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(DEPTH);

    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;

    const scrim = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, SCRIM.color, SCRIM.alpha)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => opts.onCancel());

    // Swallow clicks on the panel body so they don't fall through to the scrim.
    const blocker = scene.add
      .rectangle(cx - WIDTH / 2, cy - HEIGHT / 2, WIDTH, HEIGHT, SCRIM.color, 0.001)
      .setOrigin(0, 0)
      .setInteractive();

    const panel = scene.add.graphics();
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(cx - WIDTH / 2, cy - HEIGHT / 2, WIDTH, HEIGHT, RADIUS.panel);
    panel
      .lineStyle(1, rgb(COLORS.gold), 1)
      .strokeRoundedRect(
        cx - WIDTH / 2 + 0.5,
        cy - HEIGHT / 2 + 0.5,
        WIDTH - 1,
        HEIGHT - 1,
        RADIUS.panel,
      );

    const title = scene.add
      .text(cx, cy - HEIGHT / 2 + 44, opts.title, {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.h1}px`,
        color: COLORS.text,
      })
      .setOrigin(0.5);

    const body = scene.add
      .text(cx, cy - 16, opts.body, {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.value}px`,
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: WIDTH - SPACING.xl * 3, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const cancelButton = new Button(scene, cx - 110, cy + HEIGHT / 2 - 52, opts.cancelLabel, {
      variant: 'default',
      width: 180,
      height: 48,
      onClick: opts.onCancel,
      debugId: opts.cancelDebugId,
    });
    const confirmButton = new Button(scene, cx + 110, cy + HEIGHT / 2 - 52, opts.confirmLabel, {
      variant: 'danger',
      width: 180,
      height: 48,
      onClick: opts.onConfirm,
      debugId: opts.confirmDebugId,
    });

    this.add([scrim, blocker, panel, title, body, cancelButton, confirmButton]);

    // Escape closes the dialog. The listener lives exactly as long as the
    // dialog does, so it is inherently guarded to the open dialog.
    const onEscape = (): void => opts.onCancel();
    scene.input.keyboard?.on('keydown-ESC', onEscape);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.keyboard?.off('keydown-ESC', onEscape);
    });
  }
}
