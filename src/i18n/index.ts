/**
 * Hand-rolled i18n runtime for the English and Simplified Chinese catalogs.
 *
 * The interface never builds display strings itself: components receive a typed
 * translator, and card names, captions, accessible names, status lines, and
 * announcements are composed by the helpers in `messages.ts`.
 */
import { en, type MessageKey } from './en';
import { zhHans } from './zh-Hans';

export type Locale = 'en' | 'zh-Hans';
export type MessageParams = Readonly<Record<string, string | number>>;
export type Messages = Readonly<Record<MessageKey, string>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export type { MessageKey };

/** Locale used when the browser's languages are not supported (REQ-012). */
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES: readonly Locale[] = ['en', 'zh-Hans'];

export const CATALOGS: Readonly<Record<Locale, Messages>> = {
  en,
  'zh-Hans': zhHans,
};

/** BCP 47 tags used for Intl formatting. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  en: 'en-US',
  'zh-Hans': 'zh-Hans',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve the interface language from the browser's language preferences.
 * English and Simplified Chinese are supported; anything else falls back to
 * English (REQ-012). Traditional Chinese variants are unsupported and fall back
 * rather than being silently treated as Simplified Chinese.
 */
export function resolveLocale(languages: readonly string[] | undefined): Locale {
  const candidates = languages ?? [];
  for (const candidate of candidates) {
    const tag = candidate.toLowerCase();
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
    if (
      tag === 'zh' ||
      tag === 'zh-hans' ||
      tag.startsWith('zh-hans-') ||
      tag === 'zh-cn' ||
      tag === 'zh-sg' ||
      tag === 'zh-my'
    ) {
      return 'zh-Hans';
    }
  }
  return DEFAULT_LOCALE;
}

/** Replace `{name}` placeholders; unknown placeholders are left untouched. */
export function interpolate(template: string, params?: MessageParams): string {
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Build a translator. Missing keys fall back to English and then to the key
 * itself, so a partially translated catalog never renders an empty string.
 */
export function createTranslator(
  locale: Locale,
  catalogs: Readonly<Record<Locale, Messages>> = CATALOGS,
): Translate {
  const active = catalogs[locale];
  const fallback = catalogs[DEFAULT_LOCALE];
  return (key, params) => {
    const template = active[key] ?? fallback[key] ?? key;
    return interpolate(template, params);
  };
}

/** Locale-aware number formatting for scores, health, and counts. */
export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale]).format(value);
}

/** Locale-aware list formatting used for enabled house rules. */
export function formatList(locale: Locale, items: readonly string[]): string {
  if (items.length === 0) return '';
  try {
    return new Intl.ListFormat(LOCALE_TAGS[locale], {
      style: 'long',
      type: 'conjunction',
    }).format(items);
  } catch {
    return items.join(', ');
  }
}
