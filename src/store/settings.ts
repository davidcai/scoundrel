/**
 * Persisted interface settings (REQ-010, REQ-012).
 *
 * Only user preferences live here: the requested language and the reduced
 * motion choice (`null` means "follow the system"). House-rule selections are
 * per-run and belong to the run payload; changing settings never changes an
 * active run's rules.
 */
import { DEFAULT_LOCALE, isLocalePreference, type LocalePreference } from '../i18n';
import { isRecord } from './validation';

export interface StoredSettings {
  readonly locale: LocalePreference;
  /** `true` forces reduced motion, `false` forces full motion, `null` follows the system. */
  readonly reducedMotion: boolean | null;
}

export const DEFAULT_SETTINGS: StoredSettings = Object.freeze({
  locale: DEFAULT_LOCALE,
  reducedMotion: null,
});

export function isStoredSettings(value: unknown): value is StoredSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.locale === 'string' &&
    isLocalePreference(value.locale) &&
    (value.reducedMotion === null || typeof value.reducedMotion === 'boolean')
  );
}

/** Merge a partial preference change, keeping the previous values for omitted keys. */
export function mergeSettings(
  current: StoredSettings,
  patch: { readonly locale?: LocalePreference; readonly reducedMotion?: boolean | null },
): StoredSettings {
  return {
    locale: patch.locale ?? current.locale,
    reducedMotion: patch.reducedMotion === undefined ? current.reducedMotion : patch.reducedMotion,
  };
}
