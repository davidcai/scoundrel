import Phaser from 'phaser';
import { type CardId, type GameState } from '../engine';
import { queueCardTextures, substituteMissingTextures } from './card-textures';
import type { TableSceneApi } from './scene-api';

/**
 * Static-parity table scene: 4 room cards in a 2×2 grid (carried card gets a
 * badge + warm tint), weapon card at left, kill stack at right (last-killed on
 * top, stepped offsets, NO rotation — that triggers the open #7372 tearing bug
 * and the DOM stack has none either). Room sprites are interactive
 * (`cursor: 'pointer'`); pointerdown toggles `selectCard` in the store —
 * routed through the bridge, which owns the toggle semantics.
 *
 * Phase 1: no tweens — `renderState` is an instant rebuild from authoritative
 * state. Phase 2 will turn the bridge's commands into tweens.
 */

export const SCENE_KEY = 'scoundrel-table';
export const SCENE_READY_EVENT = 'scoundrel:scene-ready';

/** Canvas design resolution: 960×600 (see game.ts rationale). */
export const DESIGN_WIDTH = 960;
export const DESIGN_HEIGHT = 600;

const CARD_W = 120;
const CARD_H = 180; // 2:3 — matches the 1152×1728 artwork aspect

// Kill-stack fan offsets: DOM parity with WeaponStack's KILL_STEP_X/Y (40/16),
// at 85% card scale. Older kills peek left+down; last kill sits on top.
const KILL_STEP_X = 40;
const KILL_STEP_Y = 16;
const KILL_SCALE = 0.85;
const MAX_KILL_STEPS = 5; // guard against fanning into the room zone

const SELECTION_COLOR = 0xfacc15;
const CARRIED_TINT = 0xfff3c4;

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

/** Room slot n (0–3) in row-major order: top-left, top-right, bottom-left, bottom-right. */
function roomSlot(index: number): { x: number; y: number } {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: ROOM_X0 + col * (CARD_W + ROOM_GAP_X) + CARD_W / 2,
    y: ROOM_Y0 + row * (CARD_H + ROOM_GAP_Y) + CARD_H / 2,
  };
}

export class TableScene extends Phaser.Scene implements TableSceneApi {
  private roomSprites = new Map<CardId, Phaser.GameObjects.Sprite>();
  private weaponSprite: Phaser.GameObjects.Sprite | null = null;
  private killSprites: Phaser.GameObjects.Sprite[] = [];
  private glow: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Graphics | null = null;
  private deckText: Phaser.GameObjects.Text | null = null;
  private hpText: Phaser.GameObjects.Text | null = null;
  private hoverCbs = new Set<(cardId: CardId | null) => void>();
  private pointerDownCb: ((cardId: CardId) => void) | null = null;
  private selected: CardId | null = null;
  private carried: CardId | null = null;

  constructor(opts?: { reducedMotion?: boolean }) {
    // `reducedMotion` is carried for Phase 2 tweens; Phase 1 is static.
    void opts?.reducedMotion;
    super(SCENE_KEY);
  }

  preload(): void {
    queueCardTextures(this.load);
  }

  create(): void {
    // Placeholder substitution happens after loading completes: failed/missing
    // card assets get a generated suit-toned texture (CardView parity).
    substituteMissingTextures(this);

    this.glow = this.add.image(0, 0, 'scoundrel-white').setVisible(false);
    this.ring = this.add.graphics().setVisible(false);
    this.deckText = this.add.text(16, 16, '', {
      fontSize: '20px',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    });
    this.hpText = this.add.text(16, DESIGN_HEIGHT - 36, '', {
      fontSize: '20px',
      color: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
    });

    // Readiness marker for the React lane's whenReady()/e2e gate.
    this.events.emit(SCENE_READY_EVENT);
  }

  renderState(state: GameState | null, selectedCardId: CardId | null): void {
    this.clearTable();
    if (state === null) return;
    this.selected =
      selectedCardId !== null && state.room.includes(selectedCardId) ? selectedCardId : null;
    this.carried = state.carriedCardId;

    // Render only cards that exist — the room list is authoritative; stale ids
    // (a selection pointing at a resolved card) are ignored by the filter above.
    state.room.forEach((cardId, index) => {
      const slot = roomSlot(index);
      this.addRoomCard(cardId, slot.x, slot.y);
    });

    if (state.weapon !== null) {
      this.weaponSprite = this.addCardSprite(state.weapon, WEAPON_X, WEAPON_Y);
    }

    this.addKillStack(state.killStack);
    this.deckText?.setText(String(state.dungeon.length));
    this.hpText?.setText(`${state.hp}/${state.maxHp}`);
    this.refreshDecorations();
  }

