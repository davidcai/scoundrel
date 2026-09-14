import Phaser from 'phaser';
import { randomSeed } from '../../engine';
import { t, useLanguage } from '../../i18n';
import { useGameStore } from '../../store/game-store';
import { loadSettings } from '../../store/settings';
import { navigate } from '../router';
import { COLORS, FONT, RADIUS, rgb } from '../theme';
import { Button } from '../widgets/Button';
import { installRouter } from './route-map';

/**
 * Title screen, ported from the old React TitleScreen: word mark, tagline,
 * and a centered menu (Continue / New Run / Enter Seed / Stats / Settings /
 * About). Labels rebuild on language change while the scene is active.
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const TITLE_Y = 148;
const TAGLINE_Y = 216;
const MENU_CENTER_Y = 470;
const MENU_GAP = 14;
const MENU_WIDTH = 320;
const MENU_HEIGHT = 56;
const SEED_PANEL_WIDTH = 480;
const SEED_PANEL_HEIGHT = 210;

/** COLORS.overlay (`rgba(3, 5, 9, 0.82)`) as Phaser fill arguments. */
const OVERLAY = { color: 0x030509, alpha: 0.82 };

export class TitleScene extends Phaser.Scene {
  private root: Phaser.GameObjects.Container | null = null;
  private langUnsubscribe: (() => void) | null = null;

