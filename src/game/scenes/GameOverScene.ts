import Phaser from 'phaser';
import { finalScore, randomSeed, type GameState } from '../../engine';
import { t, useLanguage } from '../../i18n';
import { useGameStore } from '../../store/game-store';
import { loadSettings } from '../../store/settings';
import { runUrl } from '../../store/share';
import { registerSceneObject, unregisterSceneObject } from '../debug';
import { navigate } from '../router';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';
import { Button } from '../widgets/Button';

/**
 * Game-over overlay scene, ported from the old React GameOverScreen: dimmed
 * scrim above PlayScene plus a scorecard card (gold border won / red border
 * lost) and the three actions (copy replay link, play again, return to title).
 * Launched by PlayScene when the store's game leaves the 'playing' phase.
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const CARD_WIDTH = 560;
const CARD_TOP = 74;
const COPIED_RESET_MS = 2000;

/** COLORS.overlay (`rgba(3, 5, 9, 0.82)`) as Phaser fill arguments. */
const SCRIM = { color: 0x030509, alpha: 0.82 };

export class GameOverScene extends Phaser.Scene {
  private copiedTimer: Phaser.Time.TimerEvent | null = null;
  private copyButton: Button | null = null;
  private scoreText: Phaser.GameObjects.Text | null = null;
  private langUnsubscribe: (() => void) | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  constructor() {
    super('GameOverScene');
  }

  create(): void {
    const game = useGameStore.getState().game;
    if (game === null || game.phase === 'playing') {
      // Nothing to show (e.g. launched while the run was already finished).
      this.scene.stop();
      return;
    }

    // Re-render in the new language while the overlay is up.
    this.langUnsubscribe = useLanguage.subscribe(() => this.scene.restart());

    // The overlay is transient: any store change that ends the finished run
    // (finishRun / abandonRun → game null, or a new run → phase playing —
    // e.g. a replay-URL navigation restarting PlayScene) dismisses it.
    this.storeUnsubscribe = useGameStore.subscribe((state) => {
      if (state.game === null || state.game.phase === 'playing') {
        this.storeUnsubscribe?.();
        this.storeUnsubscribe = null;
        this.langUnsubscribe?.();
        this.langUnsubscribe = null;
        this.scene.stop();
      }
    });

    const won = game.phase === 'won';
    const cx = GAME_WIDTH / 2;

    // Dimmed overlay above PlayScene.
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, SCRIM.color, SCRIM.alpha)
      .setOrigin(0, 0)
      .setDepth(0);

    // Card: outcome-colored border (gold won / red lost).
    const cardHeight = GAME_HEIGHT - CARD_TOP * 2;
    const cardTop = CARD_TOP;
    const panel = this.add.graphics().setDepth(1);
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(cx - CARD_WIDTH / 2, cardTop, CARD_WIDTH, cardHeight, RADIUS.panel);
    panel.lineStyle(2, rgb(won ? COLORS.gold : COLORS.danger), 1).strokeRoundedRect(
      cx - CARD_WIDTH / 2 + 1,
      cardTop + 1,
      CARD_WIDTH - 2,
      cardHeight - 2,
      RADIUS.panel,
    );

