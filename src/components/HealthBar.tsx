import type { GameState } from '../game/types';
import { HEALTH_MAX } from '../game/constants';

export default function HealthBar({ state }: { state: GameState }) {
  const pct = Math.max(0, Math.min(100, (state.health / HEALTH_MAX) * 100));
  const tone = state.health > 12 ? 'good' : state.health > 5 ? 'warn' : 'bad';
  const over = state.health > HEALTH_MAX;
  return (
    <div className={`health ${tone}`}>
      <div className="health-label">
        Health <strong>{state.health}</strong> / {HEALTH_MAX}
        {over && <span className="health-cap"> (cap {HEALTH_MAX})</span>}
      </div>
      <div className="health-track">
        <div className="health-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}