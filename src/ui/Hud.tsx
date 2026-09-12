import { isFinalRoom, roomResolveTarget, runAwayStatus, type GameState } from '../engine';
import { Tooltip } from './Tooltip';

/** Always-legible critical info: HP, deck count, room progress, run-away status, seed. */
export function Hud({ game }: { game: GameState }) {
  const runStatus = runAwayStatus(game);
  const hpPct = Math.max(0, Math.min(100, (game.hp / game.maxHp) * 100));
  const potionUsed = game.config.potionsPerRoom === 'one' && game.potionsUsedThisRoom > 0;

  return (
    <header className="hud" aria-label="Game status">
      <div className="hud-group hp">
        <span className="hud-label">Health</span>
        <div
          className="hp-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={game.maxHp}
          aria-valuenow={game.hp}
          aria-label="Current health"
        >
          <div className="hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="hud-value">
          {game.hp}/{game.maxHp}
        </span>
      </div>

      <div className="hud-group">
        <span className="hud-label">Dungeon</span>
        <span className="hud-value">{game.dungeon.length} cards</span>
      </div>

      <div className="hud-group">
        <span className="hud-label">Room</span>
        <span className="hud-value">
          {isFinalRoom(game)
            ? `${game.turnCount} · final`
            : `${game.turnCount} · ${game.resolvedCount}/${roomResolveTarget(game)} resolved`}
        </span>
      </div>

      <div className="hud-group">
        <span className="hud-label">Potion</span>
        <span className="hud-value">{potionUsed ? 'used this room' : 'available'}</span>
      </div>

      <Tooltip text="You may run away once per turn — never from two rooms in a row, never from a room you have engaged, and never from the final room.">
        <div className="hud-group run-status" data-legal={runStatus.legal}>
          <span className="hud-label">Run away</span>
          <span className="hud-value">{runStatus.legal ? 'ready' : 'blocked'}</span>
        </div>
      </Tooltip>

      <Tooltip text="The seed uniquely determines this dungeon. Share it to challenge a friend with the same run.">
        <div className="hud-group">
          <span className="hud-label">Seed</span>
          <span className="hud-value mono">{game.seed}</span>
        </div>
      </Tooltip>
    </header>
  );
}
