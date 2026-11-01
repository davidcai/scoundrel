import { useEffect, useRef } from 'react';
import { getCard, isRoomComplete, previewAction } from '../engine';
import type { Action, ActionResult, CardId, PlayingState } from '../engine';
import type { Translate } from '../i18n/translate';
import { cardName } from '../i18n/translate';
import { cardImage } from './card-image';
interface Props {
  game: PlayingState;
  selected: CardId | null;
  t: Translate;
  onSelect: (id: CardId) => void;
  onAct: (action: Action) => void;
}
export function PlayScreen({ game, selected, t, onSelect, onAct }: Props) {
  const { board: b } = game;
  const room = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const first = useRef(true);
  const complete = isRoomComplete(b);
  const final = b.dungeon.length === 0;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (complete) next.current?.focus();
    else room.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [b, complete]);
  const card = selected && b.room.includes(selected) ? getCard(selected) : null;
  const weaponAction: Action | null =
    card?.kind === 'monster' ? { type: 'fight', cardId: card.id, mode: 'weapon' } : null;
  const bareAction: Action | null =
    card?.kind === 'monster' ? { type: 'fight', cardId: card.id, mode: 'barehanded' } : null;
  const itemAction: Action | null =
    card && card.kind !== 'monster'
      ? { type: card.kind === 'weapon' ? 'equip' : 'drink', cardId: card.id }
      : null;
  const weapon = weaponAction ? previewAction(game, weaponAction) : null;
  const bare = bareAction ? previewAction(game, bareAction) : null;
  const item = itemAction ? previewAction(game, itemAction) : null;
  const escape = previewAction(game, { type: 'escape' });
  const undo = previewAction(game, { type: 'undo' });
  const lastKill = b.kills.at(-1);
  const kindName = (kind: 'monster' | 'weapon' | 'potion') => t(kind);
  function cardKeys(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % b.room.length,
      ArrowDown: (index + 1) % b.room.length,
      ArrowLeft: (index + b.room.length - 1) % b.room.length,
      ArrowUp: (index + b.room.length - 1) % b.room.length,
      Home: 0,
      End: b.room.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const position = keys[event.key];
    onSelect(b.room[position]);
    room.current?.querySelectorAll<HTMLButtonElement>('button')[position]?.focus();
  }
  function confirm(action: Action | null) {
    if (action) onAct(action);
  }
  function invalidText(result: ActionResult | null) {
    return result?.type === 'invalid' ? t(result.reason) : null;
  }
  return (
    <>
      <section className="statusbar" aria-label={t('runInProgress')}>
        <div className="health">
          <span>{t('health')}</span>
          <strong className="health-value">
            {b.health} <span className="muted">/ 20</span>
          </strong>
          <meter min="0" max="20" value={b.health} aria-label={t('health')} />
        </div>
        <div className="status-items">
          <div>
            <span>{t('dungeon')}</span>
            <strong>{t('cardsRemaining', { count: b.dungeon.length })}</strong>
          </div>
          <div>
            <span>{t('potionsThisRoom')}</span>
            <strong>
              {b.potionsUsed} / {game.config.unlimitedPotions ? '∞' : 1}
            </strong>
          </div>
        </div>
      </section>
      <div className="board">
        <section className="room-area" aria-label={t('room', { room: b.highlights.roomsExplored })}>
          <div className="room-head">
            <h1 className="room-title">
              {final ? t('finalRoom') : t('room', { room: b.highlights.roomsExplored })}
            </h1>
            <span className="tag">
              {t('resolvedCount', {
                resolved: b.resolved,
                total: final ? b.resolved + b.room.length : 3,
              })}
            </span>
          </div>
          <div className="room-grid" ref={room}>
            {b.room.map((id, index) => {
              const c = getCard(id);
              return (
                <article className={`card${selected === id ? ' selected' : ''}`} key={id}>
                  <button
                    data-card-id={id}
                    disabled={complete}
                    aria-pressed={selected === id}
                    aria-label={t('cardDescription', {
                      card: cardName(id, t),
                      kind: kindName(c.kind),
                      value: c.value,
                    })}
                    onClick={() => onSelect(id)}
                    onKeyDown={(event) => cardKeys(event, index)}
                  >
                    <img src={cardImage(id)} alt="" width="1024" height="1536" />
                  </button>
                  <p className="card-name">{cardName(id, t)}</p>
                  <p className="muted card-kind">{kindName(c.kind)}</p>
                  {b.carriedCard === id && <span className="carried">{t('carried')}</span>}
                </article>
              );
            })}
          </div>
        </section>
        <aside className="preview" aria-labelledby="preview-heading">
          {complete ? (
            <>
              <h2 id="preview-heading">{t('roomCleared')}</h2>
              <p className="muted">{t('roomClearedHelp')}</p>
              <button
                className="primary wide"
                ref={next}
                onClick={() => onAct({ type: 'next-room' })}
              >
                {t('nextRoom')}
              </button>
            </>
          ) : card ? (
            <>
              <p className="preview-label">{t('selectedCard')}</p>
              <h2 id="preview-heading">{cardName(card.id, t)}</h2>
              {card.kind === 'monster' ? (
                <>
                  {weapon?.type === 'fought' ? (
                    <div className="outcome">
                      <div className="damage-row">
                        <span>{t('damage')}</span>
                        <strong className="damage">{weapon.damage}</strong>
                      </div>
                      <p className="muted">
                        {t('damageMath', {
                          monster: card.value,
                          weapon: b.weapon ? getCard(b.weapon).value : 0,
                        })}
                      </p>
                      <p>{t('healthAfter', { health: weapon.healthAfter })}</p>
                    </div>
                  ) : (
                    <p className="muted">{invalidText(weapon)}</p>
                  )}
                  <button
                    className="primary wide"
                    disabled={weapon?.type !== 'fought'}
                    onClick={() => confirm(weaponAction)}
                  >
                    {t('fightWeapon')}
                  </button>
                  {bare?.type === 'fought' && (
                    <>
                      <p className="muted">{t('bareDamage', { damage: bare.damage })}</p>
                      <button className="wide" onClick={() => confirm(bareAction)}>
                        {t('fightBare')}
                      </button>
                      <p>{t('healthAfter', { health: bare.healthAfter })}</p>
                    </>
                  )}
                </>
              ) : (
                <>
                  {item?.type === 'drank' && (
                    <div className="outcome">
                      <p>{item.wasted ? t('wastedPotion') : t('heals', { healed: item.healed })}</p>
                      <p>{t('healthAfter', { health: item.healthAfter })}</p>
                    </div>
                  )}
                  {item?.type === 'equipped' && b.weapon && (
                    <p className="muted">{t('swapHelp')}</p>
                  )}
                  <button
                    className="primary wide"
                    disabled={item?.type === 'invalid'}
                    onClick={() => confirm(itemAction)}
                  >
                    {t(card.kind === 'weapon' ? 'equip' : 'drink')}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <h2 id="preview-heading">{t('chooseCard')}</h2>
              <p className="muted">{t('selectHelp')}</p>
            </>
          )}
        </aside>
        <section className="equipment" aria-label={t('weapon')}>
          {b.weapon ? (
            <>
              <div className="equipment-cards">
                <img
                  src={cardImage(b.weapon)}
                  alt={cardName(b.weapon, t)}
                  width="1024"
                  height="1536"
                />
                <div className="kill-stack" role="list" aria-label={t('defeatedMonsters')}>
                  {b.kills.map((id) => (
                    <span role="listitem" key={id}>
                      <img src={cardImage(id)} alt={cardName(id, t)} width="1024" height="1536" />
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h2>{t('yourWeapon', { value: getCard(b.weapon).value })}</h2>
                <p className="muted">
                  {!game.config.weaponDegradation
                    ? t('degradationOff')
                    : lastKill
                      ? t('lastKill', { value: getCard(lastKill).value })
                      : t('freshWeapon')}
                </p>
                <p className="muted">{t('swapHelp')}</p>
              </div>
            </>
          ) : (
            <div>
              <h2>{t('noWeapon')}</h2>
              <p className="muted">{t('noWeaponHelp')}</p>
            </div>
          )}
        </section>
      </div>
      <div className="run-actions">
        <div>
          <button
            disabled={escape.type === 'invalid'}
            onClick={() => onAct({ type: 'escape' })}
            aria-describedby={escape.type === 'invalid' ? 'escape-reason' : undefined}
          >
            {t('escape')}
          </button>
          {escape.type === 'invalid' && (
            <p id="escape-reason" className="muted">
              {t(escape.reason)}
            </p>
          )}
        </div>
        <div>
          <button
            disabled={undo.type === 'invalid'}
            onClick={() => onAct({ type: 'undo' })}
            aria-describedby={undo.type === 'invalid' ? 'undo-reason' : undefined}
          >
            {t('undo')}
          </button>
          {undo.type === 'invalid' && (
            <p id="undo-reason" className="muted">
              {t(undo.reason)}
            </p>
          )}
        </div>
      </div>
      <div className="play-help">
        <p>{final ? t('finalHelp') : t('roomHelp')}</p>
        <p>{t('keyboardHelp')}</p>
      </div>
      <p className="run-seed muted">
        <span>{t('seed')}</span>
        <span className="seed-value">{game.seed}</span>
      </p>
    </>
  );
}
