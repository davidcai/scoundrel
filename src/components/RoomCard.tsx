import type { Card, GameState } from '../engine';
import { canFightWithWeapon, cardRole } from '../engine';
import { CardView } from './CardView';

interface RoomCardProps {
  state: GameState;
  card: Card;
  onFight: (cardId: string, useWeapon: boolean) => void;
  onEquip: (cardId: string) => void;
  onDrink: (cardId: string) => void;
}

export function RoomCard({ state, card, onFight, onEquip, onDrink }: RoomCardProps) {
  const role = cardRole(card);
  const weaponUsable = canFightWithWeapon(state, card.id);

  return (
    <div className="card-wrapper">
      <CardView card={card} role={role} interactable />
      <div className="card-actions">
        {role === 'monster' && (
          <>
            <button
              className="btn btn-monster"
              onClick={() => onFight(card.id, true)}
              disabled={!weaponUsable}
              title={
                !state.weapon
                  ? 'No weapon equipped'
                  : !weaponUsable
                    ? state.weapon.lastKilledValue !== null && card.value >= state.weapon.lastKilledValue
                      ? `Weapon can only fight monsters weaker than ${state.weapon.lastKilledValue}`
                      : 'Weapon cannot fight this monster'
                    : 'Fight with weapon'
              }
            >
              Fight w/ weapon
            </button>
            <button
              className="btn btn-monster"
              onClick={() => onFight(card.id, false)}
            >
              Fight barehanded
            </button>
            {!state.weapon && <div className="btn-hint">No weapon equipped</div>}
            {state.weapon && !weaponUsable && (
              <div className="btn-hint">Weapon too weak</div>
            )}
          </>
        )}
        {role === 'weapon' && (
          <>
            <button className="btn btn-weapon" onClick={() => onEquip(card.id)}>
              {state.weapon ? 'Replace weapon' : 'Equip weapon'}
            </button>
            {state.weapon && (
              <div className="btn-hint">Discards current weapon</div>
            )}
          </>
        )}
        {role === 'potion' && (
          <>
            <button className="btn btn-potion" onClick={() => onDrink(card.id)}>
              Drink potion
            </button>
            {state.potionsUsedThisRoom > 0 && (
              <div className="btn-hint">Extra potion heals 0</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}