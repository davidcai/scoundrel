import { useGameStore } from '../store/game-store';

/**
 * ARIA live region driven directly by engine result payloads. The announcement
 * id forces screen readers to re-announce identical messages.
 */
export function LiveAnnouncer() {
  const announcement = useGameStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" className="sr-only" key={announcement?.id ?? 'none'}>
      {announcement?.message ?? ''}
    </div>
  );
}
