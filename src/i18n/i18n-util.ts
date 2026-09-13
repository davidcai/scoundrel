import { i18nObject } from 'typesafe-i18n';
import type { Translation, TranslationFunctions } from './i18n-types';
import type { Locales } from './i18n-util.sync';
import { translations } from './i18n-util.sync';

/** Typed translation object for a locale, e.g. `i18n('en').newRun()`. */
export const i18n = (locale: Locales): TranslationFunctions =>
  i18nObject<Locales, Translation, TranslationFunctions>(locale, translations[locale]);
