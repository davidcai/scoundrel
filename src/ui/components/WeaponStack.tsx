import type { CardId, GameState } from '../../engine';
import { cardLabel, cardValue } from '../../engine';
import { cardArtUrl } from '../cardArt';

function Thumb({ cardId }: { cardId: CardId }) {
  const url = cardArtUrl(cardId);
  return (
    <div className='thumb' title={cardLabel(cardId) + ' (' + cardValue(cardId) + ')'}>
      {url ? <img src={url} alt={cardLabel(cardId)} draggable={false} /> : <span>{cardId}</span>}
    </div>
  );
}

export function WeaponStack({ state }: { state: GameState }) {
  return (
    <section className='weapon-stack' aria-label='Weapon and kill stack'>
      <div className='weapon'>
        <span className='stack-label'>Weapon</span>
        {state.weapon ? <Thumb cardId={state.weapon} /> : <span className='stack-empty'>none</span>}
      </div>
      <div className='kills'>
        <span className='stack-label'>Kills</span>
        {state.killStack.length === 0 ? (
          <span className='stack-empty'>none</span>
        ) : (
          state.killStack.map((id, i) => <Thumb key={i} cardId={id} />)
        )}
      </div>
    </section>
  );
}
