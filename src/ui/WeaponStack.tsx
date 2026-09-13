import { weaponThreshold, type GameState } from '../engine';
import { cardAriaLabel, cardLabel, useT } from '../i18n';
import { CardView } from './CardView';
import { Tooltip } from './Tooltip';

/** Fan offsets: each older kill peeks out left+down so its printed rank/suit corner stays visible. */
const KILL_STEP_X = 40;
const KILL_STEP_Y = 16;

/**
 * Weapon zone per the custom layout: weapon card on the left, kill stack on the
 * right with the last kill on top. The tooltip surfaces the degradation chain.
 */
export function WeaponStack({ game }: { game: GameState }) {
  const t = useT();
  const threshold = weaponThreshold(game);
  const hasKills = game.killStack.length > 0;
  const degradationOn = game.config.weaponDegradation;
  const lastKill = game.killStack[game.killStack.length - 1];

  const thresholdText = !degradationOn
    ? t('thresholdOff')
    : threshold === null
      ? t('thresholdFresh')
      : t('thresholdValue', { threshold });

  if (game.weapon === null && !hasKills) {
    return (
      <section className="weapon-zone" aria-label={t('weaponZone')}>
        <p className="weapon-empty">{t('weaponEmpty')}</p>
      </section>
    );
  }

  return (
    <section className="weapon-zone" aria-label={t('weaponZoneStack')}>
      <div className="weapon-side">
        <h3 className="zone-title">{t('weaponZone')}</h3>
        <Tooltip text={thresholdText}>
          {game.weapon !== null && <CardView cardId={game.weapon} className="weapon-card" />}
        </Tooltip>
        <p className="weapon-threshold" data-kind="info">
          {!degradationOn || threshold === null || lastKill === undefined
            ? t('fightsAny')
            : t('fightsUpTo', { threshold, last: cardLabel(lastKill) })}
        </p>
      </div>

      <div className="kill-side">
        <h3 className="zone-title">{t('slainMonsters')}</h3>
        {hasKills ? (
          <Tooltip text={thresholdText}>
            <div
              className="kill-stack"
              role="list"
              aria-label={t('slainAria')}
              style={{
                width: `calc(var(--card-w) * 0.85 + ${(game.killStack.length - 1) * KILL_STEP_X}px)`,
                height: `calc(var(--card-h) * 0.85 + ${(game.killStack.length - 1) * KILL_STEP_Y}px)`,
              }}
            >
              {[...game.killStack].reverse().map((cardId, i) => (
                <div
                  key={cardId}
                  className="kill-card"
                  style={{
                    right: i * KILL_STEP_X,
                    top: i * KILL_STEP_Y,
                    zIndex: game.killStack.length - i,
                  }}
                  role="listitem"
                  aria-label={cardAriaLabel(cardId)}
                >
                  <CardView cardId={cardId} disabled className="kill-card-view" />
                  {i === 0 && <span className="last-kill-badge">{t('lastKillBadge')}</span>}
                </div>
              ))}
            </div>
          </Tooltip>
        ) : (
          <p className="weapon-threshold">
            {game.weapon !== null
              ? t('noKillsFresh', { weapon: cardLabel(game.weapon) })
              : t('noKillsNoWeapon')}
          </p>
        )}
      </div>
    </section>
  );
}
