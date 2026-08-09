interface EndScreenProps {
  status: 'won' | 'lost';
  score: number;
  onNewGame: () => void;
}

export function EndScreen({ status, score, onNewGame }: EndScreenProps) {
  const won = status === 'won';
  return (
    <div className="end-overlay">
      <div className="end-card">
        <div className={`end-title ${status}`}>{won ? 'Victory!' : 'You Died'}</div>
        <div className="end-subtitle">
          {won
            ? 'You cleared the dungeon and survived.'
            : 'The dungeon claimed another scoundrel.'}
        </div>
        <div className={`end-score ${status}`}>{score}</div>
        <button className="btn btn-primary" onClick={onNewGame}>
          New Game
        </button>
      </div>
    </div>
  );
}