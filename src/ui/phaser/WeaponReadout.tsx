import { weaponThreshold, type GameState } from '../../engine';
import { cardAriaLabel, cardLabel, useT } from '../../i18n';
import { CardView } from '../CardView';
import { Tooltip } from '../Tooltip';

/**
 * DOM weapon-zone readout (docs/phaser-plan.md §4 Phase 1): the canvas owns
 * the weapon and kill-stack *visuals*, this owns the *information* — the
 * weapon element carries `data-card-id` (the e2e bot reads `.weapon-card` +
 * `data-card-id`), the kill stack keeps `role="list"`/`listitem` semantics
 * with a per-kill `cardAriaLabel`, the localized last-kill badge is
 * preserved, and the weapon id/threshold/kill count stay in accessible DOM.
 *
 * CardView instances are `disabled` (non-interactive, non-focusable): the
 * canvas is the visual, this is the readout. The kill stack keeps the
 * stepped fan offsets (constants 40/16, mirrored from the former DOM
 * WeaponStack — same geometry the canvas kill stack draws).
 */
const KILL_STEP_X = 40;
const KILL_STEP_Y = 16;

export function WeaponReadout({ game }: { game: GameState }) {
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
      <section className="weapon-zone weapon-readout" aria-label={t('weaponZone')}>
        <p className="weapon-empty">{t('weaponEmpty')}</p>
      </section>
    );
  }

  return (
    <section className="weapon-zone weapon-readout" aria-label={t('weaponZoneStack')}>
      <div className="weapon-side">
        <h3 className="zone-title">{t('weaponZone')}</h3>
        <Tooltip text={thresholdText}>
          {game.weapon !== null && (
            <CardView cardId={game.weapon} disabled className="weapon-card" />
          )}
        </Tooltip>
        <p className="weapon-threshold" data-kind="info">
          {!degradationOn || threshold === null || lastKill === undefined
            ? t('fightsAny')
            : t('fightsUpTo', { threshold, last: cardLabel(lastKill) })}
        </p>
        <p className="weapon-threshold kill-count">
          {t('killCount', { count: game.killStack.length })}
        </p>
      </div>

      <div className="kill-side">
        <h3 className="zone-title">{t('slainMonsters')}</h3>
        {hasKills ? (
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
