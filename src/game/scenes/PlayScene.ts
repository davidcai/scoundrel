import Phaser from 'phaser';
import {
  canEnterNextRoom,
  canUndo,
  finalScore,
  isFinalRoom,
  runAwayStatus,
  type CardId,
  type GameState,
} from '../../engine';
import { cardHint, t, useLanguage } from '../../i18n';
import { useGameStore } from '../../store/game-store';
import { decodeConfig } from '../../store/share';
import { navigate, parseHash } from '../router';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';
import { roomProgressKey } from '../view-models/action-panel';
import { Button } from '../widgets/Button';
import { CardSprite } from '../widgets/CardSprite';
import { Dialog } from '../widgets/Dialog';
import { attachTooltip } from '../widgets/Tooltip';
import { installRouter } from './route-map';

/**
 * Play scene, ported from the old React PlayScreen + Hud: HUD strip (health
 * bar, dungeon count, abandon), room control row, room card grid with
 * selection/carried state, seeded-replay URL sync, and the empty / game-over
 * fallback panels. Reacts to store changes via a zustand subscription and to
 * language changes via a full UI rebuild.
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

// HUD strip.
const HUD_LABEL_Y = 26;
const HUD_VALUE_Y = 52;
const HP_X = 40;
const HP_Y = 44;
const HP_WIDTH = 240;
const HP_HEIGHT = 16;
const DUNGEON_X = 930;

// Control row (under the HUD).
const CONTROL_Y = 150;
const BANNER_Y = 205;

// Room grid.
const ROOM_Y = 380;
const ROOM_SPACING = 200;
const HINT_Y = 524;

// Seed note.
const SEED_X = 24;
const SEED_Y = 706;

type SceneMode = 'none' | 'playing' | 'over';

interface LabelStyle {
  fontFamily: string;
  fontSize: string;
  color: string;
}

const LABEL_STYLE: LabelStyle = {
  fontFamily: FONT.family,
  fontSize: `${FONT.size.label + 1}px`,
  color: COLORS.muted,
};

const VALUE_STYLE: LabelStyle = {
  fontFamily: FONT.family,
  fontSize: `${FONT.size.value}px`,
  color: COLORS.text,
};

export class PlayScene extends Phaser.Scene {
  private storeUnsubscribe: (() => void) | null = null;
  private langUnsubscribe: (() => void) | null = null;
  private dialog: Dialog | null = null;

  private playLayer!: Phaser.GameObjects.Container;
  private stateLayer!: Phaser.GameObjects.Container;

  // HUD references (rebuilt wholesale on language change).
  private hpFill!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private dungeonText!: Phaser.GameObjects.Text;
  private undoButton!: Button;
  private runAwayButton!: Button;
  private enterButton!: Button;
  private finalBanner!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private seedLabel!: Phaser.GameObjects.Text;
  private seedValue!: Phaser.GameObjects.Text;

  private roomLayer!: Phaser.GameObjects.Container;
  private roomSprites = new Map<CardId, CardSprite>();
  private roomComposition: string | null = null;
  private lastMode: SceneMode | null = null;

  constructor() {
    super('PlayScene');
  }

  create(): void {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg))
      .setOrigin(0, 0);

    this.playLayer = this.add.container(0, 0);
    this.stateLayer = this.add.container(0, 0);

    installRouter(this, '/play');

    // Seeded-replay sync + hydration, then the first render pass.
    this.syncSeededStart();
    this.buildPlayUi();
    this.syncFromStore();

    this.storeUnsubscribe = useGameStore.subscribe(() => this.syncFromStore());
    this.langUnsubscribe = useLanguage.subscribe(() => this.rebuildAll());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.storeUnsubscribe?.();
      this.storeUnsubscribe = null;
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
      this.closeDialog();
    });
  }

  // ── Seeded-replay sync ──────────────────────────────────────────────────

  /**
   * `#/play?seed=...&config=...` deterministically restarts that run: when the
   * URL carries a seed and the store's run doesn't match it, start a fresh
   * run. Without a seed, hydrate the persisted run (once per page load).
   */
  private syncSeededStart(): void {
    const params = parseHash(window.location.hash).params;
    const seedParam = params.get('seed');
    const store = useGameStore.getState();

    if (seedParam === null || seedParam.trim() === '') {
      if (store.game === null) store.hydrate();
      return;
    }

    const seed = seedParam.trim().toLowerCase();
    const config = decodeConfig(params.get('config'));
    const game = store.game;
    const sameRun =
      game !== null &&
      game.seed === seed &&
      game.config.runAwayMode === config.runAwayMode &&
      game.config.potionsPerRoom === config.potionsPerRoom &&
      game.config.weaponDegradation === config.weaponDegradation;
    if (!sameRun) store.startRun(seed, config);
  }

  // ── UI construction ─────────────────────────────────────────────────────

  /** (Re)build every play-screen widget. Called on create and language change. */
  private buildPlayUi(): void {
    this.playLayer.removeAll(true);
    this.roomSprites.clear();
    this.roomComposition = null;

    // HUD — health group (left).
    this.playLayer.add(
      this.add
        .text(HP_X, HUD_LABEL_Y, t('health'), LABEL_STYLE)
        .setOrigin(0, 0.5)
        .setName('hud-health-label'),
    );
    const track = this.add.graphics();
    track
      .fillStyle(rgb(COLORS.successDark), 1)
      .fillRoundedRect(HP_X, HP_Y, HP_WIDTH, HP_HEIGHT, HP_HEIGHT / 2);
    this.playLayer.add(track);
    this.hpFill = this.add.graphics();
    this.playLayer.add(this.hpFill);
    this.hpText = this.add
      .text(HP_X + HP_WIDTH + SPACING.md, HP_Y + HP_HEIGHT / 2, '', {
        fontFamily: FONT.mono,
        fontSize: `${FONT.size.value}px`,
        color: COLORS.text,
      })
      .setOrigin(0, 0.5);
    this.playLayer.add(this.hpText);

    // HUD — dungeon group + abandon (right).
    this.playLayer.add(
      this.add
        .text(DUNGEON_X, HUD_LABEL_Y, t('dungeon'), LABEL_STYLE)
        .setOrigin(0, 0.5),
    );
    this.dungeonText = this.add
      .text(DUNGEON_X, HUD_VALUE_Y, '', VALUE_STYLE)
      .setOrigin(0, 0.5);
    this.playLayer.add(this.dungeonText);

    const abandonButton = new Button(this, 1170, HUD_VALUE_Y, t('abandonRun'), {
      variant: 'danger',
      width: 140,
      height: 42,
      onClick: () => this.openAbandonDialog(),
      debugId: 'btn-abandon',
    });
    attachTooltip(this, abandonButton, () => t('tooltipAbandon'));
    this.playLayer.add(abandonButton);

    // Control row.
    this.undoButton = new Button(this, 350, CONTROL_Y, t('undoToRoomStart'), {
      width: 200,
      height: 48,
      onClick: () => useGameStore.getState().act({ type: 'UndoToRoomStart' }),
      debugId: 'btn-undo',
    });
    attachTooltip(this, this.undoButton, () => t('tooltipUndo'));
    this.playLayer.add(this.undoButton);

    this.runAwayButton = new Button(this, 620, CONTROL_Y, t('runAway'), {
      width: 180,
      height: 48,
      onClick: () => useGameStore.getState().act({ type: 'RunAway' }),
      debugId: 'btn-run-away',
    });
    attachTooltip(this, this.runAwayButton, () => this.runAwayTooltipText());
    this.playLayer.add(this.runAwayButton);

    this.enterButton = new Button(this, 900, CONTROL_Y, t('enterNextRoom'), {
      variant: 'primary',
      width: 280,
      height: 48,
      onClick: () => useGameStore.getState().act({ type: 'EnterNextRoom' }),
      debugId: 'btn-enter-next-room',
    });
    attachTooltip(this, this.enterButton, () => t('tooltipCarry'));
    this.playLayer.add(this.enterButton);

    // Final-room banner (hidden unless the room is final).
    this.finalBanner = this.add
      .text(
        GAME_WIDTH / 2,
        BANNER_Y,
        `${t('finalBannerStart')} ${t('finalBannerEvery')} ${t('finalBannerEnd')}`,
        {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.h2}px`,
          color: COLORS.gold,
          align: 'center',
          wordWrap: { width: 900, useAdvancedWrap: true },
        },
      )
      .setOrigin(0.5)
      .setVisible(false)
      .setName('final-banner');
    this.playLayer.add(this.finalBanner);

    // Room grid + progress hint.
    this.roomLayer = this.add.container(0, 0);
    this.playLayer.add(this.roomLayer);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, HINT_Y, '', {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.small}px`,
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    this.playLayer.add(this.hintText);

    // Seed note (bottom-left).
    this.seedLabel = this.add
      .text(SEED_X, SEED_Y, `${t('seed')}:`, {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.small}px`,
        color: COLORS.muted,
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    this.seedValue = this.add
      .text(SEED_X + this.seedLabel.width + SPACING.sm, SEED_Y, '', {
        fontFamily: FONT.mono,
        fontSize: `${FONT.size.small}px`,
        color: COLORS.text,
      })
      .setOrigin(0, 1);
    this.playLayer.add([this.seedLabel, this.seedValue]);
    attachTooltip(this, this.seedLabel, () => t('tooltipSeed'));
  }

  private rebuildAll(): void {
    this.closeDialog();
    this.buildPlayUi();
    this.buildStatePanel(this.lastMode ?? 'none');
    this.syncFromStore();
  }

  // ── Store-driven rendering ──────────────────────────────────────────────

  /**
   * Diff the store against what is on screen. The room sprite layer is rebuilt
   * only when the room composition changes; everything else (hp bar, counts,
   * button states, rings, carried badge) updates in place.
   */
  private syncFromStore(): void {
    const { game, selectedCardId } = useGameStore.getState();
    const mode: SceneMode =
      game === null ? 'none' : game.phase === 'playing' ? 'playing' : 'over';

    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.playLayer.setVisible(mode === 'playing');
      this.buildStatePanel(mode);
    }
    if (mode !== 'playing' || game === null) return;

    // Carry-over re-validation: the selection is only meaningful while the
    // card is still part of the current room (old PlayScreen logic).
    const selected =
      selectedCardId !== null && game.room.includes(selectedCardId) ? selectedCardId : null;

    // HP bar.
    const pct = Math.max(0, Math.min(1, game.hp / game.maxHp));
    this.redrawHpFill(pct);
    this.hpText.setText(`${game.hp}/${game.maxHp}`);

    // Dungeon count.
    this.dungeonText.setText(t('cardsLeft', { count: game.dungeon.length }));

    // Control row.
    const final = isFinalRoom(game);
    this.undoButton.setEnabled(canUndo(game));
    this.runAwayButton.setEnabled(runAwayStatus(game).legal);
    this.enterButton.setVisible(!final);
    this.enterButton.setEnabled(canEnterNextRoom(game));
    this.finalBanner.setVisible(final);

    // Room-progress hint.
    this.hintText.setText(t(roomProgressKey(game)));

    // Room sprites: rebuild on composition change, update in place otherwise.
    const composition = game.room.join('|');
    if (composition !== this.roomComposition) this.rebuildRoom(game);
    for (const [cardId, sprite] of this.roomSprites) {
      sprite.setSelected(selected === cardId);
      sprite.setCarried(game.carriedCardId === cardId);
    }
  }

  /** Run-away tooltip text depends on the live block reason (old Hud/PlayScreen logic). */
  private runAwayTooltipText(): string {
    const game = useGameStore.getState().game;
    if (game === null) return t('tooltipRunEngaged');
    const status = runAwayStatus(game);
    if (status.legal) return t('tooltipRunLegal');
    switch (status.reason) {
      case 'twice-in-a-row':
        return t('tooltipRunTwice');
      case 'final-room':
        return t('tooltipRunFinal');
      default:
        return t('tooltipRunEngaged');
    }
  }

  private redrawHpFill(pct: number): void {
    const innerWidth = Math.round((HP_WIDTH - 4) * pct);
    const g = this.hpFill;
    g.clear();
    if (innerWidth <= 0) return;
    g.fillStyle(rgb(COLORS.success), 1).fillRoundedRect(
      HP_X + 2,
      HP_Y + 2,
      innerWidth,
      HP_HEIGHT - 4,
      Math.min((HP_HEIGHT - 4) / 2, innerWidth / 2),
    );
  }

  private rebuildRoom(game: GameState): void {
    this.roomLayer.removeAll(true);
    this.roomSprites.clear();
    this.roomComposition = game.room.join('|');

    const count = game.room.length;
    game.room.forEach((cardId, index) => {
      const x = GAME_WIDTH / 2 + (index - (count - 1) / 2) * ROOM_SPACING;
      const sprite = new CardSprite(this, x, ROOM_Y, cardId, {
        onClick: () => {
          const store = useGameStore.getState();
          store.selectCard(store.selectedCardId === cardId ? null : cardId);
        },
      });
      attachTooltip(this, sprite, () => cardHint(cardId));
      this.roomLayer.add(sprite);
      this.roomSprites.set(cardId, sprite);
    });
  }

  // ── Empty state / game over ─────────────────────────────────────────────

  /** Centered panel for "no run in progress" and the game-over outcome. */
  private buildStatePanel(mode: SceneMode): void {
    this.stateLayer.removeAll(true);
    if (mode === 'playing') return;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const width = 560;
    const height = 300;

    const scrim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg))
      .setOrigin(0, 0);
    const panel = this.add.graphics();
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(cx - width / 2, cy - height / 2, width, height, RADIUS.panel);
    panel
      .lineStyle(1, rgb(COLORS.border), 1)
      .strokeRoundedRect(
        cx - width / 2 + 0.5,
        cy - height / 2 + 0.5,
        width - 1,
        height - 1,
        RADIUS.panel,
      );
    this.stateLayer.add([scrim, panel]);

    if (mode === 'none') {
      const title = this.add
        .text(cx, cy - 60, t('noRunTitle'), {
          fontFamily: FONT.display,
          fontSize: `${FONT.size.h1}px`,
          color: COLORS.gold,
        })
        .setOrigin(0.5);
      const hint = this.add
        .text(cx, cy - 8, t('noRunHint'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.value}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: width - SPACING.xl * 3, useAdvancedWrap: true },
        })
        .setOrigin(0.5);
      const button = new Button(this, cx, cy + 66, t('backToTitle'), {
        variant: 'primary',
        width: 240,
        height: 48,
        onClick: () => navigate('#/'),
        debugId: 'btn-back-title',
      });
      this.stateLayer.add([title, hint, button]);
      return;
    }

    // Game over: minimal outcome scorecard (full version comes in a later stage).
    const game = useGameStore.getState().game;
    if (game === null) return;
    const won = game.phase === 'won';
    const title = this.add
      .text(cx, cy - 80, won ? t('victory') : t('defeat'), {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.h1 + 8}px`,
        color: won ? COLORS.gold : COLORS.danger,
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(cx, cy - 30, won ? t('victorySub') : t('defeatSub'), {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.value}px`,
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: width - SPACING.xl * 3, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const score = this.add
      .text(cx, cy + 18, `${t('score')}: ${finalScore(game)}`, {
        fontFamily: FONT.mono,
        fontSize: `${FONT.size.value + 8}px`,
        color: COLORS.text,
      })
      .setOrigin(0.5);
    const button = new Button(this, cx, cy + 84, t('returnTitle'), {
      variant: 'primary',
      width: 240,
      height: 48,
      onClick: () => {
        useGameStore.getState().finishRun();
        navigate('#/');
      },
      debugId: 'btn-return-title',
    });
    this.stateLayer.add([title, subtitle, score, button]);
  }

  // ── Abandon dialog ──────────────────────────────────────────────────────

  private openAbandonDialog(): void {
    if (this.dialog !== null) return;
    this.dialog = new Dialog(this, {
      title: t('reallyAbandon'),
      body: t('abandonConfirmBody'),
      cancelLabel: t('cancel'),
      confirmLabel: t('abandonRun'),
      onCancel: () => this.closeDialog(),
      onConfirm: () => {
        this.closeDialog();
        useGameStore.getState().abandonRun();
        navigate('#/');
      },
      cancelDebugId: 'btn-cancel-abandon',
      confirmDebugId: 'btn-confirm-abandon',
    });
  }

  private closeDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
  }
}
