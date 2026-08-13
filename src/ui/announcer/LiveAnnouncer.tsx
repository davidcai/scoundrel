import { useGameStore } from '../store/gameStore'

/**
 * Visually-hidden aria-live region (US56). Every committed engine result —
 * including terminal outcomes — is announced as one sentence. The sentence
 * node is keyed by the announcement sequence so back-to-back identical
 * sentences still reach screen readers (unchanged text nodes don't).
 */
export function LiveAnnouncer() {
  const announcement = useGameStore((store) => store.announcement)
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {announcement !== null ? <span key={announcement.seq}>{announcement.text}</span> : null}
    </div>
  )
}
