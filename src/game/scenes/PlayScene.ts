import Phaser from 'phaser';
import {
  canEnterNextRoom,
  canUndo,
  cardKind,
  finalScore,
  isFinalRoom,
  runAwayStatus,
  weaponThreshold,
  type CardId,
  type GameAction,
  type GameState,
} from '../../engine';
import { cardHint, cardLabel, t, useLanguage } from '../../i18n';
import { useGameStore } from '../../store/game-store';
import { decodeConfig } from '../../store/share';
import { navigate, parseHash } from '../router';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';
import {
  carryNoteState,
  monsterActions,
  potionActions,
  roomProgressKey,
  weaponActions,
  weaponCannotNote,
} from '../view-models/action-panel';
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

// Weapon zone (bottom area): weapon card left, kill stack right.
const WEAPON_SCALE = 0.6;
const WEAPON_X = 230;
const WEAPON_Y = 642;
const WEAPON_TITLE_Y = 560;
const THRESHOLD_X = 330;
const KILLS_X = 1010;
const KILLS_TITLE_X = 880;
const KILL_DX = 26;
const KILL_DY = 10;
const LAST_KILL_BADGE_OFFSET_X = 52;
const LAST_KILL_BADGE_OFFSET_Y = -62;

// Action panel overlay (below the room grid, covering the weapon zone).
const PANEL_X = 260;
const PANEL_Y = 545;
const PANEL_WIDTH = 760;
const PANEL_HEIGHT = 172;

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
  private panelLayer!: Phaser.GameObjects.Container;
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
  private weaponLayer!: Phaser.GameObjects.Container;
  private weaponComposition: string | null = null;
  private panelKey: string | null = null;
  private lastMode: SceneMode | null = null;

  constructor() {
    super('PlayScene');
  }

  create(): void {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg))
      .setOrigin(0, 0);

    this.playLayer = this.add.container(0, 0);
    this.panelLayer = this.add.container(0, 0);
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

    // Weapon zone (built per composition by the store subscription).
    this.weaponLayer = this.add.container(0, 0);
    this.playLayer.add(this.weaponLayer);
    this.weaponComposition = null;

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
    this.panelLayer.removeAll(true);
    this.panelKey = null;
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
      // Leaving play (or losing the store game) also drops the action panel.
      if (mode !== 'playing') {
        this.panelLayer.removeAll(true);
        this.panelKey = null;
      }
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

    // Dungeon count + seed note.
    this.dungeonText.setText(t('cardsLeft', { count: game.dungeon.length }));
    this.seedValue.setText(game.seed);

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

    // Weapon zone: rebuild only when weapon / kill stack / degradation change.
    const weaponComposition = `${game.weapon ?? '-'}|${game.killStack.join(',')}|${
      game.config.weaponDegradation ? 'on' : 'off'
    }`;
    if (weaponComposition !== this.weaponComposition) this.rebuildWeaponZone(game);

    // Action panel: rebuild when the selection or the state feeding its
    // previews/damage numbers changes.
    const stateSignature = [
      game.hp,
      game.maxHp,
      game.weapon ?? '-',
      game.killStack.length,
      game.resolvedCount,
      game.potionsUsedThisRoom,
      game.room.length,
    ].join('/');
    const panelKey = `${selected ?? '-'}|${stateSignature}`;
    if (panelKey !== this.panelKey) this.rebuildActionPanel(game, selected, panelKey);
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

  // ── Weapon zone ─────────────────────────────────────────────────────────

  /**
   * Weapon zone per the old WeaponStack: weapon card on the left with the
   * degradation threshold line, kill stack on the right with the last kill on
   * top (older kills peek out left+down so their rank/suit corner stays visible).
   */
  private rebuildWeaponZone(game: GameState): void {
    this.weaponLayer.removeAll(true);
    this.weaponComposition = `${game.weapon ?? '-'}|${game.killStack.join(',')}|${
      game.config.weaponDegradation ? 'on' : 'off'
    }`;

    const degradationOn = game.config.weaponDegradation;
    const threshold = weaponThreshold(game);
    const lastKill = game.killStack[game.killStack.length - 1];
    const thresholdText = !degradationOn
      ? t('thresholdOff')
      : threshold === null
        ? t('thresholdFresh')
        : t('thresholdValue', { threshold });

    // Weapon side.
    this.weaponLayer.add(
      this.add
        .text(WEAPON_X, WEAPON_TITLE_Y, t('weaponZone'), LABEL_STYLE)
        .setOrigin(0.5)
        .setName('weapon-zone-title'),
    );
    if (game.weapon !== null) {
      const weaponSprite = new CardSprite(this, WEAPON_X, WEAPON_Y, game.weapon, {});
      weaponSprite.setScale(WEAPON_SCALE);
      attachTooltip(this, weaponSprite, () => thresholdText);
      this.weaponLayer.add(weaponSprite);
      this.weaponLayer.add(
        this.add
          .text(THRESHOLD_X, WEAPON_Y - 22, thresholdText, {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.small}px`,
            color: COLORS.muted,
            wordWrap: { width: 330, useAdvancedWrap: true },
          })
          .setOrigin(0, 0.5),
      );
    }

    // Fights-any / fights-up-to line (old WeaponStack `.weapon-threshold`).
    const fightsLine =
      !degradationOn || threshold === null || lastKill === undefined
        ? t('fightsAny')
        : t('fightsUpTo', { threshold, last: cardLabel(lastKill) });
    this.weaponLayer.add(
      this.add
        .text(THRESHOLD_X, game.weapon !== null ? WEAPON_Y + 22 : WEAPON_Y, fightsLine, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.small}px`,
          color: COLORS.text,
          wordWrap: { width: 330, useAdvancedWrap: true },
        })
        .setOrigin(0, 0.5),
    );

    // Kill side.
    this.weaponLayer.add(
      this.add
        .text(KILLS_TITLE_X, WEAPON_TITLE_Y, t('slainMonsters'), LABEL_STYLE)
        .setOrigin(0, 0.5),
    );
    if (game.killStack.length === 0) {
      this.weaponLayer.add(
        this.add
          .text(
            KILLS_X,
            WEAPON_Y,
            game.weapon !== null
              ? t('noKillsFresh', { weapon: cardLabel(game.weapon) })
              : t('noKillsNoWeapon'),
            {
              fontFamily: FONT.family,
              fontSize: `${FONT.size.small}px`,
              color: COLORS.muted,
              align: 'center',
              wordWrap: { width: 320, useAdvancedWrap: true },
            },
          )
          .setOrigin(0.5),
      );
      return;
    }

    // Oldest kills first so the newest (last) renders on top; older layers
    // peek out to the left and slightly down.
    const count = game.killStack.length;
    game.killStack.forEach((cardId, index) => {
      const depthFromTop = count - 1 - index;
      const sprite = new CardSprite(
        this,
        KILLS_X - depthFromTop * KILL_DX,
        WEAPON_Y + depthFromTop * KILL_DY,
        cardId,
        {},
      );
      sprite.setScale(WEAPON_SCALE);
      if (depthFromTop === 0) attachTooltip(this, sprite, () => thresholdText);
      this.weaponLayer.add(sprite);
    });

    // "Last kill" badge on the newest card.
    const badge = this.add.container(
      KILLS_X + LAST_KILL_BADGE_OFFSET_X,
      WEAPON_Y + LAST_KILL_BADGE_OFFSET_Y,
    );
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(rgb(COLORS.gold), 1).fillRoundedRect(-34, -10, 68, 20, 10);
    badgeBg.lineStyle(1, rgb(COLORS.goldBright), 1).strokeRoundedRect(-33.5, -9.5, 67, 19, 10);
    const badgeText = this.add
      .text(0, 0, t('lastKillBadge'), {
        fontFamily: FONT.family,
        fontSize: `${FONT.size.tiny + 1}px`,
        color: COLORS.goldInk,
      })
      .setOrigin(0.5);
    badge.add([badgeBg, badgeText]);
    this.weaponLayer.add(badge);
  }

  // ── Action panel ────────────────────────────────────────────────────────

  /**
   * Panel for the selected card, ported from the old ActionPanel: title +
   * close button, then per-kind actions built from the pure view-models.
   * While the carry note applies (room resolved down to the carry card) only
   * the note + cancel are shown. Hides entirely when nothing is selected.
   */
  private rebuildActionPanel(
    game: GameState,
    selected: CardId | null,
    panelKey: string,
  ): void {
    this.panelLayer.removeAll(true);
    this.panelKey = panelKey;
    if (selected === null) return;

    const cx = PANEL_X + PANEL_WIDTH / 2;
    const left = PANEL_X;
    const top = PANEL_Y;

    const panel = this.add.graphics();
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(PANEL_X, PANEL_Y, PANEL_WIDTH, PANEL_HEIGHT, RADIUS.section);
    panel
      .lineStyle(1, rgb(COLORS.gold), 1)
      .strokeRoundedRect(
        PANEL_X + 0.5,
        PANEL_Y + 0.5,
        PANEL_WIDTH - 1,
        PANEL_HEIGHT - 1,
        RADIUS.section,
      );

    const title = this.add
      .text(left + SPACING.xl, top + 26, cardLabel(selected), {
        fontFamily: FONT.display,
        fontSize: `${FONT.size.h2}px`,
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5);

    const cancelButton = new Button(this, left + PANEL_WIDTH - 66, top + 26, t('cancel'), {
      variant: 'ghost',
      width: 110,
      height: 34,
      fontSize: FONT.size.small,
      onClick: () => useGameStore.getState().selectCard(null),
      debugId: 'btn-panel-cancel',
    });

    this.panelLayer.add([panel, title, cancelButton]);

    const buttonY = top + 92;
    const noteY = top + 140;

    // Once 3 of the 4 room cards are resolved, the remaining card is the carry
    // card: nothing can be resolved anymore — say so instead of offering actions.
    if (carryNoteState(game)) {
      this.panelLayer.add(
        this.add
          .text(cx, buttonY - 12, t('carryNote'), {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.small}px`,
            color: COLORS.muted,
            align: 'center',
            wordWrap: { width: PANEL_WIDTH - SPACING.xl * 4, useAdvancedWrap: true },
          })
          .setOrigin(0.5),
      );
      return;
    }

    const store = useGameStore.getState();
    const dispatch = (action: Parameters<typeof store.act>[0]): void => {
      store.act(action);
      store.selectCard(null);
    };

    switch (cardKind(selected)) {
      case 'monster':
        this.addMonsterActions(game, selected, cx, buttonY, noteY, dispatch);
        break;
      case 'potion':
        this.addPotionActions(game, selected, cx, buttonY, noteY, dispatch);
        break;
      case 'weapon':
        this.addWeaponActions(game, selected, cx, buttonY, noteY, dispatch);
        break;
    }
  }

  private addMonsterActions(
    game: GameState,
    cardId: CardId,
    cx: number,
    buttonY: number,
    noteY: number,
    dispatch: (action: GameAction) => void,
  ): void {
    const actions = monsterActions(game, cardId);
    const note = weaponCannotNote(game, cardId);
    const monsterLabel = cardLabel(cardId);
    const weapon = game.weapon;

    const withWeapon = weapon !== null && actions.withWeaponLegal;
    if (withWeapon && weapon !== null) {
      this.panelLayer.add(
        new Button(
          this,
          cx - 180,
          buttonY,
          t('fightWith', {
            weapon: cardLabel(weapon),
            damage: actions.withWeaponDamage ?? 0,
          }),
          {
            variant: 'primary',
            width: 420,
            height: 48,
            onClick: () => dispatch({ type: 'FightMonster', cardId }),
            debugId: 'btn-fight-weapon',
          },
        ),
      );
    } else if (note.weapon !== null) {
      this.panelLayer.add(
        this.add
          .text(
            cx,
            noteY,
            note.lastKill !== undefined
              ? t('weaponCannotWith', {
                  weapon: cardLabel(note.weapon),
                  monster: monsterLabel,
                  last: cardLabel(note.lastKill),
                })
              : t('weaponCannot', {
                  weapon: cardLabel(note.weapon),
                  monster: monsterLabel,
                }),
            {
              fontFamily: FONT.family,
              fontSize: `${FONT.size.small}px`,
              color: COLORS.muted,
              align: 'center',
              wordWrap: { width: PANEL_WIDTH - SPACING.xl * 2, useAdvancedWrap: true },
            },
          )
          .setOrigin(0.5),
      );
    }

    if (actions.barehanded.legal) {
      const x = withWeapon ? cx + 190 : cx;
      this.panelLayer.add(
        new Button(this, x, buttonY, t('fightBarehanded', { damage: actions.barehanded.damage }), {
          width: withWeapon ? 300 : 360,
          height: 48,
          onClick: () => dispatch({ type: 'FightMonster', cardId, barehanded: true }),
          debugId: 'btn-fight-barehanded',
        }),
      );
    }
  }

  private addPotionActions(
    game: GameState,
    cardId: CardId,
    cx: number,
    buttonY: number,
    noteY: number,
    dispatch: (action: GameAction) => void,
  ): void {
    const { wasted, heal } = potionActions(game, cardId);
    this.panelLayer.add(
      new Button(this, cx, buttonY, wasted ? t('drinkWasted') : t('drinkHeal', { heal }), {
        variant: 'primary',
        width: 480,
        height: 48,
        onClick: () => dispatch({ type: 'DrinkPotion', cardId }),
        debugId: 'btn-drink-potion',
      }),
    );
    this.panelLayer.add(
      this.add
        .text(cx, noteY, wasted ? t('potionWastedNote') : t('potionNote'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.small}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - SPACING.xl * 2, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );
  }

  private addWeaponActions(
    game: GameState,
    cardId: CardId,
    cx: number,
    buttonY: number,
    noteY: number,
    dispatch: (action: GameAction) => void,
  ): void {
    const label = cardLabel(cardId);
    const { swap } = weaponActions(game, cardId);
    const swapWarning =
      swap && game.weapon !== null
        ? t('equipSwap', {
            label,
            old: cardLabel(game.weapon),
            kills: game.killStack.length,
          })
        : t('equipFresh', { label });

    this.panelLayer.add(
      new Button(this, cx, buttonY, t('equip', { label }), {
        variant: 'primary',
        width: 420,
        height: 48,
        onClick: () => dispatch({ type: 'EquipWeapon', cardId }),
        debugId: 'btn-equip-weapon',
      }),
    );
    this.panelLayer.add(
      this.add
        .text(cx, noteY, swapWarning, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.small}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: PANEL_WIDTH - SPACING.xl * 2, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );
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
