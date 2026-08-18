/**
 * Weapon zone (Q40 / style guide §6.2): weapon card at room size on the left,
 * kill stack fanned right at hand size, last-killed on top (highest z). The
 * stack's degradation rule is explained by tooltip — the most-confusing
 * mechanic gets the discoverable hint (Q60).
 */
import { useGame } from '../../store/gameStore';
import { cardDisplayName, numericValueOf } from '../cards/cardMeta';
import { Card, EmptyWeaponSlot } from './Card';
import { Tooltip } from './Tooltip';

const DEGRADATION_HINT =
  'Weapon degradation: after a kill, this weapon can only fight monsters weaker than the last monster it killed. The top card of the stack is the current threshold.';

export function WeaponZone() {
  const game = useGame((s) => s.game);
  if (game === null) return null;
  const { weapon, killStack } = game;
  const threshold = killStack.length > 0 ? numericValueOf(killStack[killStack.length - 1]) : null;

  const stackLabel =
    weapon === null
      ? 'No weapon equipped.'
      : threshold !== null
        ? `${cardDisplayName(weapon)} equipped. Degraded: it can only fight monsters weaker than ${threshold}.`
        : `${cardDisplayName(weapon)} equipped. It can fight any monster.`;

  return (
    <section className="weapon-zone" aria-label="Weapon and defeated monsters">
      <span className="micro-label weapon-zone-label">Weapon</span>
      {weapon === null ? (
        <div className="weapon-zone-body">
          <EmptyWeaponSlot />
        </div>
      ) : (
        <Tooltip content={DEGRADATION_HINT}>
          {(described) => (
            <div
              className="weapon-zone-body"
              tabIndex={0}
              role="group"
              aria-label={stackLabel}
              aria-describedby={described['aria-describedby']}
            >
              <Card cardId={weapon} size="room" />
              {killStack.length > 0 && (
                <ol className="kill-stack" aria-label="Slain monsters, last killed on top">
                  {killStack.map((cardId) => (
                    <li key={cardId} className="kill-stack-item">
                      <Card cardId={cardId} size="hand" />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </Tooltip>
      )}
    </section>
  );
}
