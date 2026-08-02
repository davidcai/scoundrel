import type { GameState } from '../game/types';
import { RANK_LABEL, SUIT_SYMBOL } from '../game/constants';

interface Props {
  state: GameState;
  onNew: () => void;
  onRetry: () => void;
}

export default function GameOver({ state, onNew, onRetry }: Props) {
  if (state.phase === 'playing') return null;
  const won = state.phase === 'won';
  return (
    <div className={`overlay ${won ? 'win' : 'lose'}`}>
      <div className="overlay-card">
        <h2>{won ? 'Dungeon Cleared!' : 'You Perished'}</h2>
        <p>
          Final score: <strong>{state.score}</strong>
        </p>
        {!won && state.dungeon.length > 0 && (
          <p className="overlay-detail">
            {state.dungeon.length} cards remained in the dungeon. Remaining monsters:{' '}
            {state.dungeon
              .filter((c) => c.suit === 'clubs' || c.suit === 'spades')
              .map((c) => `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`)
              .join(' ') || 'none'}
          </p>
        )}
        <div className="overlay-actions">
          <button className="primary" onClick={onNew}>
            New Dungeon
          </button>
          <button onClick={onRetry}>Retry Same Seed</button>
        </div>
      </div>
    </div>
  );
}