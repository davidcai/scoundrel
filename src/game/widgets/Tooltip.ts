import Phaser from 'phaser';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';

/**
 * Hover tooltip: small dark rounded panel that appears near the pointer after
 * a short delay and follows it, flipping near the screen edges. Rides above
 * everything (depth 1000).
 */

const DEPTH = 1000;
const MARGIN = 14;
const SHOW_DELAY_MS = 350;

export function attachTooltip(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  getText: () => string,
): void {
  const panel = scene.add.container(0, 0).setVisible(false).setDepth(DEPTH);
  const bg = scene.add.graphics();
  const text = scene.add
    .text(0, 0, '', {
      fontFamily: FONT.family,
      fontSize: `${FONT.size.small}px`,
      color: COLORS.text,
      wordWrap: { width: 380, useAdvancedWrap: true },
    })
    .setOrigin(0, 0);
  panel.add([bg, text]);

  let showTimer: Phaser.Time.TimerEvent | null = null;

  const cancelShow = (): void => {
    if (showTimer !== null) {
      showTimer.remove(false);
      showTimer = null;
    }
  };

  const reposition = (): void => {
    const pointer = scene.input.activePointer;
    const view = scene.scale.gameSize;
    const x = pointer.worldX;
    const y = pointer.worldY;
    let px = x + MARGIN;
    let py = y + MARGIN;
    if (px + panel.width > view.width) px = x - panel.width - MARGIN;
    if (py + panel.height > view.height) py = y - panel.height - MARGIN;
    panel.setPosition(Math.max(0, px), Math.max(0, py));
  };

  const show = (): void => {
    const content = getText();
    if (content === '') return;
    text.setText(content);
    const padX = SPACING.md;
    const padY = SPACING.sm;
    const width = text.width + padX * 2;
    const height = text.height + padY * 2;
    bg.clear();
    bg.fillStyle(rgb(COLORS.bgDeep), 0.95).fillRoundedRect(0, 0, width, height, RADIUS.button);
    bg.lineStyle(1, rgb(COLORS.border), 1).strokeRoundedRect(
      0.5,
      0.5,
      width - 1,
      height - 1,
      RADIUS.button,
    );
    panel.setSize(width, height);
    reposition();
    panel.setVisible(true);
  };

  const scheduleShow = (): void => {
    cancelShow();
    showTimer = scene.time.delayedCall(SHOW_DELAY_MS, () => {
      showTimer = null;
      show();
    });
  };

  const hide = (): void => {
    cancelShow();
    panel.setVisible(false);
  };

  const followPointer = (): void => {
    if (panel.visible) reposition();
  };

  target.on('pointerover', scheduleShow);
  target.on('pointermove', followPointer);
  target.on('pointerout', hide);

  // The tooltip panel itself must never eat input events.
  panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, 0, 0), () => false);

  const dispose = (): void => {
    cancelShow();
    panel.destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  target.once(Phaser.GameObjects.Events.DESTROY, dispose);
}