  setSelection(cardId: CardId | null): void {
    if (this.selected === cardId) return; // idempotent — selection sync relies on it
    this.selected = cardId;
    this.refreshDecorations();
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

  destroy(): void {
    this.hoverCbs.clear();
    this.pointerDownCb = null;
    this.clearTable();
  }

  // --- internals -------------------------------------------------------------

  private clearTable(): void {
    this.roomSprites.forEach((sprite) => sprite.destroy());
    this.roomSprites.clear();
    this.weaponSprite?.destroy();
    this.weaponSprite = null;
    this.killSprites.forEach((sprite) => sprite.destroy());
    this.killSprites = [];
    this.glow?.setVisible(false);
    this.ring?.setVisible(false);
  }

  private addCardSprite(cardId: CardId, x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, cardId);
    sprite.setDisplaySize(CARD_W, CARD_H);
    return sprite;
  }

  private addRoomCard(cardId: CardId, x: number, y: number): void {
    const sprite = this.addCardSprite(cardId, x, y);
    sprite.setInteractive({ cursor: 'pointer' });

    // Carried card: warm multiply tint + gold corner badge (DOM `carried-badge` parity).
    if (this.carried !== null && this.carried === cardId) {
      sprite.setTint(CARRIED_TINT);
      this.add
        .graphics()
        .fillStyle(SELECTION_COLOR, 1)
        .fillCircle(x + CARD_W / 2 - 12, y - CARD_H / 2 + 12, 7)
        .setDepth(25);
    }

    sprite.on('pointerdown', () => this.pointerDownCb?.(cardId));
    sprite.on('pointerover', () => this.hoverCbs.forEach((cb) => cb(cardId)));
    sprite.on('pointerout', () => this.hoverCbs.forEach((cb) => cb(null)));
    this.roomSprites.set(cardId, sprite);
  }

  private addKillStack(killStack: readonly CardId[]): void {
    killStack.forEach((cardId) => {
      // Older kills fan left+down (DOM parity); the newest sits at the anchor, on top.
      const spriteIndex = this.killSprites.length;
      const olderIndex = killStack.length - 1 - spriteIndex;
      const step = Math.min(olderIndex, MAX_KILL_STEPS);
      const width = CARD_W * KILL_SCALE;
      const x = KILL_RIGHT - width / 2 - step * KILL_STEP_X;
      const y = KILL_Y0 + (CARD_H * KILL_SCALE) / 2 + step * KILL_STEP_Y;
      const sprite = this.addCardSprite(cardId, x, y);
      sprite.setDisplaySize(width, CARD_H * KILL_SCALE);
      sprite.setDepth(5 - step); // last kill on top, older kills behind
      sprite.setInteractive({ cursor: 'pointer' });
      sprite.on('pointerover', () => this.hoverCbs.forEach((cb) => cb(cardId)));
      sprite.on('pointerout', () => this.hoverCbs.forEach((cb) => cb(null)));
      this.killSprites.push(sprite);
    });
  }

  private refreshDecorations(): void {
    const target = this.selected !== null ? this.roomSprites.get(this.selected) : undefined;
    if (this.glow === null || this.ring === null || target === undefined) {
      this.glow?.setVisible(false);
      this.ring?.setVisible(false);
      return;
    }
    // Selection: fill-tinted glow pad behind the card (v4 API — `setTintFill` was
    // removed in v4, use setTint + setTintMode(FILL)) + gold stroke ring on top,
    // matching the DOM `.selected-ring` indicator.
    this.glow
      .setPosition(target.x, target.y)
      .setDisplaySize(CARD_W + 14, CARD_H + 14)
      .setTint(SELECTION_COLOR)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.28)
      .setDepth(target.depth - 1)
      .setVisible(true);
    this.ring
      .clear()
      .lineStyle(3, SELECTION_COLOR, 1)
      .strokeRect(target.x - CARD_W / 2 - 5, target.y - CARD_H / 2 - 5, CARD_W + 10, CARD_H + 10)
      .setDepth(30)
      .setVisible(true);
  }
}
