import { cardLabel } from '../../engine/rules';
import type { EquippedWeapon } from '../../engine/types';
import { CardView } from './CardView';

export function WeaponPile({ weapon }: { weapon: EquippedWeapon | null }) {
  if (!weapon) {
    return (
      <div className="weapon-pile weapon-pile--empty">
        <div className="card-slot">No weapon</div>
        <p className="pile-caption">Equip a ♦ to fight with it</p>
      </div>
    );
  }
  const lastKill = weapon.kills[weapon.kills.length - 1];
  return (
    <div className="weapon-pile">
      <div className="weapon-stack">
        <CardView card={weapon.card} />
        {weapon.kills.slice(-3).map((kill, i) => (
          <div
            key={kill.id}
            className="weapon-kill"
            style={{ transform: `translate(${(i + 1) * 20}px, ${(i + 1) * 9}px)` }}
          >
            <CardView card={kill} />
          </div>
        ))}
      </div>
      <p className="pile-caption">
        {cardLabel(weapon.card)} weapon · {weapon.kills.length} kill
        {weapon.kills.length === 1 ? '' : 's'}
        <br />
        {lastKill
          ? `Fights monsters < ${lastKill.value}`
          : 'Fights any monster'}
      </p>
    </div>
  );
}
