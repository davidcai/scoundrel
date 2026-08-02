import type { Card } from '../game/types';
import CardView from './CardView';

interface Props {
  room: Card[];
  resolved: number;
  carried: boolean;
  onCardClick: (card: Card) => void;
}

export default function RoomView({ room, resolved, carried, onCardClick }: Props) {
  const roomStartSize = room.length + resolved;
  const mustResolve = Math.min(3, roomStartSize);
  const remaining = mustResolve - resolved;
  const slots = Array.from({ length: 4 }, (_, i) => room[i] ?? null);

  return (
    <section className="room">
      <div className="room-head">
        <h2>Room</h2>
        <span className="room-hint">
          {remaining > 0 ? `Resolve ${remaining} of ${mustResolve} cards` : 'Resolving…'}
        </span>
      </div>
      <div className="room-cards">
        {slots.map((card, i) =>
          card ? (
            <CardView
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
              badge={i === 0 && carried ? 'carried' : undefined}
            />
          ) : (
            <div key={`empty-${i}`} className="card card-empty" aria-hidden="true" />
          ),
        )}
      </div>
    </section>
  );
}
