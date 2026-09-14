import Phaser from 'phaser';
import { t, useLanguage } from '../../i18n';
import { saveSettings, type LanguageSetting } from '../../store/settings';
import type { GameConfig } from '../../engine';
import { loadSettings } from '../../store/settings';
import { navigate } from '../router';
import { COLORS, FONT, rgb } from '../theme';
import { Button } from '../widgets/Button';
import { registerSceneObject, unregisterSceneObject } from '../debug';
import { fadeInOnCreate, installRouter } from './route-map';

/**
 * Settings screen, ported from the old React SettingsScreen: language selector
 * (Auto / English / 中文 buttons, active highlighted gold) and three house-rule
 * toggle switches. Toggles persist immediately via saveSettings; the language
 * choice goes through useLanguage.setLang. The whole UI rebuilds on language
 * change while the scene is active.
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const TITLE_Y = 64;
const INTRO_Y = 120;

// Language row.
const LANG_LABEL_X = 240;
const LANG_LABEL_Y = 190;
const LANG_BUTTON_Y = 190;
const LANG_BUTTON_WIDTH = 240;
const LANG_BUTTON_GAP = 16;

// Toggle rows.
const FIRST_ROW_Y = 300;
const ROW_GAP = 118;
const ROW_LABEL_X = 240;
const SWITCH_X = 1020;
const SWITCH_WIDTH = 72;
const SWITCH_HEIGHT = 36;

interface LanguageOption {
  value: LanguageSetting;
  label: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'auto', label: '' }, // label filled from t('languageAuto')
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文（简体）' },
];

/**
 * Toggle switch ported from the old `.switch` CSS: a rounded pill track
 * (gold when on, panel-lighter when off) with a knob that slides between the
 * ends. Click anywhere on the switch toggles.
 */
class ToggleSwitch extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Arc;
  private checked: boolean;
  private readonly debugId: string | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    checked: boolean,
    onToggle: (checked: boolean) => void,
    debugId?: string,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.checked = checked;
    this.debugId = debugId ?? null;

    this.track = scene.add.graphics();
    this.knob = scene.add.circle(0, 0, SWITCH_HEIGHT / 2 - 5, rgb(COLORS.text));
    this.add([this.track, this.knob]);

    this.setSize(SWITCH_WIDTH, SWITCH_HEIGHT);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-SWITCH_WIDTH / 2, -SWITCH_HEIGHT / 2, SWITCH_WIDTH, SWITCH_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on('pointerup', () => {
      this.setChecked(!this.checked);
      onToggle(this.checked);
    });

    if (this.debugId !== null) {
      this.name = this.debugId;
      registerSceneObject(this.debugId, this);
    }
    this.redraw();
  }

  setChecked(checked: boolean): this {
    this.checked = checked;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const track = this.track;
    track.clear();
    track.fillStyle(rgb(this.checked ? COLORS.gold : COLORS.panelLighter), 1);
    track.fillRoundedRect(
      -SWITCH_WIDTH / 2,
      -SWITCH_HEIGHT / 2,
      SWITCH_WIDTH,
      SWITCH_HEIGHT,
      SWITCH_HEIGHT / 2,
    );
    track.lineStyle(1, rgb(this.checked ? COLORS.goldBright : COLORS.border), 1);
    track.strokeRoundedRect(
      -SWITCH_WIDTH / 2 + 0.5,
      -SWITCH_HEIGHT / 2 + 0.5,
      SWITCH_WIDTH - 1,
      SWITCH_HEIGHT - 1,
      SWITCH_HEIGHT / 2,
    );
    const margin = 5;
    this.knob.x = this.checked
      ? SWITCH_WIDTH / 2 - SWITCH_HEIGHT / 2 - margin
      : -SWITCH_WIDTH / 2 + SWITCH_HEIGHT / 2 + margin;
  }

  destroy(fromScene?: boolean): void {
    if (this.debugId !== null) unregisterSceneObject(this.debugId);
    super.destroy(fromScene);
  }
}

