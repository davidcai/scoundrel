import Phaser from 'phaser';
import type { RunRecord } from '../../store/stats';
import { loadStats } from '../../store/stats';
import { runUrl } from '../../store/share';
import { t, useLanguage } from '../../i18n';
import { navigate } from '../router';
import { COLORS, FONT, RADIUS, rgb } from '../theme';
import { Button } from '../widgets/Button';
import { fadeInOnCreate, installRouter } from './route-map';

/**
 * Stats screen, ported from the old React StatsScreen: a 4×2 grid of stat
 * cards (value big gold, label small muted), then the run history — the latest
 * 8 runs, newest first (stats store caps at 50; older entries collapse into a
 * muted "+N more" line). Reads localStorage fresh on create and re-renders on
 * language change.
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const TITLE_Y = 64;
const GRID_TOP = 130;
const GRID_COLUMNS = 4;
const STAT_WIDTH = 260;
const STAT_HEIGHT = 96;
const STAT_GAP_X = 24;
const STAT_GAP_Y = 20;

const HISTORY_TITLE_Y = 392;
const HISTORY_TOP = 436;
const ROW_HEIGHT = 30;
const VISIBLE_RUNS = 8;

/** Columns of a run row: [seed, outcome, score, rooms, date, replay]. */
const COL_SEED = 200;
const COL_OUTCOME = 470;
const COL_SCORE = 610;
const COL_ROOMS = 770;
const COL_DATE = 930;
const COL_REPLAY = 1090;

export class StatsScene extends Phaser.Scene {
  private root: Phaser.GameObjects.Container | null = null;
  private langUnsubscribe: (() => void) | null = null;

  constructor() {
    super('StatsScene');
  }

  create(): void {
    fadeInOnCreate(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg)).setOrigin(0, 0);

    this.root = this.add.container(0, 0);
    this.buildUi();