    // Title + subtitle.
    this.add
      .text(cx, cardTop + 52, won ? t('victory') : t('defeat'), {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.h1 + 14}px`,
        color: won ? COLORS.gold : COLORS.danger,
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setName('gameover-title');
    this.add
      .text(cx, cardTop + 96, won ? t('victorySub') : t('defeatSub'), {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.value}px`,
        color: COLORS.muted,
        align: 'center',
        wordWrap: { width: CARD_WIDTH - SPACING.xl * 4, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(2);

    // Scorecard.
    const score = finalScore(game);
    const rows: Array<{ label: string; value: string; style?: 'score' | 'mono' }> = [
      { label: t('score'), value: `${score}`, style: 'score' },
      { label: t('finalHealth'), value: `${Math.max(0, game.hp)}` },
      { label: t('seed'), value: game.seed, style: 'mono' },
      { label: t('toggles'), value: configSummary(game.config) },
      { label: t('monstersKilled'), value: `${game.runHighlights.monstersKilled}` },
      { label: t('potionsWasted'), value: `${game.runHighlights.potionsWasted}` },
      { label: t('roomsExplored'), value: `${game.runHighlights.roomsExplored}` },
    ];
    let y = cardTop + 148;
    for (const row of rows) {
      if (row.style === 'score') {
        // Score row: label left, big gold value right.
        this.add
          .text(cx - CARD_WIDTH / 2 + SPACING.xl * 2, y + 14, row.label, {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.value + 2}px`,
            color: COLORS.text,
          })
          .setOrigin(0, 0.5)
          .setDepth(2);
        this.scoreText = this.add
          .text(cx + CARD_WIDTH / 2 - SPACING.xl * 2, y + 14, row.value, {
            fontFamily: FONT.mono,
            fontSize: `${FONT.size.h1 + 10}px`,
            color: COLORS.gold,
          })
          .setOrigin(1, 0.5)
          .setDepth(2);
        registerSceneObject('text-final-score', this.scoreText);
        y += 58;
        continue;
      }
      const valueStyle =
        row.style === 'mono'
          ? { fontFamily: FONT.mono, fontSize: `${FONT.size.value}px`, color: COLORS.text }
          : {
              fontFamily: FONT.family,
              fontSize: `${FONT.size.value}px`,
              color: COLORS.text,
              wordWrap: { width: CARD_WIDTH - SPACING.xl * 8, useAdvancedWrap: true },
            };
      this.add
        .text(cx - CARD_WIDTH / 2 + SPACING.xl * 2, y, row.label, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.small + 1}px`,
          color: COLORS.muted,
        })
        .setOrigin(0, 0.5)
        .setDepth(2);
      this.add
        .text(cx + CARD_WIDTH / 2 - SPACING.xl * 2, y, row.value, valueStyle)
        .setOrigin(1, 0.5)
        .setDepth(2);
      y += 30;
    }

    // Actions.
    const actionsY = cardTop + cardHeight - 96;
    this.copyButton = new Button(this, cx - 180, actionsY, t('copyLink'), {
      variant: 'primary',
      width: 200,
      height: 46,
      onClick: () => this.copyReplayLink(game),
      debugId: 'btn-copy-link',
    }).setDepth(2);
    new Button(this, cx + 10, actionsY, t('playAgain'), {
      width: 180,
      height: 46,
      onClick: () => this.playAgain(),
      debugId: 'btn-play-again',
    }).setDepth(2);
    new Button(this, cx - 180, actionsY + 58, t('returnTitle'), {
      width: 200,
      height: 46,
      onClick: () => this.returnToTitle(),
      debugId: 'btn-return-title',
    }).setDepth(2);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.copiedTimer?.remove(false);
      this.copiedTimer = null;
      unregisterSceneObject('text-final-score');
      this.scoreText = null;
      this.copyButton = null;
      this.storeUnsubscribe?.();
      this.storeUnsubscribe = null;
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
    });
  }

  /** Copy the replay URL (clipboard API with execCommand fallback). */
  private copyReplayLink(game: GameState): void {
    const link = `${window.location.origin}${window.location.pathname}${runUrl(game.seed, game.config)}`;
    const markCopied = (): void => {
      this.copyButton?.setLabel(t('linkCopied'));
      this.copiedTimer?.remove(false);
      this.copiedTimer = this.time.delayedCall(COPIED_RESET_MS, () => {
        this.copiedTimer = null;
        this.copyButton?.setLabel(t('copyLink'));
      });
    };
    navigator.clipboard.writeText(link).then(markCopied, () => {
      // Clipboard API unavailable (e.g. non-secure context): fall back.
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      markCopied();
    });
  }

  private playAgain(): void {
    this.scene.stop();
    useGameStore.getState().startRun(randomSeed(), loadSettings().config);
    navigate('#/play');
  }

  private returnToTitle(): void {
    useGameStore.getState().finishRun();
    this.scene.stop();
    navigate('#/');
  }
}

/** "run away: once · potions: 1/room · degradation: on" (old configSummary). */
function configSummary(config: GameState['config']): string {
  return [
    config.runAwayMode === 'once' ? t('configRunOnce') : t('configRunUnlimited'),
    config.potionsPerRoom === 'one' ? t('configPotionOne') : t('configPotionUnlimited'),
    config.weaponDegradation ? t('configDegOn') : t('configDegOff'),
  ].join(' · ');
}
