/**
 * Interface preferences: language and reduced motion.
 *
 * Both preferences live in the persisted settings shard (Phase 4, REQ-010,
 * REQ-012) and are updated through the ScoundrelStore. The in-app reduced-motion
 * setting can follow the system preference (`null`) until the player chooses.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { createTranslator, type Locale, type Translate } from '../i18n';
import { useScoundrelSnapshot, useScoundrelStore } from './useScoundrelStore';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
  const store = useScoundrelStore();
  const snapshot = useScoundrelSnapshot();
  const locale = snapshot.settings.locale;
  const reducedMotionSetting = snapshot.settings.reducedMotion;
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

  const setLocale = useCallback(
    (next: Locale) => {
      store.updateSettings({ locale: next });
    },
    [store],
  );

  const setReducedMotion = useCallback(
    (value: boolean | null) => {
      store.updateSettings({ reducedMotion: value });
    },
    [store],
  );

  const t = useMemo(() => createTranslator(locale), [locale]);
  const value = useMemo<PreferencesApi>(
    () => ({
      locale,
      t,
      reducedMotion,
      systemReducedMotion,
      setLocale,
      setReducedMotion,
    }),
    [locale, t, reducedMotion, systemReducedMotion, setLocale, setReducedMotion],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesApi {
  const context = useContext(PreferencesContext);
  if (context === null) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
