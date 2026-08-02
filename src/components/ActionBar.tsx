import type { GameState } from '../game/types';
import { canRun } from '../game/rules';

interface Props {
  state: GameState;
  onRun: () => void;
  onNext: () => void;
  onNew: () => void;
}

export default function ActionBar({ state, onRun, onNext, onNew }: Props) {
  const showNext = state.roomComplete && state.phase === 'playing' && state.dealtSize >= 4;
  const runAllowed = canRun(state);
  return (
    <div className="action-bar">
      {showNext && (
        <button className="primary" onClick={onNext}>
          Next Room
        </button>
      )}
      <button onClick={onRun} disabled={!runAllowed} title={state.ranLastRoom ? 'Cannot flee twice in a row' : ''}>
        Flee Room
      </button>
      <button onClick={onNew}>New Game</button>
    </div>
  );
}