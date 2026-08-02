import { labelFor } from '../game/deck';
import { MAX_HEALTH } from '../game/deck';
import type { GameState } from '../game/types';
import CardView from './CardView';

interface Props {
  state: GameState;
  onRunAway: () => void;
}

export default function HUD({ state, onRunAway }: Props) {
  const { health, weapon, dungeon, ranLastRoom, potionUsed } = state;
  const canRun = state.phase === 'playing' && !ranLastRoom && dungeon.length > 0;
  const weaponLimit = weapon
    ? weapon.defeated.length > 0
      ? weapon.defeated[weapon.defeated.length - 1].value
      : null
    : null;

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="health-block">
          <div className="health-bar" title={`Health ${health}/${MAX_HEALTH}`}>
            {Array.from({ length: MAX_HEALTH }, (_, i) => (
              <span
                key={i}
                className={`pip ${i < health ? 'filled' : 'empty'}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="health-num">
            ❤️ {health} / {MAX_HEALTH}
          </div>
        </div>
        <div className="deck-count" title="Cards left in the dungeon">
          <span className="deck-back" aria-hidden="true" />
          <span>{dungeon.length} in deck</span>
        </div>
      </div>

      <div className="hud-right">
        <div className="weapon-slot">
          {weapon ? (
            <div className="weapon-wrap">
              <CardView card={weapon.card} mini />
              {weapon.defeated.length > 0 && (
                <div className="weapon-stack" title="Monsters defeated with this weapon">
                  {weapon.defeated.slice(-3).map((m) => (
                    <span key={m.id} className="weapon-slay">{labelFor(m.value)}</span>
                  ))}
                </div>
              )}
              <div className="weapon-hint">
                {weaponLimit === null ? 'Ready to fight anything' : `Fights monsters < ${weaponLimit}`}
              </div>
            </div>
          ) : (
            <div className="weapon-none">No weapon equipped</div>
          )}
        </div>
        {potionUsed && <div className="chip potion-chip">Potion used this room</div>}
        <button type="button" className="btn run-btn" disabled={!canRun} onClick={onRunAway}>
          🏃 Run away
        </button>
      </div>
    </div>
  );
}
