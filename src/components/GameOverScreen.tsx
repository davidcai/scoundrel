interface Props {
  won: boolean;
  score: number;
  onNewGame: () => void;
  onMenu: () => void;
}

export default function GameOverScreen({ won, score, onNewGame, onMenu }: Props) {
  return (
    <div className="game-over">
      <h1 className={won ? 'won' : 'lost'}>{won ? 'You escaped the dungeon!' : 'You have fallen…'}</h1>
      <p className="score">
        Final score: <strong>{score}</strong>
      </p>
      <div className="game-over-buttons">
        <button type="button" className="btn primary" onClick={onNewGame}>
          Try again
        </button>
        <button type="button" className="btn" onClick={onMenu}>
          Rules
        </button>
      </div>
    </div>
  );
}
