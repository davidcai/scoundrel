import type { Card, GameState } from '../game/types';
import { canUseWeapon, cardKind } from '../game/rules';
import CardView from './CardView';

interface Props {
  state: GameState;
  onFightBarehanded: (cardId: string) => void;
  onFightWithWeapon: (cardId: string) => void;
  onEquip: (cardId: string) => void;
  onDrink: (cardId: string) => void;
}

function kindLabel(card: Card): string {
  switch (cardKind(card)) {
    case 'monster':
      return `Monster (${card.value})`;
    case 'weapon':
      return `Weapon (${card.value})`;
    case 'potion':
      return `Potion (+${card.value})`;
  }
}

export default function Room({ state, onFightBarehanded, onFightWithWeapon, onEquip, onDrink }: Props) {
  const canAct =
    state.phase === 'playing' && !state.roomComplete && state.resolvedCount < state.requiredResolves;

  if (state.roomComplete && state.phase === 'playing') {
    return (
      <div className="room room-complete">
        <p>Room cleared. One card carries over to the next room.</p>
      </div>
    );
  }

  if (state.room.length === 0) return <div className="room room-empty">No cards in play.</div>;

  return (
    <div className="room">
      {state.room.map((card) => {
        const kind = cardKind(card);
        const weaponUsable = kind === 'monster' && canUseWeapon(state.weapon, card.value);
        const highlight =
          kind === 'weapon'
            ? 'weapon'
            : kind === 'potion'
              ? 'potion'
              : !canUseWeapon(state.weapon, card.value)
                ? 'danger'
                : 'none';
        return (
          <div className="card-slot" key={card.id}>
            <CardView card={card} faded={!canAct} highlight={highlight} />
            <div className="card-meta">{kindLabel(card)}</div>
            <div className="card-actions">
              {kind === 'monster' && (
                <>
                  <button disabled={!canAct} onClick={() => onFightBarehanded(card.id)}>
                    Barehanded
                  </button>
                  <button disabled={!canAct || !weaponUsable} onClick={() => onFightWithWeapon(card.id)}>
                    Weapon{weaponUsable ? '' : ' (no)'}
                  </button>
                </>
              )}
              {kind === 'weapon' && (
                <button disabled={!canAct} onClick={() => onEquip(card.id)}>
                  Equip
                </button>
              )}
              {kind === 'potion' && (
                <button disabled={!canAct} onClick={() => onDrink(card.id)}>
                  {state.potionUsedThisRoom ? 'Drink (fizzles)' : 'Drink'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}