  // Seed-entry overlay state (destroyed together on close / shutdown).
  private seedPanelObjects: Phaser.GameObjects.GameObject[] = [];
  private seedInput: HTMLInputElement | null = null;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg)).setOrigin(0, 0);

    this.root = this.add.container(0, 0);
    this.buildUi();
    this.playEntrance();

    installRouter(this, '/');

    // Re-render all labels when the player switches language mid-scene.
    this.langUnsubscribe = useLanguage.subscribe(() => this.rebuildUi());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
      this.closeSeedPanel();
    });
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  private buildUi(): void {
    if (this.root === null) return;

    const title = this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Scoundrel', {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.title}px`,
        color: COLORS.gold,
      })
      .setOrigin(0.5)
      .setName('title-word');
    const tagline = this.add
      .text(GAME_WIDTH / 2, TAGLINE_Y, t('tagline'), {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.h2}px`,
        color: COLORS.muted,
      })
      .setOrigin(0.5)
      .setName('tagline');
    this.root.add([title, tagline]);

    const game = useGameStore.getState().game;
    const canContinue = game !== null && game.phase === 'playing';

    interface MenuItem {
      text: () => string;
      variant: 'primary' | 'default';
      onClick: () => void;
      debugId: string;
    }
    const items: MenuItem[] = [];
    if (canContinue && game !== null) {
      items.push({
        text: () => t('continueRun', { seed: game.seed }),
        variant: 'primary',
        onClick: () => navigate('#/play'),
        debugId: 'btn-continue',
      });
    }
    items.push(
      {
        text: () => t('newRun'),
        variant: 'primary',
        onClick: () => this.newRun(),
        debugId: 'btn-new-run',
      },
      {
        text: () => t('enterSeed'),
        variant: 'default',
        onClick: () => this.toggleSeedPanel(),
        debugId: 'btn-enter-seed',
      },
      {
        text: () => t('stats'),
        variant: 'default',
        onClick: () => navigate('#/stats'),
        debugId: 'btn-stats',
      },
      {
        text: () => t('settings'),
        variant: 'default',
        onClick: () => navigate('#/settings'),
        debugId: 'btn-settings',
      },
      {
        text: () => t('about'),
        variant: 'default',
        onClick: () => navigate('#/about'),
        debugId: 'btn-about',
      },
    );

    const total = items.length * MENU_HEIGHT + (items.length - 1) * MENU_GAP;
    let y = MENU_CENTER_Y - total / 2 + MENU_HEIGHT / 2;
    for (const item of items) {
      this.root.add(
        new Button(this, GAME_WIDTH / 2, y, item.text(), {
          variant: item.variant,
          width: MENU_WIDTH,
          height: MENU_HEIGHT,
          onClick: item.onClick,
          debugId: item.debugId,
        }),
      );
      y += MENU_HEIGHT + MENU_GAP;
    }
  }

  private playEntrance(): void {
    if (this.root === null) return;
    const title = this.root.getByName('title-word') as Phaser.GameObjects.Text | null;
    if (title === null) return;
    title.setAlpha(0);
    title.y = TITLE_Y - 24;
    this.tweens.add({ targets: title, alpha: 1, y: TITLE_Y, duration: 550, ease: 'Sine.easeOut' });
  }

  private rebuildUi(): void {
    this.closeSeedPanel();
    this.root?.removeAll(true);
    this.buildUi();
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private newRun(): void {
    useGameStore.getState().startRun(randomSeed(), loadSettings().config);
    navigate('#/play');
  }

  private startSeeded(): void {
    const seed = this.seedInput?.value.trim() ?? '';
    if (seed === '') return;
    this.closeSeedPanel();
    useGameStore.getState().startRun(seed, loadSettings().config);
    navigate('#/play');
  }

  // ── Seed entry panel ────────────────────────────────────────────────────

  private toggleSeedPanel(): void {
    if (this.seedInput !== null) this.closeSeedPanel();
    else this.openSeedPanel();
  }

  private openSeedPanel(): void {
    if (this.seedInput !== null || this.root === null) return;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 10;

    // The input is a DOM element positioned over the canvas — same page
    // mapping as the debug handle's worldToScreen (canvas rect + game size;
    // Scale.FIT letterboxing preserves aspect so both axes share one factor,
    // but each axis is mapped independently here anyway).
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = rect.width / this.scale.gameSize.width;
    const scaleY = rect.height / this.scale.gameSize.height;

    const input = document.createElement('input');
    input.id = 'seed-input';
    input.type = 'text';
    input.placeholder = t('seedPlaceholder');
    input.style.cssText = [
      'position: absolute',
      'z-index: 20',
      `left: ${rect.left + (cx - 120) * scaleX}px`,
      `top: ${rect.top + (cy - 16) * scaleY}px`,
      `width: ${Math.round(240 * scaleX)}px`,
      'padding: 8px 10px',
      `background: ${COLORS.bgDeep}`,
      `border: 1px solid ${COLORS.gold}`,
      `border-radius: ${RADIUS.button}px`,
      `color: ${COLORS.text}`,
      `font-family: ${FONT.mono}`,
      'font-size: 16px',
      'outline: none',
    ].join(';');
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.startSeeded();
      } else if (event.key === 'Escape') {
        this.closeSeedPanel();
      }
    });
    document.body.appendChild(input);
    input.focus();
    this.seedInput = input;

    const scrim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, OVERLAY.color, OVERLAY.alpha)
      .setOrigin(0, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeSeedPanel());

    const panel = this.add.graphics().setDepth(51);
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(
        cx - SEED_PANEL_WIDTH / 2,
        cy - SEED_PANEL_HEIGHT / 2,
        SEED_PANEL_WIDTH,
        SEED_PANEL_HEIGHT,
        RADIUS.panel,
      );
    panel
      .lineStyle(1, rgb(COLORS.gold), 1)
      .strokeRoundedRect(
        cx - SEED_PANEL_WIDTH / 2 + 0.5,
        cy - SEED_PANEL_HEIGHT / 2 + 0.5,
        SEED_PANEL_WIDTH - 1,
        SEED_PANEL_HEIGHT - 1,
        RADIUS.panel,
      );

    const heading = this.add
      .text(cx, cy - SEED_PANEL_HEIGHT / 2 + 36, t('seedFromFriend'), {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.label + 2}px`,
        color: COLORS.muted,
      })
      .setOrigin(0.5)
      .setDepth(51);

    const playButton = new Button(this, cx - 110, cy + SEED_PANEL_HEIGHT / 2 - 54, t('playSeed'), {
      variant: 'primary',
      width: 200,
      height: 44,
      onClick: () => this.startSeeded(),
      debugId: 'btn-play-seed',
    }).setDepth(51);
    const cancelButton = new Button(this, cx + 110, cy + SEED_PANEL_HEIGHT / 2 - 54, t('cancel'), {
      variant: 'ghost',
      width: 160,
      height: 44,
      onClick: () => this.closeSeedPanel(),
      debugId: 'btn-cancel-seed',
    }).setDepth(51);

    this.seedPanelObjects = [scrim, panel, heading, playButton, cancelButton];
  }

  private closeSeedPanel(): void {
    this.seedInput?.remove();
    this.seedInput = null;
    for (const object of this.seedPanelObjects) object.destroy();
    this.seedPanelObjects = [];
  }
}