    installRouter(this, '/stats');
    this.langUnsubscribe = useLanguage.subscribe(() => this.rebuildUi());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
    });
  }

  private buildUi(): void {
    if (this.root === null) return;
    const stats = loadStats();
    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

    // Header.
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, TITLE_Y, t('stats'), {
          fontFamily: FONT.display,
          fontSize: `${FONT.size.h1 + 6}px`,
          color: COLORS.gold,
        })
        .setOrigin(0.5)
        .setName('stats-title'),
    );
    this.root.add(
      new Button(this, GAME_WIDTH / 2, GAME_HEIGHT - 48, t('backToTitle'), {
        variant: 'ghost',
        width: 220,
        height: 44,
        onClick: () => navigate('#/'),
        debugId: 'btn-back-title',
      }),
    );

    // Stat grid (7 cards, 4 per row).
    const entries: Array<{ label: string; value: string }> = [
      { label: t('gamesPlayed'), value: `${stats.gamesPlayed}` },
      { label: t('wins'), value: `${stats.wins}` },
      { label: t('losses'), value: `${stats.losses}` },
      { label: t('winRate'), value: `${winRate}%` },
      { label: t('bestScore'), value: `${stats.bestScore}` },
      { label: t('currentStreak'), value: `${stats.currentStreak}` },
      { label: t('bestStreak'), value: `${stats.bestStreak}` },
    ];
    entries.forEach((entry, index) => {
      const row = Math.floor(index / GRID_COLUMNS);
      const col = index % GRID_COLUMNS;
      // The last row (7th card alone) is centered; full rows use the grid.
      const inRow = Math.min(GRID_COLUMNS, entries.length - row * GRID_COLUMNS);
      const rowWidth = inRow * STAT_WIDTH + (inRow - 1) * STAT_GAP_X;
      const rowLeft = (GAME_WIDTH - rowWidth) / 2;
      const cx = rowLeft + col * (STAT_WIDTH + STAT_GAP_X) + STAT_WIDTH / 2;
      const cy = GRID_TOP + row * (STAT_HEIGHT + STAT_GAP_Y) + STAT_HEIGHT / 2;
      this.root?.add(this.statCard(cx, cy, entry.value, entry.label));
    });

    // Run history.
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, HISTORY_TITLE_Y, t('runHistory'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.h2}px`,
          color: COLORS.text,
        })
        .setOrigin(0.5),
    );

    if (stats.runs.length === 0) {
      this.root.add(
        this.add
          .text(GAME_WIDTH / 2, HISTORY_TOP + 40, t('noRuns'), {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.value}px`,
            color: COLORS.muted,
          })
          .setOrigin(0.5),
      );
      return;
    }

    // Latest 8 runs (newest first); the rest collapse into a muted line.
    const visible = stats.runs.slice(0, VISIBLE_RUNS);
    visible.forEach((run, index) => {
      this.root?.add(this.runRow(run, HISTORY_TOP + index * ROW_HEIGHT));
    });
    if (stats.runs.length > VISIBLE_RUNS) {
      const more = stats.runs.length - VISIBLE_RUNS;
      this.root.add(
        this.add
          .text(GAME_WIDTH / 2, HISTORY_TOP + visible.length * ROW_HEIGHT + 8, `+${more}`, {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.small}px`,
            color: COLORS.muted,
          })
          .setOrigin(0.5),
      );
    }
  }

  /** One stat card: small panel, big gold value, muted label below. */
  private statCard(
    cx: number,
    cy: number,
    value: string,
    label: string,
  ): Phaser.GameObjects.Container {
    const card = this.add.container(cx, cy);
    const panel = this.add.graphics();
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(-STAT_WIDTH / 2, -STAT_HEIGHT / 2, STAT_WIDTH, STAT_HEIGHT, RADIUS.section);
    panel
      .lineStyle(1, rgb(COLORS.border), 1)
      .strokeRoundedRect(
        -STAT_WIDTH / 2 + 0.5,
        -STAT_HEIGHT / 2 + 0.5,
        STAT_WIDTH - 1,
        STAT_HEIGHT - 1,
        RADIUS.section,
      );
    const valueText = this.add
      .text(0, -14, value, {
        fontFamily: FONT.mono,
        fontSize: `${FONT.size.h1}px`,
        color: COLORS.gold,
      })
      .setOrigin(0.5);
    const labelText = this.add
      .text(0, 22, label, {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.small}px`,
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    card.add([panel, valueText, labelText]);
    return card;
  }

  /** One history row: seed · outcome · score · rooms · date · replay button. */
  private runRow(run: RunRecord, y: number): Phaser.GameObjects.Container {
    const row = this.add.container(0, y);
    const won = run.outcome === 'won';
    const labelStyle = {
      fontFamily: FONT.family,
      fontSize: `${FONT.size.small}px`,
      color: COLORS.text,
    };
    const monoStyle = { ...labelStyle, fontFamily: FONT.mono };

    row.add(this.add.text(COL_SEED, 0, run.seed, monoStyle).setOrigin(0, 0.5));
    row.add(
      this.add
        .text(COL_OUTCOME, 0, won ? t('win') : t('loss'), {
          ...labelStyle,
          color: won ? COLORS.success : COLORS.danger,
        })
        .setOrigin(0, 0.5),
    );
    row.add(
      this.add.text(COL_SCORE, 0, t('scoreOf', { score: run.score }), labelStyle).setOrigin(0, 0.5),
    );
    row.add(
      this.add
        .text(COL_ROOMS, 0, t('roomsCount', { rooms: run.roomsCleared }), labelStyle)
        .setOrigin(0, 0.5),
    );
    const locale = useLanguage.getState().lang === 'zh' ? 'zh-CN' : undefined;
    row.add(
      this.add
        .text(COL_DATE, 0, new Date(run.date).toLocaleDateString(locale), labelStyle)
        .setOrigin(0, 0.5),
    );
    row.add(
      new Button(this, COL_REPLAY + 44, 0, t('replay'), {
        variant: 'default',
        width: 96,
        height: 26,
        fontSize: FONT.size.tiny + 1,
        onClick: () => navigate(runUrl(run.seed, run.config)),
        debugId: `btn-replay-${run.seed}`,
      }),
    );
    return row;
  }

  private rebuildUi(): void {
    this.root?.removeAll(true);
    this.buildUi();
  }
}
