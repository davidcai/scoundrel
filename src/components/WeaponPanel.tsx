import type { EquippedWeapon } from '../engine/types';
import CardView from './CardView';

interface WeaponPanelProps {
  weapon: EquippedWeapon | null;
}

export default function WeaponPanel({ weapon }: WeaponPanelProps) {
  if (!weapon) {
    return (
      <div className="weapon-panel weapon-panel-empty">
        <div className="weapon-empty-icon">✊</div>
        <div className="weapon-empty-title">No Weapon</div>
        <div className="weapon-empty-subtitle">Fighting barehanded</div>
      </div>
    );
  }

  const limitText =
    weapon.lastKilledValue === null
      ? 'Can fight any monster'
      : `Can fight monsters < ${weapon.lastKilledValue}`;

  return (
    <div className="weapon-panel">
      <div className="weapon-header">
        <span className="weapon-title">Equipped</span>
        <span className="weapon-limit">{limitText}</span>
      </div>
      <div className="weapon-slot">
        <div className="weapon-active">
          <CardView card={weapon.card} size="normal" />
        </div>
        <div className="killed-stack">
          {weapon.killed.map((monster, index) => (
            <div
              key={monster.id}
              className="killed-card"
              style={{
                zIndex: index,
                transform: `translate(${index * 14}px, ${index * 10}px)`,
              }}
            >
              <CardView card={monster} size="normal" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
