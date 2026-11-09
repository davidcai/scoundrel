import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  canResolveAnyCard,
  cardKind,
  createInitialState,
  type CardId,
  type MonsterPreview,
  type RejectionReason,
} from '../engine';
import { CATALOGS, LOCALES, createTranslator, resolveLocale } from './index';
import { en } from './en';
import { zhHans } from './zh-Hans';
import {
  REJECTION_KEYS,
  describeEvent,
  formatCardAccessibleName,
  formatCardCaption,
  formatCardName,
  formatMonsterMatchupTitle,
  formatRulesDescription,
  rejectionText,
} from './messages';

const enT = createTranslator('en');
const zhT = createTranslator('zh-Hans');

describe('catalogs', () => {
  it('defines every English key in Simplified Chinese', () => {
    expect(Object.keys(zhHans).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(zhHans[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('registers both locales', () => {
    expect(LOCALES).toEqual(['en', 'zh-Hans']);
    expect(Object.keys(CATALOGS)).toEqual(['en', 'zh-Hans']);
  });

  it('falls back to English for a missing translation', () => {
    const { 'title.newRun': _missing, ...incomplete } = CATALOGS['zh-Hans'];
    void _missing;
    const t = createTranslator('zh-Hans', {
      en: CATALOGS.en,
      'zh-Hans': incomplete as (typeof CATALOGS)['zh-Hans'],
    });
    expect(t('title.newRun')).toBe(en['title.newRun']);
  });
});

describe('locale resolution', () => {
  it('resolves each supported language family', () => {
    expect(resolveLocale(['en-US'])).toBe('en');
    expect(resolveLocale(['en-GB'])).toBe('en');
    expect(resolveLocale(['zh'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-CN'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-Hans'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-SG'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-Hant-TW'])).toBe('en');
    expect(resolveLocale(['fr-FR'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });
});

describe('message helpers', () => {
  it('names cards in both languages', () => {
    const card: CardId = 'club-a';
    expect(formatCardName(enT, card).length).toBeGreaterThan(0);
    expect(formatCardName(zhT, card).length).toBeGreaterThan(0);
    expect(formatCardName(enT, card)).not.toBe(formatCardName(zhT, card));
  });

  it('captions cards by type, never by position or state', () => {
    expect(formatCardCaption(enT, { kind: 'monster' })).toBe('Monster');
    expect(formatCardCaption(enT, { kind: 'weapon' })).toBe('Weapon');
    expect(formatCardCaption(enT, { kind: 'potion' })).toBe('Potion');
    expect(formatCardCaption(zhT, { kind: 'monster' })).toBe('怪物');
    expect(formatCardCaption(zhT, { kind: 'weapon' })).toBe('武器');
    expect(formatCardCaption(zhT, { kind: 'potion' })).toBe('药水');

    expect(formatCardCaption(enT, { kind: 'monster' })).toBe('Monster');
    expect(formatCardCaption(enT, { kind: 'monster' })).not.toMatch(/Not usable|Selected|Carried/);
  });

  it('keeps the visible caption as an exact prefix of the accessible name and announces state', () => {
    const caption = formatCardCaption(enT, { kind: 'monster' });
    const accessible = formatCardAccessibleName(enT, { card: 'club-a', kind: 'monster' });
    expect(accessible).toBe(`${caption}, ${formatCardName(enT, 'club-a')}`);
    expect(accessible.startsWith(caption)).toBe(true);

    // The visible badge text is included for WCAG 2.5.3 Label in Name.
    const carried = formatCardAccessibleName(enT, {
      card: 'club-a',
      kind: 'monster',
      carried: true,
    });
    expect(carried.startsWith(caption)).toBe(true);
    expect(carried).toContain(formatCardName(enT, 'club-a'));
    expect(carried).toContain(enT('card.state.carried'));

    // Carried is announced before Selected (design plan §3).
    const both = formatCardAccessibleName(enT, {
      card: 'club-a',
      kind: 'monster',
      carried: true,
      selected: true,
    });
    expect(both.startsWith(caption)).toBe(true);
    expect(both.indexOf(enT('card.state.carried'))).toBeLessThan(
      both.indexOf(enT('card.state.selected')),
    );

    const zhCaption = formatCardCaption(zhT, { kind: 'monster' });
    const zhCarried = formatCardAccessibleName(zhT, {
      card: 'club-a',
      kind: 'monster',
      carried: true,
    });
    expect(zhCarried.startsWith(zhCaption)).toBe(true);
    expect(zhCarried).toContain(zhT('card.state.carried'));
  });

  it('titles monster previews as a weapon or barehanded matchup', () => {
    const preview: MonsterPreview = {
      card: 'spade-5',
      monsterValue: 5,
      barehanded: { damage: 5, healthAfter: 15 },
      weapon: { eligible: true, limit: null, damage: 2, healthAfter: 18 },
    };
    expect(formatMonsterMatchupTitle(enT, preview, 5)).toBe('Monster 5 vs. Weapon 5');
    expect(formatMonsterMatchupTitle(zhT, preview, 5)).toBe('怪物 5 对战武器 5');

    const barehanded: MonsterPreview = { ...preview, weapon: null };
    expect(formatMonsterMatchupTitle(enT, barehanded, null)).toBe('Monster 5 vs. barehanded');
    expect(formatMonsterMatchupTitle(zhT, barehanded, null)).toBe('怪物 5 对战徒手');
    expect(formatMonsterMatchupTitle(enT, barehanded, 5)).toBe('Monster 5 vs. barehanded');
  });

  it('covers every rejection reason exactly once', () => {
    const reasons = Object.keys(REJECTION_KEYS) as RejectionReason[];
    expect(reasons).toHaveLength(12);
    const texts = reasons.map((reason) => rejectionText(enT, reason));
    for (const text of texts) expect(text.length).toBeGreaterThan(0);
    expect(new Set(texts).size).toBe(12);
  });

  it('renders rule descriptions that differ by configuration', () => {
    const defaultRules = formatRulesDescription(enT, 'en', DEFAULT_RULE_CONFIG);
    const allRules = formatRulesDescription(enT, 'en', 7);
    expect(defaultRules.length).toBeGreaterThan(0);
    expect(defaultRules).not.toBe(allRules);
    expect(allRules).toContain(enT('rule.unlimitedPotions'));
  });

  it('describes a real engine card resolution event', () => {
    let state = createInitialState('messages-seed', DEFAULT_RULE_CONFIG);
    let attempts = 0;
    while (!canResolveAnyCard(state)) {
      state = createInitialState(`messages-${attempts}`, DEFAULT_RULE_CONFIG);
      attempts += 1;
    }
    const card =
      state.room.cards.find((roomCard) => cardKind(roomCard.card) !== 'monster')?.card ??
      state.room.cards[0]!.card;

    const text = describeEvent(enT, {
      type: 'cardResolved',
      card,
      cardKind: cardKind(card),
      attack: null,
      monsterValue: null,
      damage: 0,
      healthBefore: 20,
      healthAfter: 20,
      healing: 0,
      potionWasted: false,
      monsterDefeated: false,
      addedToWeaponStack: false,
      weaponEquipped: false,
      weaponReplaced: null,
      weaponReplacedKills: [],
      weapon: state.weapon,
      roomCleared: false,
      runOutcome: null,
      score: null,
    });
    expect(text.length).toBeGreaterThan(0);
  });
});
