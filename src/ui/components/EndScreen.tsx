interface EndScreenProps {
  status: 'won' | 'lost';
  score: number | null;
  onRestart: () => void;
}

export function EndScreen({ status, score, onRestart }: EndScreenProps) {
  const won = status === 'won';
  return (
    <div className="end-screen">
      <div className={`end-panel ${won ? 'end-panel--won' : 'end-panel--lost'}`}>
        <h2>{won ? 'Dungeon cleared!' : 'You died in the dark'}</h2>
        <p className="end-score">
          Final score: <strong>{score}</strong>
        </p>
        <p className="end-flavor">
          {won
            ? 'You emerge into daylight, pockets heavy with stories.'
            : 'The dungeon keeps what it takes.'}
        </p>
        <button className="btn btn--big" onClick={onRestart} autoFocus>
          Play again
        </button>
      </div>
    </div>
  );
}
