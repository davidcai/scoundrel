import Phaser from 'phaser';
import { t, useLanguage } from '../../i18n';
import { navigate } from '../router';
import { COLORS, FONT, RADIUS, SPACING, rgb } from '../theme';
import { Button } from '../widgets/Button';
import { fadeInOnCreate, installRouter } from './route-map';

/**
 * About screen, ported from the old React AboutScreen: the rules in brief
 * (term + rest message pairs), credits, and two external links. Links are DOM
 * anchors positioned over the canvas (same page mapping as the seed input),
 * so they keep real <a> semantics (middle-click, hover status, target=_blank).
 */

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const PANEL_LEFT = 220;
const PANEL_RIGHT = 1060;
const PANEL_WIDTH = PANEL_RIGHT - PANEL_LEFT;
const CONTENT_WIDTH = PANEL_WIDTH - SPACING.xl * 2;

const TITLE_Y = 64;
const SECTION1_Y = 140;

const RULES_LINK1_Y = 620;
const LINK_ROW_HEIGHT = 30;

export class AboutScene extends Phaser.Scene {
  private root: Phaser.GameObjects.Container | null = null;
  private langUnsubscribe: (() => void) | null = null;
  private linkAnchors: HTMLAnchorElement[] = [];

  constructor() {
    super('AboutScene');
  }

  create(): void {
    fadeInOnCreate(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, rgb(COLORS.bg)).setOrigin(0, 0);

    this.root = this.add.container(0, 0);
    this.buildUi();

    installRouter(this, '/about');
    this.langUnsubscribe = useLanguage.subscribe(() => this.rebuildUi());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.langUnsubscribe?.();
      this.langUnsubscribe = null;
      this.closeLinks();
    });
  }

  private buildUi(): void {
    if (this.root === null) return;

    // Panel backdrop.
    const panel = this.add.graphics();
    const panelTop = TITLE_Y + 30;
    const panelBottom = GAME_HEIGHT - 90;
    panel
      .fillStyle(rgb(COLORS.panel), 1)
      .fillRoundedRect(PANEL_LEFT, panelTop, PANEL_WIDTH, panelBottom - panelTop, RADIUS.panel);
    panel
      .lineStyle(1, rgb(COLORS.border), 1)
      .strokeRoundedRect(
        PANEL_LEFT + 0.5,
        panelTop + 0.5,
        PANEL_WIDTH - 1,
        panelBottom - panelTop - 1,
        RADIUS.panel,
      );
    this.root.add(panel);

    // Header.
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, TITLE_Y, t('aboutTitle'), {
          fontFamily: FONT.display,
          fontSize: `${FONT.size.h1 + 6}px`,
          color: COLORS.gold,
        })
        .setOrigin(0.5)
        .setName('about-title'),
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

    // Section 1 — the rules in brief.
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, SECTION1_Y, t('rulesBrief'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.h2 + 2}px`,
          color: COLORS.text,
        })
        .setOrigin(0.5),
    );
    const cx = GAME_WIDTH / 2;
    this.root.add(
      this.add
        .text(
          cx,
          SECTION1_Y + 44,
          `${t('termMonsters')}${t('restMonsters')} ${t('termWeapons')}${t('restWeapons')} ${t('termPotions')}${t('restPotions')}`,
          {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.value}px`,
            color: COLORS.muted,
            align: 'center',
            lineSpacing: 6,
            wordWrap: { width: CONTENT_WIDTH, useAdvancedWrap: true },
          },
        )
        .setOrigin(0.5, 0),
    );
    const shortRules = [
      t('ruleRooms'),
      t('ruleDegradation'),
      t('rulePotion'),
      t('ruleRunAway'),
      t('ruleWin'),
    ];
    let ruleY = SECTION1_Y + 108;
    for (const rule of shortRules) {
      const line = this.add
        .text(cx, ruleY, rule, {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.value}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: CONTENT_WIDTH, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0);
      this.root.add(line);
      ruleY += line.height + SPACING.sm + 4;
    }

    // Section 2 — credits & links.
    const creditsY = ruleY + 24;
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, creditsY, t('credits'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.h2 + 2}px`,
          color: COLORS.text,
        })
        .setOrigin(0.5),
    );
    this.root.add(
      this.add
        .text(GAME_WIDTH / 2, creditsY + 42, t('creditsText'), {
          fontFamily: FONT.family,
          fontSize: `${FONT.size.value}px`,
          color: COLORS.muted,
          align: 'center',
          wordWrap: { width: CONTENT_WIDTH, useAdvancedWrap: true },
        })
        .setOrigin(0.5, 0),
    );

    // External links as DOM anchors over the canvas (kept until shutdown or
    // language rebuild — same lifecycle as the seed-entry input).
    const links: Array<{ href: string; label: string }> = [
      { href: 'http://stfj.net/art/2011/Scoundrel.pdf', label: t('linkRulebook') },
      { href: 'https://rpdillon.net/scoundrel.html', label: t('linkAnnotated') },
    ];
    links.forEach((link, index) => {
      const y = RULES_LINK1_Y + index * LINK_ROW_HEIGHT;
      const anchor = this.makeLinkAnchor(link.href, link.label, GAME_WIDTH / 2, y);
      this.linkAnchors.push(anchor);
      this.root?.add(
        this.add
          .text(GAME_WIDTH / 2, y, link.label, {
            fontFamily: FONT.family,
            fontSize: `${FONT.size.small + 1}px`,
            color: COLORS.goldBright,
          })
          .setOrigin(0.5)
          .setVisible(false)
          .setName(`link-metric-${index}`),
      );
    });
  }

  /**
   * DOM <a> positioned over the canvas at the given game-space point. Uses
   * the same page mapping as the seed input (canvas rect + game size; the
   * text is inline-block so the anchor shrinks to its content and centers).
   */
  private makeLinkAnchor(
    href: string,
    label: string,
    gameX: number,
    gameY: number,
  ): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = label;
    anchor.style.cssText = [
      'position: absolute',
      'z-index: 20',
      'transform: translate(-50%, -50%)',
      `color: ${COLORS.goldBright}`,
      'text-decoration: underline',
      `font-family: ${FONT.family}`,
      `font-size: ${FONT.size.small + 1}px`,
    ].join(';');
    this.positionAnchor(anchor, gameX, gameY);
    document.body.appendChild(anchor);
    return anchor;
  }

  private positionAnchor(anchor: HTMLAnchorElement, gameX: number, gameY: number): void {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = rect.width / this.scale.gameSize.width;
    const scaleY = rect.height / this.scale.gameSize.height;
    anchor.style.left = `${rect.left + gameX * scaleX}px`;
    anchor.style.top = `${rect.top + gameY * scaleY}px`;
  }

  private closeLinks(): void {
    for (const anchor of this.linkAnchors) anchor.remove();
    this.linkAnchors = [];
  }

  private rebuildUi(): void {
    this.closeLinks();
    this.root?.removeAll(true);
    this.buildUi();
  }
}
