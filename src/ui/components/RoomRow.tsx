/**
 * The four-slot room row: unresolved slots render interactive cards, resolved
 * slots render ghosts (style guide §6.2). Slot positions are stable across
 * the room thanks to the store's slot slice; the carried card keeps its
 * ribbon marker.
 */
import { useGame, useGameStoreApi } from '../../store/gameStore';
import { cardKindHint } from '../cards/cardMeta';
import { Card, GhostSlot } from './Card';
import { Tooltip } from './Tooltip';

export interface RoomRowProps {
  cardRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}

export function RoomRow({ cardRefs }: RoomRowProps) {
  const slots = useGame((s) => s.slots);
  const selected = useGame((s) => s.selected);
  const carriedCardId = useGame((s) => s.carriedCardId);
  const phase = useGame((s) => s.game?.phase ?? 'playing');
  const store = useGameStoreApi();

  return (
    <div className="room-row" id="room-row" role="group" aria-label="Room cards">
      {slots.map((slot, i) => {
        if (slot.resolved) {
          return <GhostSlot key={slot.cardId} cardId={slot.cardId} />;
        }
        const isSelected = selected?.cardId === slot.cardId;
        return (
          <Tooltip key={slot.cardId} content={cardKindHint(slot.cardId)}>
            {(described) => (
              <Card
                cardId={slot.cardId}
                size="room"
                interactive={phase === 'playing'}
                selected={isSelected}
                confirmArmed={isSelected}
                carried={carriedCardId === slot.cardId}
                onActivate={() => store.getState().selectCard(slot.cardId)}
                forwardedRef={(el) => {
                  cardRefs.current[i] = el;
                }}
                ariaDescribedBy={described['aria-describedby']}
              />
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}
