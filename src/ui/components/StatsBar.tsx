import { MAX_HEALTH } from '../../engine/types';

interface StatsBarProps {
  health: number;
  deckCount: number;
  potionUsed: boolean;
  canRun: boolean;
  runReason: string | null;
  onRun: () => void;
  onRestart: () => void;
}

export function StatsBar({
  health,
  deckCount,
  potionUsed,
  canRun,
  runReason,
  onRun,
  onRestart,
}: StatsBarProps) {
  const pct = Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
  return (
    <header className="stats-bar">
      <h1 className="title">Scoundrel</h1>
      <div className="health" title={`Health: ${health}/${MAX_HEALTH}`}>
        <div className="health-bar">
          <div
            className={`health-fill ${health <= 6 ? 'health-fill--low' : ''}`}
            style={{ width: `${pct}%` }}
          />
          <span className="health-text">
            ♥ {health} / {MAX_HEALTH}
          </span>
        </div>
      </div>
      <div className="stat-badge" title="Cards left in the dungeon">
        🂠 {deckCount}
      </div>
      <div
        className={`stat-badge ${potionUsed ? 'stat-badge--dim' : ''}`}
        title="One health potion per room"
      >
        {potionUsed ? '🧪 used' : '🧪 ready'}
      </div>
      <div className="spacer" />
      <button
        className="btn"
        onClick={onRun}
        disabled={!canRun}
        title={runReason ?? 'Flee: send this room to the bottom of the deck'}
      >
        Run away
      </button>
      <button className="btn btn--ghost" onClick={onRestart} title="Start a new game">
        New game
      </button>
    </header>
  );
}
