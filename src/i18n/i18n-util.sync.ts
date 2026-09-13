import en from './en';
import zh from './zh';
import type { Translation } from './i18n-types';

/** The languages the app ships. */
export const locales = ['en', 'zh'] as const;
export type Locales = (typeof locales)[number];

export const baseLocale: Locales = 'en';

/** Compile-time guarantee: every locale defines every base-locale key. */
export const translations: Record<Locales, Translation> = { en, zh };
