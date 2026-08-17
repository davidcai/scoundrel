import type { GameState } from '../../engine';
import { canEnterNextRoom, canRunAway, canUndo, resolveLimit } from '../../engine';

interface HudProps {
  state: GameState;
  onRunAway: () => void;
  onUndo: () => void;
  onEnterNextRoom: () => void;
}

export function Hud({ state, onRunAway, onUndo, onEnterNextRoom }: HudProps) {
  const run = canRunAway(state);
  const runTooltip = run.can
    ? 'Send all four cards to the bottom of the dungeon and deal a new room.'
    : run.reason === 'twice-in-row'
      ? 'You cannot run from two rooms in a row.'
      : run.reason === 'no-cards'
        ? 'Not enough cards left to run away.'
        : 'Resolve the room before running away.';
  return (
    <header className='hud'>
      <div className='hud-group'>
        <span className='hud-stat hud-hp'>HP {state.hp}/{state.maxHp}</span>
        <span className='hud-stat'>Deck {state.dungeon.length}</span>
        <span className='hud-stat'>Resolved {state.resolvedCount}/{resolveLimit(state)}</span>
        <span className='hud-stat hud-seed'>Seed {state.seed}</span>
      </div>
      <div className='hud-actions'>
        <button type='button' onClick={onRunAway} disabled={!run.can} title={runTooltip}>
          Run Away
        </button>
        <button type='button' onClick={onUndo} disabled={!canUndo(state)} title='Rewind this room to its start'>
          Undo Room
        </button>
        <button
          type='button'
          className='primary'
          onClick={onEnterNextRoom}
          disabled={!canEnterNextRoom(state)}
          title='Resolve three cards, then enter the next room'
        >
          Enter Next Room
        </button>
      </div>
    </header>
  );
}
