import { useEffect, useState } from 'react';
import { randomSeed } from '../engine/deck';
import {
  canWeaponFight,
  cardLabel,
  fightDamage,
  isMonster,
  isPotion,
  isWeapon,
} from '../engine/rules';
import type { Card } from '../engine/types';
import { CardView } from './components/CardView';
import { EndScreen } from './components/EndScreen';
import { LogPanel } from './components/LogPanel';
import { StatsBar } from './components/StatsBar';
import { WeaponPile } from './components/WeaponPile';
import { useGame } from './useGame';

export function App() {
  const [state, dispatch] = useGame();
  /** Monster card currently awaiting a combat choice. */
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [state.room]);

  const restart = () => dispatch({ type: 'restart', seed: randomSeed() });

  const handleCardClick = (card: Card) => {
    if (state.status !== 'playing') return;
    if (isPotion(card)) dispatch({ type: 'drink', cardId: card.id });
    else if (isWeapon(card)) dispatch({ type: 'equip', cardId: card.id });
    else setSelected((prev) => (prev === card.id ? null : card.id));
  };

  const fight = (card: Card, useWeapon: boolean) => {
    dispatch({ type: 'fight', cardId: card.id, useWeapon });
    setSelected(null);
  };

  const canRun =
    state.status === 'playing' && !state.ranLastRoom && state.room.length === 4;
  const runReason = state.ranLastRoom
    ? "You can't run from two rooms in a row"
    : state.room.length !== 4
      ? 'You can only run from a full, untouched room'
      : null;

  return (
    <div className="app">
      <StatsBar
        health={state.health}
        deckCount={state.deck.length}
        potionUsed={state.potionUsed}
        canRun={canRun}
        runReason={canRun ? null : runReason}
        onRun={() => dispatch({ type: 'run' })}
        onRestart={restart}
      />

      <main className="table">
        <section className="room-row" aria-label="Room">
          {state.room.map((card) => {
            const monster = isMonster(card);
            const weaponOk =
              monster && state.weapon !== null && canWeaponFight(state.weapon, card);
            return (
              <CardView
                key={card.id}
                card={card}
                selected={selected === card.id}
                onClick={state.status === 'playing' ? () => handleCardClick(card) : undefined}
              >
                {monster ? (
                  <div className="fight-choices">
                    {weaponOk && state.weapon && (
                      <button
                        className="btn btn--fight"
                        onClick={(e) => {
                          e.stopPropagation();
                          fight(card, true);
                        }}
                      >
                        🗡 {cardLabel(state.weapon.card)} −
                        {fightDamage(card, state.weapon, true)} hp
                      </button>
                    )}
                    <button
                      className="btn btn--fight btn--bare"
                      onClick={(e) => {
                        e.stopPropagation();
                        fight(card, false);
                      }}
                    >
                      ✊ Barehanded −{fightDamage(card, null, false)} hp
                    </button>
                    {state.weapon && !weaponOk && (
                      <span className="fight-note">
                        {cardLabel(state.weapon.card)} can't fight this — last kill
                        was {state.weapon.kills[state.weapon.kills.length - 1]?.value}
                      </span>
                    )}
                  </div>
                ) : null}
              </CardView>
            );
          })}
        </section>

        <section className="under-row">
          <WeaponPile weapon={state.weapon} />
          <div className="hints">
            <p>♥ drink · ♦ equip · ♠/♣ fight</p>
            <p>Resolve 3 cards per room; the 4th carries over.</p>
            {state.potionUsed && <p>Extra potions this room will be discarded.</p>}
          </div>
          <div className="discard-badge" title="Discard pile">
            🗑 {state.discard.length}
          </div>
        </section>

        <LogPanel log={state.log} />
      </main>

      {state.status !== 'playing' && (
        <EndScreen status={state.status} score={state.score} onRestart={restart} />
      )}
    </div>
  );
}
