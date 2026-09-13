import { create } from 'zustand';
import type { CardId } from './engine';
import { cardKind, cardRank, cardSuit, cardValue, type CardKind } from './engine';
import {
  loadLanguageSetting,
  resolveLanguage,
  saveLanguage,
  type LanguageSetting,
} from './store/settings';
import type { Locales } from './i18n/i18n-util.sync';
import { i18n } from './i18n/i18n-util';
import type { MessageKey } from './i18n/i18n-types';
import { cardTitleKey } from './ui/card-titles';

export type { MessageKey };
export type { Locales as Language } from './i18n/i18n-util.sync';

/**
 * i18n layer on top of typesafe-i18n: a tiny zustand store for the active
 * language, reactive `useT()` for components, and non-react `t()` for
 * announcements. Messages live in `src/i18n/en.ts` / `src/i18n/zh.ts`.
 */

export type TFunc = (key: MessageKey, params?: Record<string, string | number>) => string;

interface LanguageStore {
  /** Resolved language actually rendered ('auto' resolves via detection). */
  lang: Locales;
  /** Stored preference: 'auto' or the player's explicit choice. */
  setting: LanguageSetting;
  setLang: (setting: LanguageSetting) => void;
}

function htmlLang(lang: Locales): string {
  return lang === 'zh' ? 'zh-CN' : 'en';
}

const initialSetting = loadLanguageSetting();
const initialLang = resolveLanguage(initialSetting);

export const useLanguage = create<LanguageStore>((set) => ({
  lang: initialLang,
  setting: initialSetting,
  setLang: (setting) => {
    saveLanguage(setting);
    const lang = resolveLanguage(setting);
    document.documentElement.lang = htmlLang(lang);
    set({ lang, setting });
  },
}));

// Keep <html lang> in sync on first load too.
document.documentElement.lang = htmlLang(initialLang);

export function currentLang(): Locales {
  return useLanguage.getState().lang;
}

function lookup(lang: Locales, key: MessageKey, params?: Record<string, string | number>): string {
  const fn = i18n(lang)[key] as (args?: unknown) => string;
  return fn(params ?? []);
}

/** Test helper: translate a key in an explicit language. */
export function translate(
  lang: Locales,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  return lookup(lang, key, params);
}

/** Reactive hook: re-renders on language change. */
export function useT(): TFunc {
  const lang = useLanguage((s) => s.lang);
  return (key, params) => lookup(lang, key, params);
}

/** Non-React accessor for store-layer code (announcements). */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return lookup(currentLang(), key, params);
}

const KIND_NAMES: Record<Locales, Record<CardKind, string>> = {
  en: { monster: 'monster', weapon: 'weapon', potion: 'potion' },
  zh: { monster: '怪物', weapon: '武器', potion: '药水' },
};

const RANK_NAMES: Record<Locales, Record<string, string>> = {
  en: { j: 'Jack', q: 'Queen', k: 'King', a: 'Ace' },
  zh: { j: 'J', q: 'Q', k: 'K', a: 'A' },
};

const SUIT_NAMES: Record<Locales, Record<string, string>> = {
  en: { club: 'Clubs', diamond: 'Diamonds', heart: 'Hearts', spade: 'Spades' },
  zh: { club: '梅花', diamond: '方块', heart: '红心', spade: '黑桃' },
};

/** Localized card label, e.g. "8 of Clubs" / "梅花8". */
export function cardLabel(cardId: CardId): string {
  const lang = currentLang();
  const rank = RANK_NAMES[lang][cardRank(cardId)] ?? cardRank(cardId);
  const suit = SUIT_NAMES[lang][cardSuit(cardId)];
  return lang === 'zh' ? `${suit}${rank}` : `${rank} of ${suit}`;
}

/** Localized ARIA label, e.g. "8 of Clubs, monster, value 8" / "梅花8，怪物，数值8"。 */
export function cardAriaLabel(cardId: CardId): string {
  const lang = currentLang();
  if (lang === 'zh') {
    return `${cardLabel(cardId)}，${KIND_NAMES.zh[cardKind(cardId)]}，数值${cardValue(cardId)}`;
  }
  return `${cardLabel(cardId)}, ${cardKind(cardId)}, value ${cardValue(cardId)}`;
}

/** Localized hover hint, e.g. "Club 8 — Monster — attack 8" / "Club 8——怪物——攻击力8"。 */
export function cardHint(cardId: CardId): string {
  const lang = currentLang();
  const value = cardValue(cardId);
  const title = cardTitleKey(cardId, i18n(lang));
  switch (cardKind(cardId)) {
    case 'monster':
      return lookup(lang, 'hintMonster', { title, value });
    case 'weapon':
      return lookup(lang, 'hintWeapon', { title, value });
    case 'potion':
      return lookup(lang, 'hintPotion', { title, value });
  }
}
