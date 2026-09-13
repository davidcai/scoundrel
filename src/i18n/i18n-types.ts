import type { I18nContextType } from 'typesafe-i18n/react';

/** The dictionary shape, derived from the base locale (`en`). */
export type Translation = typeof import('./en').default;

/** Every message key. */
export type MessageKey = keyof Translation;

/**
 * Typed translation functions: every key becomes a function whose arguments
 * are checked against the `{{param}}` placeholders in the message.
 */
export type TranslationFunctions = I18nContextType<'en', Translation>['LL'];

/** No custom formatters are used. */
export type Formatters = Record<string, never>;
