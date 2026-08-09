import type { GameState } from '../engine';

interface LogPanelProps {
  state: GameState;
}

export function LogPanel({ state }: LogPanelProps) {
  return (
    <div className="log-panel">
      <div className="panel-title">Adventure Log</div>
      <div className="log-entries">
        {state.log.map((entry) => (
          <div key={entry.id} className={`log-entry ${entry.kind}`}>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}