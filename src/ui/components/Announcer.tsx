import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { usePreferences } from '../../store/preferences';

export type AnnouncementPriority = 'polite' | 'assertive';

type Announce = (text: string, priority?: AnnouncementPriority) => void;

interface Announcement {
  polite: string;
  assertive: string;
}

const AnnouncerContext = createContext<Announce | null>(null);

const ZERO_WIDTH = '\u200B';

/**
 * A live region only re-announces when its text changes; identical consecutive
 * outcomes (e.g. two barehanded kills with the same damage) get a zero-width
 * nudge so the second one is still spoken. The text content itself is unchanged.
 */
function nudge(previous: string, next: string): string {
  return previous === next ? `${next}${ZERO_WIDTH}` : next;
}

/**
 * One polite region for action outcomes and one assertive region for invalid
 * actions (design plan §7). Both regions exist from first render so updates
 * are announced reliably.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [announcement, setAnnouncement] = useState<Announcement>({
    polite: '',
    assertive: '',
  });

  const announce = useCallback<Announce>((text, priority = 'polite') => {
    setAnnouncement((previous) => ({
      ...previous,
      [priority]: nudge(previous[priority], text),
    }));
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div
        className="visually-hidden"
        data-testid="live-polite"
        aria-live="polite"
        aria-atomic="true"
        aria-label={t('a11y.livePolite')}
      >
        {announcement.polite}
      </div>
      <div
        className="visually-hidden"
        data-testid="live-assertive"
        aria-live="assertive"
        aria-atomic="true"
        aria-label={t('a11y.liveAssertive')}
      >
        {announcement.assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnouncerContext);
  if (announce === null) {
    throw new Error('useAnnounce must be used inside <AnnouncerProvider>.');
  }
  return announce;
}
