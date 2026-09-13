import { isFinalRoom, roomResolveTarget, runAwayStatus, type GameState } from '../engine';
import { useT } from '../i18n';
import { Tooltip } from './Tooltip';

/** Always-legible critical info: HP, deck count, room progress, run-away status, seed. */
export function Hud({ game }: { game: GameState }) {
  const t = useT();
  const runStatus = runAwayStatus(game);
  const hpPct = Math.max(0, Math.min(100, (game.hp / game.maxHp) * 100));
  const potionUsed = game.config.potionsPerRoom === 'one' && game.potionsUsedThisRoom > 0;

  return (
    <header className="hud" aria-label={t('gameStatus')}>
      <div className="hud-group hp">
        <span className="hud-label">{t('health')}</span>
        <div
          className="hp-bar"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={game.maxHp}
          aria-valuenow={game.hp}
          aria-label={t('currentHealth')}
        >
          <div className="hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="hud-value">
          {game.hp}/{game.maxHp}
        </span>
      </div>

      <div className="hud-group">
        <span className="hud-label">{t('dungeon')}</span>
        <span className="hud-value">{t('cardsLeft', { count: game.dungeon.length })}</span>
      </div>

      <div className="hud-group">
        <span className="hud-label">{t('room')}</span>
        <span className="hud-value">
          {isFinalRoom(game)
            ? t('roomFinal', { turn: game.turnCount })
            : t('roomResolved', {
                turn: game.turnCount,
                resolved: game.resolvedCount,
                target: roomResolveTarget(game),
              })}
        </span>
      </div>

      <div className="hud-group">
        <span className="hud-label">{t('potion')}</span>
        <span className="hud-value">{potionUsed ? t('potionUsed') : t('potionAvailable')}</span>
      </div>

      <Tooltip text={t('tooltipRunAwayHud')}>
        <div className="hud-group run-status" data-legal={runStatus.legal}>
          <span className="hud-label">{t('runAway')}</span>
          <span className="hud-value">{runStatus.legal ? t('ready') : t('blocked')}</span>
        </div>
      </Tooltip>

      <Tooltip text={t('tooltipSeed')}>
        <div className="hud-group">
          <span className="hud-label">{t('seed')}</span>
          <span className="hud-value mono">{game.seed}</span>
        </div>
      </Tooltip>
    </header>
  );
}
