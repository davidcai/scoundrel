/**
 * Interface preferences for Phase 3: language and reduced motion.
 *
 * Requested language and motion preference are remembered in memory only;
 * Phase 4 owns persistence (implementation-plan phase 4).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTranslator, resolveLocale, type Locale, type Translate } from '../i18n';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getInitialLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return resolveLocale(languages);
}

function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export interface PreferencesApi {
  readonly locale: Locale;
  readonly t: Translate;
  /** Effective reduced-motion choice: in-app preference, else the system setting. */
  readonly reducedMotion: boolean;
  readonly systemReducedMotion: boolean;
  setLocale(locale: Locale): void;
  setReducedMotion(value: boolean | null): void;
}

const PreferencesContext = createContext<PreferencesApi | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [reducedMotionSetting, setReducedMotionSetting] = useState<boolean | null>(null);
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(getSystemReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemReducedMotion(event.matches);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  const reducedMotion = reducedMotionSetting ?? systemReducedMotion;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [locale, reducedMotion]);

  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo<PreferencesApi>(
    () => ({
      locale,
      t,
      reducedMotion,
      systemReducedMotion,
      setLocale,
      setReducedMotion: setReducedMotionSetting,
    }),
    [locale, t, reducedMotion, systemReducedMotion],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesApi {
  const context = useContext(PreferencesContext);
  if (context === null) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
