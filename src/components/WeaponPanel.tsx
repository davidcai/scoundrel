import type { GameState } from '../game/types';
import { RANK_LABEL, SUIT_SYMBOL } from '../game/constants';
import CardView from './CardView';

export default function WeaponPanel({ state }: { state: GameState }) {
  if (!state.weapon) {
    return (
      <div className="weapon-panel empty">
        <span className="weapon-placeholder">No weapon equipped</span>
      </div>
    );
  }
  const w = state.weapon;
  const cap = w.lastKilledValue === null ? 'any' : `< ${w.lastKilledValue}`;
  return (
    <div className="weapon-panel">
      <CardView card={w.card} highlight="weapon" />
      <div className="weapon-meta">
        <div>
          Equipped <strong>{RANK_LABEL[w.card.rank]}{SUIT_SYMBOL[w.card.suit]}</strong>
        </div>
        <div>Defeats: {cap}</div>
        <div>Slain: {w.slain.length}</div>
        {w.slain.length > 0 && (
          <ul className="slain-list">
            {w.slain.map((m) => (
              <li key={m.id}>
                {RANK_LABEL[m.rank]}{SUIT_SYMBOL[m.suit]} ({m.value})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}