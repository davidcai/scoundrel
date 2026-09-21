import type { GameState } from '../../engine';
import { useT } from '../../i18n';
import { useGameStore } from '../../store/game-store';

/**
 * DOM room mirror — the room-composition a11y/test seam over the Phaser canvas
 * (docs/phaser-plan.md §4 Phase 1; retained permanently per §7.6).
 *
 * An `aria-hidden`, non-focusable list mirroring the room with `data-card-id`
 * per card, so (a) Playwright keeps driving *input* — the spec clicks room
 * cards and reads composition via `.room [data-card-id]` — and (b) room state
 * stays readable outside the canvas. Clicking a mirror node forwards to
 * `selectCard` with the play screen's toggle semantics
 * (`selectCard(selected === cardId ? null : cardId)`); keyboard/screen-reader
 * input goes through the overlay `CardSelectionControl`, never the mirror.
 *
 * The root carries the `.room` class, so the `.room [data-card-id]`
 * locators keep working unchanged. PlayTableRegion places it inside the
 * (positioned) canvas region: the absolute geometry assumes that ancestor.
 */
export function RoomMirror({ game }: { game: GameState }) {
  const t = useT();
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const selectCard = useGameStore((s) => s.selectCard);

  const selected =
    selectedCardId !== null && game.room.includes(selectedCardId) ? selectedCardId : null;

  return (
    <div className="room room-mirror" aria-hidden="true">
      {game.room.map((cardId) => (
        <div
          key={cardId}
          className="mirror-card"
          data-card-id={cardId}
          data-selected={selected === cardId}
          onClick={() => selectCard(selected === cardId ? null : cardId)}
        >
          {game.carriedCardId === cardId && (
            <span className="carried-badge">{t('carriedBadge')}</span>
          )}
          {selected === cardId && <span className="selected-ring" />}
        </div>
      ))}
    </div>
  );
}
