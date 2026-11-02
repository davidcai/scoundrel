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
  onTitle: () => void;
}
export function PlayScreen({ game, selected, t, onSelect, onAct, onTitle }: Props) {
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
        <button className="status-menu" onClick={onTitle} aria-label={t('menu')} title={t('menu')}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 11.5 12 4.5l8.5 7" />
            <path d="M5.75 10.25v9h12.5v-9M10 19.25V14h4v5.25" />
          </svg>
        </button>
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
        </div>
      </section>
      <div className="board">
        <section className="room-area" aria-label={t('room', { room: b.highlights.roomsExplored })}>
          <div className="room-head">
            <h1 className="room-title">
              {final ? t('finalRoom') : t('room', { room: b.highlights.roomsExplored })}
            </h1>
            <div className="room-status">
              {b.potionsUsed > 0 && <span className="tag potion-used">{t('potionUsed')}</span>}
              <span className="tag">
                {t('resolvedCount', {
                  resolved: b.resolved,
                  total: final ? b.resolved + b.room.length : 3,
                })}
              </span>
            </div>
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
                    aria-describedby={b.carriedCard === id ? `carried-${id}` : undefined}
                    aria-label={t('cardDescription', {
                      card: cardName(id, t),
                      kind: kindName(c.kind),
                      value: c.value,
                    })}
                    onClick={() => onSelect(id)}
                    onKeyDown={(event) => cardKeys(event, index)}
                  >
                    <img src={cardImage(id)} alt="" width="1024" height="1536" />
                    {b.carriedCard === id && (
                      <span id={`carried-${id}`} className="carried">
                        {t('carried')}
                      </span>
                    )}
                  </button>
                  <p className="card-caption">
                    {cardName(id, t)} <span className="muted">· {kindName(c.kind)}</span>
                  </p>
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
              <h2 id="preview-heading" className="sr-only">
                {cardName(card.id, t)}
              </h2>
              {card.kind === 'monster' ? (
                <>
                  {weapon?.type === 'fought' ? (
                    <p className="muted">
                      {t('damageMath', {
                        monster: card.value,
                        weapon: b.weapon ? getCard(b.weapon).value : 0,
                      })}
                    </p>
                  ) : (
                    <p className="muted">{invalidText(weapon)}</p>
                  )}
                  <button
                    className="primary wide combat-action"
                    disabled={weapon?.type !== 'fought'}
                    aria-label={t('fightWeapon')}
                    aria-describedby={weapon?.type === 'fought' ? 'weapon-damage' : undefined}
                    onClick={() => confirm(weaponAction)}
                  >
                    <span>{t('fightWeapon')}</span>
                    {weapon?.type === 'fought' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span id="weapon-damage">
                          {t('damageReceived', { damage: weapon.damage })}
                        </span>
                      </>
                    )}
                  </button>
                  {bare?.type === 'fought' && (
                    <>
                      <button
                        className="wide combat-action"
                        aria-label={t('fightBare')}
                        aria-describedby="bare-damage"
                        onClick={() => confirm(bareAction)}
                      >
                        <span>{t('fightBare')}</span>
                        <span aria-hidden="true">·</span>
                        <span id="bare-damage">{t('damageReceived', { damage: bare.damage })}</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {item?.type === 'drank' && (
                    <div className="outcome">
                      {item.wasted && <p>{t('wastedPotion')}</p>}
                      <p className="muted">{t('healthAfter', { health: item.healthAfter })}</p>
                    </div>
                  )}
                  {item?.type === 'equipped' && b.weapon && (
                    <p className="muted">{t('swapHelp')}</p>
                  )}
                  <button
                    className="primary wide"
                    disabled={item?.type === 'invalid'}
                    aria-label={t(card.kind === 'weapon' ? 'equip' : 'drink')}
                    aria-describedby={
                      card.kind === 'weapon'
                        ? 'weapon-power'
                        : item?.type === 'drank'
                          ? 'potion-healing'
                          : undefined
                    }
                    onClick={() => confirm(itemAction)}
                  >
                    {t(card.kind === 'weapon' ? 'equip' : 'drink')}
                    {card.kind === 'weapon' && (
                      <>
                        {' '}
                        <span id="weapon-power">{t('weaponPower', { value: card.value })}</span>
                      </>
                    )}
                    {item?.type === 'drank' && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span id="potion-healing">{t('heals', { healed: item.healed })}</span>
                      </>
                    )}
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
          <div className="room-controls" role="group" aria-labelledby="room-actions-label">
            <p id="room-actions-label" className="room-controls-title muted">
              {t('roomActions')}
            </p>
            {escape.type === 'invalid' && (
              <p id="escape-reason" className="muted">
                {t(escape.reason)}
              </p>
            )}
            <div className="run-actions">
              <button
                disabled={escape.type === 'invalid'}
                onClick={() => onAct({ type: 'escape' })}
                aria-describedby={escape.type === 'invalid' ? 'escape-reason' : undefined}
              >
                {t('escape')}
              </button>
              <button disabled={undo.type === 'invalid'} onClick={() => onAct({ type: 'undo' })}>
                {t('undo')}
              </button>
            </div>
          </div>
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
      <p className="run-seed muted">
        <span>{t('seed')}</span>
        <span className="seed-value">{game.seed}</span>
      </p>
    </>
  );
}