export class SettingsScene extends Phaser.Scene {
  private root: Phaser.GameObjects.Container | null = null;
  private langUnsubscribe: (() => void) | null = null;

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    fadeInOnCreate(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg)).setOrigin(0, 0);

    this.root = this.add.container(0, 0);
    this.buildUi();

    installRouter(this, '/settings');
    this.langUnsubscribe = useLanguage.subscribe(() => this.rebuildUi());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
    });
  }

  private buildUi(): void {
    if (this.root === null) return;
    const { config, language } = loadSettings();

    // Header.
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, TITLE_Y, t('settings'), {
          fontFamily: FONT.display,
          fontSize: `${FONT.size.h1 + 6}px`,
          color: COLORS.gold,
        })
        .setOrigin(0.5)
        .setName('settings-title'),
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

    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, INTRO_Y, t('settingsIntro'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.value}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: 760, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );

    // Language row.
    this.root.add(
      this.add
        .text(LANG_LABEL_X, LANG_LABEL_Y, t('languageLabel'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.label + 3}px`,
          color: COLORS.text,
        })
        .setOrigin(0, 0.5),
    );
    const options = LANGUAGE_OPTIONS.map((option) => ({
      ...option,
      label: option.value === 'auto' ? t('languageAuto') : option.label,
    }));
    const totalWidth = options.length * LANG_BUTTON_WIDTH + (options.length - 1) * LANG_BUTTON_GAP;
    options.forEach((option, index) => {
      const x =
        GAME_WIDTH / 2 -
        totalWidth / 2 +
        index * (LANG_BUTTON_WIDTH + LANG_BUTTON_GAP) +
        LANG_BUTTON_WIDTH / 2;
      this.root?.add(
        new Button(this, x, LANG_BUTTON_Y, option.label, {
          variant: language === option.value ? 'primary' : 'default',
          width: LANG_BUTTON_WIDTH,
          height: 46,
          onClick: () => {
            if (useLanguage.getState().setting !== option.value) {
              useLanguage.getState().setLang(option.value);
            }
          },
          debugId: `btn-lang-${option.value}`,
        }),
      );
    });

    // House-rule toggles.
    const persist = (patch: Partial<GameConfig>): void => {
      saveSettings({ ...config, ...patch });
    };
    this.toggleRow(
      FIRST_ROW_Y,
      'toggle-run-away',
      t('toggleRunLabel'),
      t('toggleRunDesc'),
      config.runAwayMode === 'once',
      (checked) => persist({ runAwayMode: checked ? 'once' : 'unlimited' }),
    );
    this.toggleRow(
      FIRST_ROW_Y + ROW_GAP,
      'toggle-potions',
      t('togglePotionLabel'),
      t('togglePotionDesc'),
      config.potionsPerRoom === 'one',
      (checked) => persist({ potionsPerRoom: checked ? 'one' : 'unlimited' }),
    );
    this.toggleRow(
      FIRST_ROW_Y + ROW_GAP * 2,
      'toggle-degradation',
      t('toggleDegLabel'),
      t('toggleDegDesc'),
      config.weaponDegradation,
      (checked) => persist({ weaponDegradation: checked }),
    );
  }

  /** One settings row: label + muted description on the left, switch right. */
  private toggleRow(
    y: number,
    debugId: string,
    label: string,
    description: string,
    checked: boolean,
    onToggle: (checked: boolean) => void,
  ): void {
    if (this.root === null) return;
    this.root.add(
      this.add
        .text(ROW_LABEL_X, y - 14, label, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.label + 3}px`,
          color: COLORS.text,
        })
        .setOrigin(0, 0.5)
        .setName(`${debugId}-label`),
    );
    this.root.add(
      this.add
        .text(ROW_LABEL_X, y + 16, description, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.small}px`,
          color: COLORS.muted,
          wordWrap: { width: 640, useAdvancedWrap: true },
        })
        .setOrigin(0, 0),
    );
    this.root.add(new ToggleSwitch(this, SWITCH_X, y, checked, onToggle, debugId));
  }

  private rebuildUi(): void {
    this.root?.removeAll(true);
    this.buildUi();
  }
}
