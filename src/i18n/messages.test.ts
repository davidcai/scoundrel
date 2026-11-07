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

  it('captions cards by type and state, never by position', () => {
    expect(formatCardCaption(enT, { kind: 'monster' })).toBe('Monster');
    expect(formatCardCaption(enT, { kind: 'weapon', selected: true })).toBe('Weapon · Selected');
    expect(formatCardCaption(enT, { kind: 'potion', carried: true })).toBe('Potion · Carried');
    expect(formatCardCaption(zhT, { kind: 'monster' })).toBe('怪物');
    expect(formatCardCaption(zhT, { kind: 'weapon', selected: true })).toBe('武器，已选择');
    expect(formatCardCaption(zhT, { kind: 'potion', carried: true })).toBe('药水，携带');

    const blocked = formatCardCaption(enT, { kind: 'monster', reason: 'weapon-ineligible' });
    expect(blocked).toContain(
      enT('card.state.notUsable', { reason: rejectionText(enT, 'weapon-ineligible') }),
    );
    expect(blocked).not.toMatch(/Card \d+ of \d+/);

    // Carried is listed before Selected (design plan §3).
    const both = formatCardCaption(enT, { kind: 'monster', carried: true, selected: true });
    expect(both.indexOf(enT('card.state.carried'))).toBeLessThan(
      both.indexOf(enT('card.state.selected')),
    );
  });

  it('keeps the visible caption as an exact prefix of the accessible name', () => {
    const caption = formatCardCaption(enT, { kind: 'monster' });
    const accessible = formatCardAccessibleName(enT, { card: 'club-a', kind: 'monster' });
    expect(accessible).toBe(`${caption}, ${formatCardName(enT, 'club-a')}`);
    expect(accessible.startsWith(caption)).toBe(true);

    const selected = formatCardCaption(enT, { kind: 'weapon', selected: true });
    const selectedName = formatCardAccessibleName(enT, {
      card: 'diamond-5',
      kind: 'weapon',
      selected: true,
    });
    expect(selectedName.startsWith(selected)).toBe(true);
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
