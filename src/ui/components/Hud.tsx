/**
 * HUD band per style guide §6.2: HP cluster left, room progress center,
 * deck pip + seed right. Sticky over the table.
 */
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import './controls.css';

/** 10-segment meter (each segment = 2 HP) — 20 pips would be noise. */
function HpMeter({ hp, maxHp }: { hp: number; maxHp: number }) {
  const segments = 10;
  const per = maxHp / segments;
  const filled = Math.max(0, Math.min(segments, Math.ceil(hp / per)));
  return (
    <span className="hp-meter" aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        // Static fixed-length meter; index is a stable identity here.
        <span key={i} className={i < filled ? 'hp-seg hp-seg--filled' : 'hp-seg'} />
      ))}
    </span>
  );
}

export function Hud() {
  const game = useGame((s) => s.game);
  const [copied, setCopied] = useState(false);
  if (game === null) return null;
  const roomNumber = game.runHighlights.roomsExplored + 1;
  const progress = Math.min(1, (44 - game.dungeon.length - game.room.length) / 44);
  // Presentation-only hook: at ≤25% HP the cluster gets the critical pulse.
  const hpCritical = game.hp <= game.maxHp / 4;

  const copySeed = () => {
    try {
      void navigator.clipboard?.writeText(game.seed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <header className="hud">
      <a className="skip-link" href="#room-row">
        Skip to room
      </a>
      <div className={hpCritical ? 'hud-cluster hud-hp hud-hp--critical' : 'hud-cluster hud-hp'}>
        <span className="micro-label">HP</span>
        <span className="hud-hp-row">
          <span className="hud-hp-digits tabular" aria-label={`HP ${game.hp} of ${game.maxHp}`}>
            {game.hp} / {game.maxHp}
          </span>
          <HpMeter hp={game.hp} maxHp={game.maxHp} />
        </span>
      </div>
      <div className="hud-cluster hud-room">
        <span className="hud-room-title">Room {roomNumber}</span>
        <span
          className="hud-room-track"
          role="progressbar"
          aria-label="Dungeon progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="hud-room-fill" style={{ width: `${progress * 100}%` }} />
        </span>
      </div>
      <div className="hud-cluster hud-meta">
        <span
          className={game.ranAwayLastRoom ? 'chip chip--run chip--run-spent' : 'chip chip--run'}
          title={
            game.ranAwayLastRoom
              ? 'You ran last room — running is blocked'
              : 'Run away is available'
          }
        >
          {game.ranAwayLastRoom ? 'Run spent' : 'Run ready'}
        </span>
        <span
          className="chip chip--deck"
          aria-label={`${game.dungeon.length} cards left in the dungeon`}
        >
          <span aria-hidden="true">▤</span>
          <span className="tabular">{game.dungeon.length}</span>
        </span>
        <button
          type="button"
          className="hud-seed"
          onClick={copySeed}
          aria-label={`Seed ${game.seed}. Activate to copy.`}
        >
          <span className="micro-label">Seed</span>
          <span className="hud-seed-value">{game.seed}</span>
          {copied && <span className="hud-seed-tick">copied</span>}
        </button>
      </div>
    </header>
  );
}
