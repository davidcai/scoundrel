interface GameOverScreenProps {
  status: 'won' | 'lost';
  score: number;
  onRestart: () => void;
}

export default function GameOverScreen({
  status,
  score,
  onRestart,
}: GameOverScreenProps) {
  const isWon = status === 'won';

  return (
    <div className="game-over-overlay">
      <div className={`game-over-modal game-over-${status}`}>
        <div className="game-over-icon">{isWon ? '👑' : '💀'}</div>
        <h2 className="game-over-title">
          {isWon ? 'Dungeon Cleared!' : 'You Have Fallen'}
        </h2>
        <p className="game-over-score">Score: {score}</p>
        <p className="game-over-flavor">
          {isWon
            ? 'The dungeon lies silent before your triumph.'
            : 'The shadows claim another soul.'}
        </p>
        <button className="btn btn-restart btn-large" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </div>
  );
}
