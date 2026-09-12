import { cardAriaLabel, cardLabel, weaponThreshold, type GameState } from '../engine';
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
  const threshold = weaponThreshold(game);
  const hasKills = game.killStack.length > 0;
  const degradationOn = game.config.weaponDegradation;
  const lastKill = game.killStack[game.killStack.length - 1];

  const thresholdText = !degradationOn
    ? 'Weapon degradation is off: this weapon can fight any monster.'
    : threshold === null
      ? 'This weapon is fresh — it can fight any monster. After each kill it can only fight weaker monsters than the last one it killed.'
      : `After a kill, a weapon can only fight monsters weaker than the last monster it killed. This weapon can fight monsters up to ${threshold}.`;

  if (game.weapon === null && !hasKills) {
    return (
      <section className="weapon-zone" aria-label="Weapon">
        <p className="weapon-empty">No weapon equipped — fighting is barehanded and painful.</p>
      </section>
    );
  }

  return (
    <section className="weapon-zone" aria-label="Weapon and slain monsters">
      <div className="weapon-side">
        <h3 className="zone-title">Weapon</h3>
        <Tooltip text={thresholdText}>
          {game.weapon !== null && <CardView cardId={game.weapon} className="weapon-card" />}
        </Tooltip>
        <p className="weapon-threshold" data-kind="info">
          {!degradationOn || threshold === null || lastKill === undefined
            ? 'Fights any monster'
            : `Fights monsters up to ${threshold} — last kill: ${cardLabel(lastKill)}`}
        </p>
      </div>

      <div className="kill-side">
        <h3 className="zone-title">Slain monsters</h3>
        {hasKills ? (
          <Tooltip text={thresholdText}>
            <div
              className="kill-stack"
              role="list"
              aria-label="Slain monsters, last kill on top"
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
                  {i === 0 && <span className="last-kill-badge">Last kill</span>}
                </div>
              ))}
            </div>
          </Tooltip>
        ) : (
          <p className="weapon-threshold">
            No kills yet —{' '}
            {game.weapon !== null ? `${cardLabel(game.weapon)} is fresh` : 'no weapon'}.
          </p>
        )}
      </div>
    </section>
  );
}
