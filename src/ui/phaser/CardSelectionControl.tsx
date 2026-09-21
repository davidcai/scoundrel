import type { GameState } from '../../engine';
import { cardHint, cardLabel, useT } from '../../i18n';
import { useGameStore } from '../../store/game-store';

const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/**
 * Overlay card-selection control for the Phaser path — the keyboard
 * card-navigation replacement for PlayScreen's inline roving-focus nav
 * (PlayScreen.tsx:59-83), which cannot survive the cards leaving the DOM
 * (docs/phaser-plan.md §4 Phase 1).
 *
 * Interaction model: the control itself is the only focusable element; the
 * canvas renders the highlight ring and never receives focus. ArrowLeft/
 * ArrowRight cycle the store selection across the room cards (engine room
 * order, wrapping), Home/End jump to the first/last card, Escape deselects.
 *
 * Screen-reader contract: on each cycle the newly selected card's name is
 * announced via an aria-live region, and the selected card's hint text is
 * rendered in DOM so keyboard users keep the tooltip layer. Test seam:
 * selection is readable via `data-selected-card-id` on the root and via the
 * live-region text.
 */
export function CardSelectionControl({ game }: { game: GameState }) {
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const selectCard = useGameStore((s) => s.selectCard);
  const t = useT();

  const room = game.room;
  const selected = selectedCardId !== null && room.includes(selectedCardId) ? selectedCardId : null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (selected !== null) {
        event.preventDefault();
        selectCard(null);
      }
      return;
    }
    if (!NAV_KEYS.has(event.key) || room.length === 0) return;
    event.preventDefault();
    const index = selected === null ? -1 : room.indexOf(selected);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? room.length - 1
          : index === -1
            ? 0
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + room.length) % room.length;
    selectCard(room[next]!);
  };

  return (
    <div
      className="card-selection"
      role="group"
      tabIndex={0}
      aria-label={t('cardNavLabel')}
      data-selected-card-id={selected ?? undefined}
      onKeyDown={onKeyDown}
    >
      <span className="sr-only" aria-live="polite">
        {selected !== null ? cardLabel(selected) : ''}
      </span>
      {selected !== null && (
        <p className="selection-hint" role="note">
          {cardHint(selected)}
        </p>
      )}
    </div>
  );
}
