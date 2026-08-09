import type { GameState } from '../engine';
import { CardView } from './CardView';

interface WeaponPanelProps {
  state: GameState;
}

export function WeaponPanel({ state }: WeaponPanelProps) {
  const { weapon } = state;

  if (!weapon) {
    return (
      <div className="weapon-panel">
        <div className="panel-title">Equipped Weapon</div>
        <div className="weapon-empty">No weapon equipped</div>
      </div>
    );
  }

  const threshold = weapon.lastKilledValue;

  return (
    <div className="weapon-panel">
      <div className="panel-title">Equipped Weapon</div>
      <div className="weapon-equipped">
        <div className="weapon-card-row">
          <CardView card={weapon.card} role="weapon" />
          <div className="weapon-info">
            <div className="weapon-strength">Strength {weapon.card.value}</div>
            <div className={`weapon-degradation${threshold === null ? ' fresh' : ''}`}>
              {threshold === null ? (
                <>Fresh — can fight any monster</>
              ) : (
                <>
                  Can only fight monsters &lt; <span className="threshold">{threshold}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {weapon.stack.length > 0 && (
          <div className="weapon-stack">
            <div className="weapon-stack-label">Defeated ({weapon.stack.length})</div>
            <div className="weapon-stack-cards">
              {weapon.stack.map((m) => (
                <div key={m.id} className="stack-card">
                  <span>{m.value}</span>
                  <span className="stack-suit">
                    {m.suit === 'clubs' ? '\u2663' : '\u2660'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}