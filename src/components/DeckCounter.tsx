interface DeckCounterProps {
  count: number;
}

export default function DeckCounter({ count }: DeckCounterProps) {
  return (
    <div className={`deck-counter ${count === 0 ? 'deck-empty' : ''}`}>
      <div className="deck-stack">
        <div className="deck-card deck-card-1" />
        <div className="deck-card deck-card-2" />
        <div className="deck-card deck-card-3" />
      </div>
      <div className="deck-info">
        <div className="deck-count">{count}</div>
        <div className="deck-label">Dungeon</div>
      </div>
    </div>
  );
}
