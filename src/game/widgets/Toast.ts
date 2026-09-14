import Phaser from 'phaser';
import { useGameStore } from '../../store/game-store';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';

/**
 * Queue-based announcement toasts, the visual-layer replacement for the old
 * ARIA LiveAnnouncer: every store action publishes an announcement, and each
 * new announcement id pops a dark rounded toast that slides up, holds, and
 * fades out. Newest toast sits at the bottom of a centered column in the dead
 * strip between the HUD and the control row; at most 3 are visible (oldest
 * dropped).
 *
 * E2E safety: toasts are purely visual — they are never interactive, so Phaser
 * input passes straight through them to the UI underneath, and they
 * auto-dismiss after ~2.7s. The column sits in the dead strip between the HUD
 * (y ≤ 70) and the control row (y 126+), so it never overlaps the room grid,
 * action panel, or any hit area at rest.
 */

const DEPTH = 900;
const CENTER_X = 640;
/** Bottom edge of the newest toast — just above the control row (y 150). */
const BOTTOM_Y = 140;
const MAX_WIDTH = 700;
const MAX_TOASTS = 3;
const STACK_GAP = 8;
const SLIDE_IN_MS = 200;
const HOLD_MS = 2200;
const FADE_OUT_MS = 300;
const RELAYOUT_MS = 150;

interface ToastEntry {
  container: Phaser.GameObjects.Container;
  height: number;
}

export class ToastCenter {
  private readonly scene: Phaser.Scene;
  private entries: ToastEntry[] = [];
  private lastId: number | null = null;
  private unsubscribe: () => void = () => {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.unsubscribe = useGameStore.subscribe((state) => {
      const announcement = state.announcement;
      if (announcement === null || announcement.id === this.lastId) return;
      this.lastId = announcement.id;
      this.push(announcement.message);
    });
    this.sync();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Show any announcement that fired before construction (idempotent). */
  sync(): void {
    const announcement = useGameStore.getState().announcement;
    if (announcement === null || announcement.id === this.lastId) return;
    this.lastId = announcement.id;
    this.push(announcement.message);
  }

  /** Unsubscribe and drop every live toast. Idempotent; safe on shutdown. */
  destroy(): void {
    this.unsubscribe();
    this.unsubscribe = () => {};
    for (const entry of [...this.entries]) {
      this.scene.tweens.killTweensOf(entry.container);
      entry.container.destroy();
    }
    this.entries = [];
  }

  private push(message: string): void {
    const scene = this.scene;
    const padX = SPACING.lg;
    const padY = SPACING.sm + 2;
    const text = scene.add
      .text(0, 0, message, {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.small + 1}px`,
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: MAX_WIDTH - padX * 2, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const width = Math.min(MAX_WIDTH, text.width + padX * 2);
    const height = text.height + padY * 2;

    const bg = scene.add.graphics();
    bg
      .fillStyle(rgb(COLORS.bgDeep), 0.95)
      .fillRoundedRect(-width / 2, -height / 2, width, height, RADIUS.button);
    bg
      .lineStyle(1, rgb(COLORS.gold), 0.55)
      .strokeRoundedRect(-width / 2 + 0.5, -height / 2 + 0.5, width - 1, height - 1, RADIUS.button);

    const container = scene.add.container(CENTER_X, 0, [bg, text]).setDepth(DEPTH).setAlpha(0);
    const entry: ToastEntry = { container, height };
    this.entries.push(entry);

    // Cap the visible column: drop the oldest without ceremony.
    while (this.entries.length > MAX_TOASTS) {
      const oldest = this.entries[0];
      if (oldest === undefined) break;
      this.drop(oldest);
    }

    this.layout(false);
    const targetY = container.y;
    container.y = targetY + 16;
    scene.tweens.add({
      targets: container,
      y: targetY,
      alpha: 1,
      duration: SLIDE_IN_MS,
      ease: 'Sine.easeOut',
    });
    scene.tweens.add({
      targets: container,
      alpha: 0,
      delay: SLIDE_IN_MS + HOLD_MS,
      duration: FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.drop(entry);
        this.layout(true);
      },
    });
  }

  /** Remove a toast and destroy it (tweens killed so no late callbacks). */
  private drop(entry: ToastEntry): void {
    const index = this.entries.indexOf(entry);
    if (index === -1) return;
    this.entries.splice(index, 1);
    this.scene.tweens.killTweensOf(entry.container);
    entry.container.destroy();
  }

  /** Bottom-align the column: newest at BOTTOM_Y, older stacked above it. */
  private layout(animate: boolean): void {
    let bottomEdge = BOTTOM_Y;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry === undefined) continue;
      const y = bottomEdge - entry.height / 2;
      if (animate) {
        this.scene.tweens.add({ targets: entry.container, y, duration: RELAYOUT_MS, ease: 'Sine.easeOut' });
      } else {
        entry.container.setPosition(CENTER_X, y);
      }
      bottomEdge -= entry.height + STACK_GAP;
    }
  }
}
