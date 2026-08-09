import type { ReactNode } from 'react';
import type { Card } from '../engine/types';
import CardView from './CardView';

interface RoomAreaProps {
  room: Card[];
  roomSize: number;
  isFinalRoom: boolean;
  resolvedThisRoom: number;
  selectedId: string | null;
  onSelectCard: (id: string) => void;
  actionButtonsFor: (card: Card) => ReactNode;
}

export default function RoomArea({
  room,
  roomSize,
  isFinalRoom,
  resolvedThisRoom,
  selectedId,
  onSelectCard,
  actionButtonsFor,
}: RoomAreaProps) {
  const remaining = isFinalRoom
    ? room.length
    : Math.max(0, roomSize - 1 - resolvedThisRoom);

  const progressLabel = isFinalRoom
    ? 'Final room — clear all'
    : `Resolve ${remaining} more`;

  return (
    <div className="room-area">
      <div className="room-header">
        <h2 className="room-title">{isFinalRoom ? 'Final Room' : 'Room'}</h2>
        <span className="room-progress">{progressLabel}</span>
      </div>
      <div className="room-cards">
        {room.map((card) => (
          <div key={card.id} className="room-card-wrapper">
            <CardView
              card={card}
              selected={selectedId === card.id}
              onClick={() => onSelectCard(card.id)}
            />
            {selectedId === card.id && (
              <div className="room-card-actions">{actionButtonsFor(card)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
