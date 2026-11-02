import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_CONFIG,
  canResolveAnyCard,
  cardKind,
  createInitialState,
  type CardId,
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

  it('describes card position and states', () => {
    const caption = formatCardCaption(enT, { index: 1, total: 4 });
    expect(caption).toContain('1');
    expect(caption).toContain('4');

    const selected = formatCardCaption(enT, { index: 2, total: 4, selected: true });
    expect(selected).toContain(enT('card.state.selected'));

    const accessible = formatCardAccessibleName(enT, {
      card: 'club-a',
      index: 1,
      total: 4,
    });
    expect(accessible).toContain(formatCardName(enT, 'club-a'));
    // WCAG 2.5.3: the visible caption must appear verbatim in the name.
    expect(accessible).toContain(formatCardCaption(enT, { index: 1, total: 4 }));

    const selectedName = formatCardAccessibleName(enT, {
      card: 'heart-4',
      index: 3,
      total: 4,
      selected: true,
    });
    expect(selectedName).toContain(formatCardCaption(enT, { index: 3, total: 4, selected: true }));
    expect(
      selectedName.indexOf(formatCardCaption(enT, { index: 3, total: 4, selected: true })),
    ).toBe(0);
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
